import { timingSafeEqual } from 'node:crypto'
import { validCandidatesPayload } from '../src/features/candidates/validation.js'

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type Response = {
  setHeader(name: string, value: string): unknown
  status(code: number): Response
  json(body: unknown): unknown
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

// 研究笔记候选池云同步：整份快照 + 版本号乐观并发。仅同源调用（不发 CORS 头），专用 token 鉴权，
// 服务端密钥只在 Vercel 环境变量中，数据库对 anon/authenticated 全部撤权（见迁移文件）。
export default async function handler(req: Request, res: Response): Promise<unknown> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: '只支持 GET 和 PUT 请求' })
  }
  const { SUPABASE_URL: base, SUPABASE_SECRET_KEY: key, PULSE_SYNC_TOKEN: token } = process.env
  let origin: string
  try {
    const url = new URL(base ?? '')
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port) throw new Error()
    origin = url.origin
  } catch {
    return res.status(503).json({ error: '候选池同步服务尚未配置' })
  }
  if (!key || !token || token.length < 32) return res.status(503).json({ error: '候选池同步服务尚未配置' })
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

  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' }
  if (!key.startsWith('sb_secret_')) headers.authorization = `Bearer ${key}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6_000)
  try {
    const read = req.method === 'GET'
    const upstream = await fetch(read
      ? `${origin}/rest/v1/businessweb_candidates_snapshot?id=eq.1&select=revision,payload`
      : `${origin}/rest/v1/rpc/businessweb_put_candidates_snapshot`, {
      method: read ? 'GET' : 'POST', headers, signal: controller.signal, redirect: 'error',
      ...(read ? {} : { body: JSON.stringify({ expected_revision: revision, next_payload: payload }) }),
    })
    if (!upstream.ok) return res.status(502).json({ error: '数据库暂时不可用，请检查服务配置' })
    const data: unknown = await upstream.json()
    if (read) {
      const snapshot = Array.isArray(data) && data.length === 1 ? data[0] : null
      if (!object(snapshot) || !Number.isSafeInteger(snapshot.revision) || Number(snapshot.revision) < 0 || !validCandidatesPayload(snapshot.payload)) {
        return res.status(502).json({ error: '云端数据结构无效，请检查数据库迁移' })
      }
      res.setHeader('ETag', `"${snapshot.revision}"`)
      res.setHeader('X-Revision', String(snapshot.revision))
      return res.status(200).json(snapshot.payload)
    }
    if (data === 'conflict') return res.status(409).json({ error: '其他设备已更新候选池，请刷新后重试' })
    if (data !== 'ok') return res.status(502).json({ error: '云端写入响应无效' })
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(controller.signal.aborted ? 504 : 502).json({ error: '数据库请求失败，请稍后重试' })
  } finally {
    clearTimeout(timer)
  }
}
