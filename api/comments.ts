import { createHash, timingSafeEqual } from 'node:crypto'

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined>; body?: unknown }
type Response = {
  setHeader(name: string, value: string): unknown
  status(code: number): Response
  json(body: unknown): unknown
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? ''
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
const HOURLY_LIMIT = 5
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 160 && slug.endsWith('.md') && !CONTROL.test(slug) && !/[/\\]/.test(slug)
}

export default async function handler(req: Request, res: Response): Promise<unknown> {
  res.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).json({ error: '不支持的请求方法' })
  }
  const { SUPABASE_URL: base, SUPABASE_SECRET_KEY: key } = process.env
  let origin: string
  try {
    const url = new URL(base ?? '')
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port) throw new Error()
    origin = url.origin
  } catch {
    return res.status(503).json({ error: '评论服务尚未配置' })
  }
  if (!key) return res.status(503).json({ error: '评论服务尚未配置' })

  // 带 Authorization 的请求视为管理员请求：查看全部状态、通过/驳回、删除。
  const adminRequest = req.method === 'PATCH' || req.method === 'DELETE' || typeof req.headers.authorization === 'string'
  if (adminRequest) {
    const token = process.env.COMMENTS_ADMIN_TOKEN
    if (!token || token.length < 32) return res.status(503).json({ error: '管理员 token 尚未配置' })
    const received = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
    const expected = `Bearer ${token}`
    if (Buffer.byteLength(received) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
      return res.status(401).json({ error: '管理员 token 无效' })
    }
  }

  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' }
  if (!key.startsWith('sb_secret_')) headers.authorization = `Bearer ${key}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6_000)
  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${origin}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers }, signal: controller.signal, redirect: 'error' })

  try {
    if (req.method === 'PATCH' || req.method === 'DELETE') {
      let body = req.body
      if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
      const id = req.method === 'DELETE' ? first(req.query?.id) : object(body) && typeof body.id === 'string' ? body.id : ''
      if (!UUID.test(id)) return res.status(400).json({ error: '评论 id 无效' })
      let init: RequestInit = { method: 'DELETE', headers: { prefer: 'return=representation' } }
      if (req.method === 'PATCH') {
        const status = object(body) ? body.status : undefined
        if (status !== 'approved' && status !== 'rejected' && status !== 'pending') return res.status(400).json({ error: '状态无效' })
        init = { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ status }) }
      }
      const upstream = await call(`businessweb_comments?id=eq.${id}&select=id`, init)
      if (!upstream.ok) return res.status(502).json({ error: '评论数据库暂时不可用' })
      const rows: unknown = await upstream.json()
      if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: '评论不存在' })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'GET') {
      const slug = first(req.query?.slug)
      if (!validSlug(slug)) return res.status(400).json({ error: '章节参数无效' })
      const upstream = await call(adminRequest
        ? `businessweb_comments?slug=eq.${encodeURIComponent(slug)}&select=id,nickname,content,status,created_at&order=created_at.asc&limit=500`
        : `businessweb_comments?slug=eq.${encodeURIComponent(slug)}&status=eq.approved&select=id,nickname,content,created_at&order=created_at.asc&limit=200`)
      if (!upstream.ok) return res.status(502).json({ error: '评论数据库暂时不可用' })
      const data: unknown = await upstream.json()
      if (!Array.isArray(data)) return res.status(502).json({ error: '评论数据结构无效' })
      return res.status(200).json({ comments: data })
    }

    let body = req.body
    if (typeof body === 'string') {
      if (body.length > 10_000) return res.status(413).json({ error: '提交内容过大' })
      try { body = JSON.parse(body) } catch { return res.status(400).json({ error: '提交内容必须为有效 JSON' }) }
    }
    if (!object(body)) return res.status(400).json({ error: '提交内容无效' })
    // 蜜罐：真人看不到这个字段；机器人填了就假装成功，不入库。
    if (typeof body.website === 'string' && body.website.trim()) return res.status(201).json({ ok: true, message: '已提交，审核通过后显示' })

    const slug = typeof body.slug === 'string' ? body.slug : ''
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const nickname = typeof body.nickname === 'string' && body.nickname.trim() ? body.nickname.trim() : '匿名读者'
    if (!validSlug(slug)) return res.status(400).json({ error: '章节参数无效' })
    if (content.length < 2 || content.length > 1000) return res.status(400).json({ error: '评论内容需要 2 到 1000 个字' })
    if (nickname.length > 20) return res.status(400).json({ error: '昵称最多 20 个字' })
    if (CONTROL.test(content) || CONTROL.test(nickname)) return res.status(400).json({ error: '内容包含无效字符' })
    if ((content.match(/https?:\/\/|www\./gi) ?? []).length > 1) return res.status(400).json({ error: '评论中请不要放多个链接' })

    const forwarded = first(req.headers['x-forwarded-for']).split(',')[0].trim()
    const ip = first(req.headers['x-real-ip']) || forwarded || 'unknown'
    const ipHash = createHash('sha256').update(`${ip}:${key}`).digest('hex')

    const since = new Date(Date.now() - 3_600_000).toISOString()
    const recent = await call(`businessweb_comments?ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=${HOURLY_LIMIT}`)
    if (!recent.ok) return res.status(502).json({ error: '评论数据库暂时不可用' })
    const recentRows: unknown = await recent.json()
    if (Array.isArray(recentRows) && recentRows.length >= HOURLY_LIMIT) return res.status(429).json({ error: '提交太频繁，请一小时后再试' })

    const insert = await call('businessweb_comments', {
      method: 'POST', headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ slug, nickname, content, ip_hash: ipHash }),
    })
    if (!insert.ok) return res.status(502).json({ error: '评论保存失败，请稍后重试' })
    return res.status(201).json({ ok: true, message: '已提交，审核通过后显示' })
  } catch {
    return res.status(controller.signal.aborted ? 504 : 502).json({ error: '评论数据库请求失败，请稍后重试' })
  } finally {
    clearTimeout(timer)
  }
}
