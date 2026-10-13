const symbolPattern = /^(sh|sz)\d{6}$/
const quoteSymbolPattern = /^(?:(sh|sz)\d{6}|r_hk\d{5}|us[A-Z0-9.]{1,10})$/
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

export async function handleMarket(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: '只支持 GET 请求' })
  }
  const { kind, symbol, symbols, begin, end, period } = req.query
  let url
  if (kind === 'quotes' && typeof symbols === 'string' && symbols.length <= 899
    && symbols.split(',').length <= 100 && symbols.split(',').every(s => quoteSymbolPattern.test(s))) {
    url = `https://qt.gtimg.cn/q=${symbols}`
  } else if (kind === 'candles' && typeof symbol === 'string' && symbolPattern.test(symbol)
    && validDate(begin) && validDate(end) && begin <= end) {
    url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?${new URLSearchParams({ param: `${symbol},day,${begin},${end},640,qfq` })}`
  } else if (kind === 'index-history' && ['sh000300', 'sh000852', 'sh000001', 'sz399106', 'sz399001', 'sz399006'].includes(symbol)
    && ['day', 'week', 'month'].includes(period)) {
    url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?${new URLSearchParams({ param: `${symbol},${period},,,${period === 'month' ? 800 : 640},qfq` })}`
  } else if (kind === 'index-amount-history' && ['sh000001', 'sz399106'].includes(symbol)
    && ['day', 'week', 'month'].includes(period)) {
    url = `https://web.ifzq.gtimg.cn/appstock/app/newfqkline/get?${new URLSearchParams({ param: `${symbol},${period},,,${period === 'month' ? 800 : 640},qfq` })}`
  } else {
    return res.status(400).json({ error: '行情查询参数无效' })
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7_000)
  try {
    const upstream = await fetch(url, { signal: controller.signal, redirect: 'error' })
    if (!upstream.ok) return res.status(502).json({ error: '行情源暂时不可用' })
    if (kind === 'quotes') {
      const bytes = Buffer.from(await upstream.arrayBuffer())
      res.setHeader('Content-Type', 'text/plain; charset=gbk')
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30')
      return res.status(200).send(bytes)
    }
    const payload = await upstream.json()
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300')
    return res.status(200).json(payload)
  } catch {
    return res.status(controller.signal.aborted ? 504 : 502).json({ error: controller.signal.aborted ? '行情源请求超时' : '行情源暂时不可用' })
  } finally {
    clearTimeout(timer)
  }
}

export function marketMiddleware(req, res, next) {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname !== '/api/grid-market') return next()
  const query = Object.fromEntries(url.searchParams)
  for (const key of url.searchParams.keys()) if (url.searchParams.getAll(key).length > 1) query[key] = undefined
  const adapter = {
    setHeader: (key, value) => res.setHeader(key, value),
    status(code) { res.statusCode = code; return this },
    json(payload) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(payload)) },
    send(payload) { res.end(payload) },
  }
  void handleMarket({ method: req.method, query }, adapter)
}
