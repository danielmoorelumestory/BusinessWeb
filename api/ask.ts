// AI 试问：Google / GitHub 登录（Supabase Auth）后，每人每天 DAILY_LIMIT 次。
// 模型 key 只存在服务端环境变量里，浏览器拿不到。
import { createHash } from 'node:crypto'

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type Response = {
  setHeader(name: string, value: string): unknown
  status(code: number): Response
  json(body: unknown): unknown
  write(chunk: string): unknown
  end(): unknown
}

const DAILY_LIMIT = 2
// 同一 IP 每天上限（防多账号刷）与全站每天总上限（封顶月成本）；可用环境变量调整。
const IP_LIMIT = Number(process.env.ASK_IP_LIMIT) || 6
const GLOBAL_LIMIT = Number(process.env.ASK_GLOBAL_LIMIT) || 300
const MAX_QUESTION = 500
const MAX_TOKENS = 700
const DEFAULT_MODEL_BASE = 'https://api.minimaxi.com/anthropic'
const DEFAULT_MODEL = 'MiniMax-M2'
const SYSTEM_PROMPT = [
  '你是「AI 实验室」的研究方法助手，只回答与投资研究方法、AI 工具使用、Skill 与提示词设计相关的问题。',
  '与此无关的问题，礼貌说明范围并拒绝。回答用中文，简洁，不超过 400 字。',
  '不给出具体的买入、卖出或仓位建议；涉及股票时只讲分析方法，并在末尾注明「以上仅为研究方法，不构成投资建议」。',
  '不要编造数据或来源；不确定时直接说明。',
].join('\n')

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? ''
const httpsOrigin = (value: string | undefined, suffix?: string): string | null => {
  try {
    const url = new URL(value ?? '')
    if (url.protocol !== 'https:' || url.username || url.password || (suffix && !url.hostname.endsWith(suffix))) return null
    return url.origin + url.pathname.replace(/\/$/, '')
  } catch {
    return null
  }
}

