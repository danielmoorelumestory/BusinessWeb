import { timingSafeEqual } from 'node:crypto'
import { validCandidatesPayload } from '../src/features/candidates/validation.js'
import { readSnapshot, writeSnapshot, type D1Like } from '../server/d1Snapshot.js'

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; env?: { DB?: D1Like } }
type Response = {
  setHeader(name: string, value: string): unknown
  status(code: number): Response
  json(body: unknown): unknown
}

// 研究笔记候选池云同步：整份快照 + 版本号乐观并发，存储在 Cloudflare D1（绑定名 DB，表结构见 d1/schema.sql）。
// 仅同源调用（不发 CORS 头），专用 token 鉴权；令牌校验先于任何数据库访问。
export default async function handler(req: Request, res: Response): Promise<unknown> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: '只支持 GET 和 PUT 请求' })
  }
  const db = req.env?.DB
  const token = process.env.PULSE_SYNC_TOKEN
  if (!db || !token || token.length < 32) return res.status(503).json({ error: '候选池同步服务尚未配置' })
  const received = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const expected = `Bearer ${token}`
  if (Buffer.byteLength(received) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    return res.status(401).json({ error: '同步 token 无效' })
  }

  let payload = req.body
  let revision = 0
  if (req.method === 'PUT') {
    const match = typeof req.headers['if-match'] === 'string' && /^"(\d+)"$/.exec(req.headers['if-match'])
    if (!match || !Number.isSafeInteger(Number(match[1]))) return res.status(428).json({ error: '请先读取云端版本后再同步' })
    revision = Number(match[1])
    try {
      const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload)
      if (!serialized || Buffer.byteLength(serialized) > 1_000_000) return res.status(413).json({ error: '同步数据过大' })
      if (typeof payload === 'string') payload = JSON.parse(payload)
    } catch {
      return res.status(400).json({ error: '同步数据必须为有效 JSON' })
    }
    if (!validCandidatesPayload(payload)) return res.status(400).json({ error: '候选池结构无效（最多 2000 条，不可重复）' })
  }

  try {
    if (req.method === 'GET') {
      const snapshot = await readSnapshot(db, 'candidates')
      if (!snapshot || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || !validCandidatesPayload(snapshot.payload)) {
        return res.status(502).json({ error: '云端数据结构无效，请检查数据库表结构' })
      }
      res.setHeader('ETag', `"${snapshot.revision}"`)
      res.setHeader('X-Revision', String(snapshot.revision))
      return res.status(200).json(snapshot.payload)
    }
    const result = await writeSnapshot(db, 'candidates', revision, payload)
    if (result === 'conflict') return res.status(409).json({ error: '其他设备已更新候选池，请刷新后重试' })
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(502).json({ error: '数据库请求失败，请稍后重试' })
  }
}
