import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/ask'

function response() {
  return { code: 200, body: {} as Record<string, unknown>, headers: {} as Record<string, string>,
    setHeader(key: string, value: string) { this.headers[key] = value },
    status(code: number) { this.code = code; return this },
    json(body: Record<string, unknown>) { this.body = body; return this },
  }
}
const request = { method: 'POST', headers: { authorization: 'Bearer test-user-token' }, body: { question: '怎样做三情景估值？' } }

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test')
  vi.stubEnv('SUPABASE_ANON_KEY', 'public-test')
  vi.stubEnv('MINIMAX_API_KEY', 'model-test')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('AI 试问', () => {
  it('模型超时后仍能退还已扣的额度', async () => {
    vi.useFakeTimers()
    let used = 0
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      init.signal?.throwIfAborted()
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' })
      if (url.includes('consume_ask')) { used++; return Response.json('ok') }
      if (url.includes('refund_ask')) { used--; return new Response(null, { status: 204 }) }
      return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true }))
    })
    const res = response()
    const pending = handler(request, res)
    await vi.advanceTimersByTimeAsync(50_001)
    await pending
    expect(res.code).toBe(502)
    expect(used).toBe(0)
  })

  it('跨北京时间零点的失败请求退回扣款日的额度', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T15:59:59.000Z'))
    const balances = new Map<string, number>()
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' })
      const args = JSON.parse(String(init.body || '{}'))
      if (url.includes('consume_ask')) {
        balances.set(args.p_day || '2026-10-12', 1)
        return Response.json('ok')
      }
      if (url.includes('refund_ask')) {
        const day = args.p_day || '2026-10-13'
        balances.set(day, Math.max(0, (balances.get(day) || 0) - 1))
        return new Response(null, { status: 204 })
      }
      vi.setSystemTime(new Date('2026-10-12T16:00:01.000Z'))
      return new Response(null, { status: 503 })
    })
    const res = response()
    await handler(request, res)
    expect(res.code).toBe(502)
    expect(balances.get('2026-10-12')).toBe(0)
  })

  it('GitHub Pages 的预检通过后可调用问答接口', async () => {
    const res = response()
    await handler({ method: 'OPTIONS', headers: { origin: 'https://turbosnails.github.io' } }, res)
    expect(res.code).toBe(204)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://turbosnails.github.io')
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Authorization')
  })
})
