import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/china-stock.js'
import { handleMarket } from '../../server/market.mjs'

function response() {
  return {
    statusCode: 200, headers: {} as Record<string, string>, body: undefined as unknown,
    setHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value },
    status(code: number) { this.statusCode = code; return this },
    json(body: unknown) { this.body = body; return this },
    send(body: unknown) { this.body = body; return this },
    end(body?: unknown) { this.body = body; return this },
  }
}
afterEach(() => vi.unstubAllGlobals())
describe('restricted market APIs', () => {
  it('成交额历史只允许沪深综合指数，转发包含实际成交额的腾讯接口', async () => {
    const fetchImpl = vi.fn(async (_url: string) => new Response(JSON.stringify({ data: {} })))
    vi.stubGlobal('fetch', fetchImpl)
    for (const symbol of ['sh000001', 'sz399106']) {
      for (const period of ['day', 'week', 'month']) {
        const res = response()
        await handleMarket({ method: 'GET', query: { kind: 'index-amount-history', symbol, period } }, res)
        expect(res.statusCode).toBe(200)
        const url = new URL(fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1][0])
        expect(url.pathname).toBe('/appstock/app/newfqkline/get')
        expect(url.searchParams.get('param')).toBe(`${symbol},${period},,,${period === 'month' ? 800 : 640},qfq`)
      }
    }
    fetchImpl.mockClear()
    for (const query of [
      { kind: 'index-amount-history', symbol: 'sh000300', period: 'day' },
      { kind: 'index-amount-history', symbol: 'sh000001', period: 'year' },
      { kind: 'index-amount-history', symbol: ['sh000001'], period: 'day' },
    ]) {
      const res = response()
      await handleMarket({ method: 'GET', query }, res)
      expect(res.statusCode).toBe(400)
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('提供白名单指数的日周月历史，拒绝其他证券及任意周期', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {} }))))
    const accepted = response()
    await handleMarket({ method: 'GET', query: { kind: 'index-history', symbol: 'sh000852', period: 'month' } }, accepted)
    expect(accepted.statusCode).toBe(200)
    for (const symbol of ['sz399001', 'sz399006']) {
      const ok = response(); await handleMarket({ method: 'GET', query: { kind: 'index-history', symbol, period: 'day' } }, ok)
      expect(ok.statusCode).toBe(200)
    }
    for (const query of [
      { kind: 'index-history', symbol: 'sh600000', period: 'day' },
      { kind: 'index-history', symbol: 'sh000300', period: 'year' },
      { kind: 'index-history', symbol: 'sh000300', period: ['day'] },
    ]) {
      const rejected = response(); await handleMarket({ method: 'GET', query }, rejected)
      expect(rejected.statusCode).toBe(400)
    }
  })
  it('rejects unsupported methods and invalid symbols before fetching', async () => {
    const fetchImpl = vi.fn(); vi.stubGlobal('fetch', fetchImpl)
    for (const query of [{ symbol: 'http://localhost' }, { symbol: ['sh000001'] }, { symbol: 'sh000001&list=sz000001' }]) {
      const res = response(); await handler({ method: 'GET', query }, res)
      expect(res.statusCode).toBe(400)
    }
    const res = response(); await handler({ method: 'POST', query: { symbol: 'sh000001' } }, res)
    expect(res.statusCode).toBe(405)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('decodes Sina GBK bytes into UTF-8 text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0xbb, 0xa6, 0xc9, 0xee]))))
    const res = response(); await handler({ method: 'GET', query: { symbol: 'sh000001' } }, res)
    expect(res.body).toBe('沪深')
  })
  it('restricts Tencent query inputs and never accepts an arbitrary upstream URL', async () => {
    const fetchImpl = vi.fn(); vi.stubGlobal('fetch', fetchImpl)
    for (const query of [
      { kind: 'unknown' }, { kind: 'quotes', symbols: 'http://localhost' },
      { kind: 'candles', symbol: 'sh510300', begin: '2026-02-30', end: '2026-03-01' },
      { kind: 'candles', symbol: 'sh510300', begin: '2026-03-02', end: '2026-03-01' },
    ]) {
      const res = response(); await handleMarket({ method: 'GET', query }, res)
      expect(res.statusCode).toBe(400)
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('preserves Tencent GBK quote bytes and targets the fixed quote host', async () => {
    const bytes = new Uint8Array([0xbb, 0xa6, 0xc9, 0xee])
    const fetchImpl = vi.fn(async () => new Response(bytes)); vi.stubGlobal('fetch', fetchImpl)
    const res = response(); await handleMarket({ method: 'GET', query: { kind: 'quotes', symbols: 'sh510300,sz159915' } }, res)
    expect(new Uint8Array(res.body as Buffer)).toEqual(bytes)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://qt.gtimg.cn/q=sh510300,sz159915')
    expect(res.headers['cache-control']).toContain('s-maxage=30')
  })
  it('returns candle JSON from the fixed history host', async () => {
    const data = { data: { sh510300: { qfqday: [] } } }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(data))); vi.stubGlobal('fetch', fetchImpl)
    const res = response(); await handleMarket({ method: 'GET', query: { kind: 'candles', symbol: 'sh510300', begin: '2020-01-01', end: '2026-10-02' } }, res)
    expect(res.body).toEqual(data)
    const url = new URL(fetchImpl.mock.calls[0][0])
    expect(url.hostname).toBe('web.ifzq.gtimg.cn')
    expect(url.searchParams.get('param')).toBe('sh510300,day,2020-01-01,2026-10-02,640,qfq')
  })
  it('允许港股即时报价，仍拒绝港股日线及注入参数', async () => {
    const f = vi.fn(async (_url: string) => new Response('v_r_hk00700=""')); vi.stubGlobal('fetch', f)
    const res = response()
    await handleMarket({ method: 'GET', query: { kind: 'quotes', symbols: 'r_hk00700,r_hk00005' } }, res)
    expect(res.statusCode).toBe(200)
    expect(f.mock.calls[0][0]).toBe('https://qt.gtimg.cn/q=r_hk00700,r_hk00005')
    for (const query of [{ kind: 'quotes', symbols: 'r_hk00700&x=1' }, { kind: 'candles', symbol: 'r_hk00700', begin: '2026-01-01', end: '2026-10-02' }]) {
      const rejected = response(); await handleMarket({ method: 'GET', query }, rejected)
      expect(rejected.statusCode).toBe(400)
    }
  })
  it('reports upstream failures without exposing exception details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('secret upstream detail') }))
    const res = response(); await handleMarket({ method: 'GET', query: { kind: 'quotes', symbols: 'sh510300' } }, res)
    expect(res.statusCode).toBe(502)
    expect(JSON.stringify(res.body)).not.toContain('secret')
  })
  it('returns 502 for upstream HTTP errors and 504 for a timed-out request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })))
    const res = response(); await handleMarket({ method: 'GET', query: { kind: 'quotes', symbols: 'sh510300' } }, res)
    expect(res.statusCode).toBe(502)
    vi.useFakeTimers()
    try {
      vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))))
      const timed = response()
      const pending = handleMarket({ method: 'GET', query: { kind: 'quotes', symbols: 'sh510300' } }, timed)
      await vi.advanceTimersByTimeAsync(7_001)
      await pending
      expect(timed.statusCode).toBe(504)
    } finally { vi.useRealTimers() }
  })
})