export default async function handler(req: Request, res: Response): Promise<unknown> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Vary', 'Origin')
  const origin = first(req.headers.origin)
  if (['https://business-web-black.vercel.app', 'https://turbosnails.github.io', 'http://localhost:5173'].includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  } else if (origin) {
    return res.status(403).json({ error: '不支持此来源' })
  }
  if (req.method === 'OPTIONS') return res.status(204).json({})
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: '只支持 GET / POST 请求' })
  }
  const { SUPABASE_URL, SUPABASE_SECRET_KEY: secret, SUPABASE_ANON_KEY: anon, MINIMAX_API_KEY: modelKey } = process.env
  const supabase = httpsOrigin(SUPABASE_URL, '.supabase.co')
  const modelBase = httpsOrigin(process.env.MINIMAX_BASE_URL || DEFAULT_MODEL_BASE)
  if (!supabase || !secret || !anon || !modelKey || !modelBase) return res.status(503).json({ error: 'AI 试问尚未配置' })

  const auth = first(req.headers.authorization)
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return res.status(401).json({ error: '请先登录' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
  const question = body && typeof body === 'object' && 'question' in body ? String((body as { question: unknown }).question).trim() : ''
  if (req.method === 'POST' && (question.length < 2 || question.length > MAX_QUESTION)) return res.status(400).json({ error: `问题长度需在 2–${MAX_QUESTION} 字之间` })

  const forwarded = first(req.headers['x-forwarded-for']).split(',')[0].trim() || first(req.headers['x-real-ip']).trim()
  const ip = createHash('sha256').update(`ask:${forwarded || 'unknown'}:${secret}`).digest('hex')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 50_000)
  const service = { apikey: secret, 'content-type': 'application/json', ...(secret.startsWith('sb_secret_') ? {} : { authorization: `Bearer ${secret}` }) }
  const rpc = (name: string, args: Record<string, unknown>, signal = controller.signal) =>
    fetch(`${supabase}/rest/v1/rpc/${name}`, { method: 'POST', headers: service, body: JSON.stringify(args), signal, redirect: 'error' })

  try {
    // 用用户自己的 token 向 Supabase 确认身份，不信任前端传来的任何 user id。
    const who = await fetch(`${supabase}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` }, signal: controller.signal, redirect: 'error' })
    if (!who.ok) return res.status(401).json({ error: '登录已过期，请重新登录' })
    const user = (await who.json()) as { id?: string }
    if (!user.id) return res.status(401).json({ error: '登录已过期，请重新登录' })

    // 扣款与退款使用同一个北京时间日期，避免午夜后退错日期。
    const day = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const remaining = async (): Promise<number | null> => {
      try {
        const query = `user_id=eq.${encodeURIComponent(user.id!)}&day=eq.${day}&select=used`
        const rows = await fetch(`${supabase}/rest/v1/businessweb_ask_usage?${query}`, { headers: service, signal: controller.signal, redirect: 'error' })
        if (!rows.ok) return null
        const used = Number(((await rows.json()) as { used?: number }[])[0]?.used ?? 0)
        return Math.max(DAILY_LIMIT - used, 0)
      } catch { return null }
    }
    if (req.method === 'GET') {
      const left = await remaining()
      return left === null ? res.status(502).json({ error: '计次服务暂时不可用' }) : res.status(200).json({ limit: DAILY_LIMIT, remaining: left })
    }
    const consumed = await rpc('businessweb_consume_ask', { p_user: user.id, p_ip: ip, p_user_limit: DAILY_LIMIT, p_ip_limit: IP_LIMIT, p_global_limit: GLOBAL_LIMIT, p_day: day })
    if (!consumed.ok) return res.status(502).json({ error: '计次服务暂时不可用' })
    const verdict = await consumed.json()
    if (verdict === 'global') return res.status(429).json({ error: '今天的试问名额已被抢完，明天再来' })
    if (verdict === 'ip') return res.status(429).json({ error: '当前网络今天的试问次数已用完，明天再来' })
    if (verdict === 'user') return res.status(429).json({ error: `今天的 ${DAILY_LIMIT} 次试问已用完，明天再来`, remaining: 0 })
    if (verdict !== 'ok') return res.status(502).json({ error: '计次服务暂时不可用' })

    const refund = async () => {
      // 模型请求超时后，退款仍需自己的执行时间。
      const refundController = new AbortController()
      const refundTimer = setTimeout(() => refundController.abort(), 4_000)
      try {
        const result = await rpc('businessweb_refund_ask', { p_user: user.id, p_ip: ip, p_day: day }, refundController.signal)
        return result.ok
      } catch { return false }
      finally { clearTimeout(refundTimer) }
    }
    let model: globalThis.Response
    try {
      model = await fetch(`${modelBase}/v1/messages`, {
        method: 'POST',
        headers: { 'x-api-key': modelKey, authorization: `Bearer ${modelKey}`, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.MINIMAX_MODEL || DEFAULT_MODEL, max_tokens: MAX_TOKENS, stream: true, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: question }] }),
        signal: controller.signal,
        redirect: 'error',
      })
      if (!model.ok || !model.body) throw new Error('model')
    } catch {
      const refunded = await refund()
      return res.status(502).json({ error: refunded ? 'AI 暂时无法回答，这次不扣次数' : 'AI 暂时无法回答，额度退还未确认，请稍后联系站点作者' })
    }

    // 以 NDJSON 逐行推送：phase（阶段）/ delta（回答片段）/ done / error，前端据此持续刷新状态。
    res.status(200)
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('X-Accel-Buffering', 'no')
    const send = (event: Record<string, unknown>) => res.write(JSON.stringify(event) + '\n')
    send({ type: 'phase', phase: 'model' })
    let reply = ''
    let thinking = false
    try {
      const reader = model.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          let event: { type?: string; content_block?: { type?: string }; delta?: { type?: string; text?: string } }
          try { event = JSON.parse(line.slice(5).trim()) } catch { continue }
          if (event.type === 'error') throw new Error('model')
          const isThinking = event.content_block?.type === 'thinking' || event.delta?.type === 'thinking_delta'
          if (isThinking && !thinking && !reply) { thinking = true; send({ type: 'phase', phase: 'thinking' }) }
          if (event.delta?.type === 'text_delta' && event.delta.text) {
            if (!reply) send({ type: 'phase', phase: 'writing' })
            reply += event.delta.text
            send({ type: 'delta', text: event.delta.text })
          }
        }
      }
      if (!reply.trim()) throw new Error('empty')
    } catch {
      const refunded = await refund()
      send({ type: 'error', error: refunded ? 'AI 回答中断，这次不扣次数' : 'AI 回答中断，额度退还未确认，请稍后联系站点作者' })
      return res.end()
    }
    send({ type: 'done', limit: DAILY_LIMIT, remaining: await remaining() })
    return res.end()
  } catch {
    return res.status(502).json({ error: '服务暂时不可用' })
  } finally {
    clearTimeout(timer)
  }
}
