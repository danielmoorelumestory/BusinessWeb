import { timingSafeEqual } from 'node:crypto'
import { validPulsePayload, type PulsePayload } from '../src/features/pulse/validation.js'
import { readSnapshot, writeSnapshot, type D1Like } from '../server/d1Snapshot.js'

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; env?: { DB?: D1Like } }
type Response = {
  setHeader(name: string, value: string): unknown
  status(code: number): Response
  json(body: unknown): unknown
}

// 有效（未标记删除）的复盘记录数，用于防大面积误删
const activeCount = (payload: PulsePayload): number => payload.reviews.filter(r => !('deleted' in r && r.deleted === true)).length

// 每日复盘云同步：整份快照 + 版本号乐观并发，存储在 Cloudflare D1（绑定名 DB，表结构见 d1/schema.sql）。
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
  if (!db || !token || token.length < 32) return res.status(503).json({ error: '复盘同步服务尚未配置' })
  const received = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const expected = `Bearer ${token}`
  if (Buffer.byteLength(received) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    return res.status(401).json({ error: '同步 token 无效' })
  }

  let payload = req.body
  let revision = 0
  let allowShrink = false
  if (req.method === 'PUT') {
    const match = typeof req.headers['if-match'] === 'string' && /^"(\d+)"$/.exec(req.headers['if-match'])
    if (!match || !Number.isSafeInteger(Number(match[1]))) return res.status(428).json({ error: '请先读取云端版本后再同步' })
    revision = Number(match[1])
    allowShrink = req.headers['x-allow-shrink'] === '1'
    try {
      const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload)
      if (!serialized || Buffer.byteLength(serialized) > 1_000_000) return res.status(413).json({ error: '同步数据过大' })
      if (typeof payload === 'string') payload = JSON.parse(payload)
    } catch {
      return res.status(400).json({ error: '同步数据必须为有效 JSON' })
    }
    if (!validPulsePayload(payload)) return res.status(400).json({ error: '复盘记录结构或数值无效（最多 500 条）' })
  }

  try {
    const current = await readSnapshot(db, 'pulse')
    if (!current || !Number.isSafeInteger(current.revision) || current.revision < 0 || !validPulsePayload(current.payload)) {
      return res.status(502).json({ error: '云端数据结构无效，请检查数据库表结构' })
    }
    if (req.method === 'GET') {
      res.setHeader('ETag', `"${current.revision}"`)
      return res.status(200).json(current.payload)
    }
    if (current.revision !== revision) return res.status(409).json({ error: '其他设备已更新云端复盘，请重新同步' })
    // 现有有效记录不少于 6 条，且新数据的有效记录少于一半，除非显式允许，否则拒绝
    const before = activeCount(current.payload)
    if (!allowShrink && before >= 6 && activeCount(payload as PulsePayload) * 2 < before) {
      return res.status(422).json({ error: '本次同步会让云端有效记录减少超过一半，已拒绝；确认无误请显式允许' })
    }
    // 读取与写入之间若被其他设备更新，带版本号条件的写入会返回 conflict，不会误覆盖
    const result = await writeSnapshot(db, 'pulse', revision, payload, { keepHistory: true })
    if (result === 'conflict') return res.status(409).json({ error: '其他设备已更新云端复盘，请重新同步' })
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(502).json({ error: '数据库请求失败，请稍后重试' })
  }
}
