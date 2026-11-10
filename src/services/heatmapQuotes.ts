import type { HeatmapStock } from '../components/pulse/IndexHeatmap'

export async function fetchHeatmapQuotes(stocks: HeatmapStock[], fetchImpl: typeof fetch = fetch): Promise<HeatmapStock[]> {
  if (!stocks.length) throw new Error('没有有效成分股')
  const symbolOf = (s: HeatmapStock) => {
    if (s.ticker.startsWith('HKEX:')) return `r_hk${s.code}`
    if (s.ticker.startsWith('SSE:')) return `sh${s.code}`
    if (s.ticker.startsWith('SZSE:')) return `sz${s.code}`
    return `us${s.code}` // 美股（NASDAQ/NYSE/AMEX…），腾讯行情时间为美东时间
  }
  const quotes = new Map<string, { close: number; change: number; quoteTime: string }>()
  const base = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
  for (let offset = 0; offset < stocks.length; offset += 80) {
    const symbols = stocks.slice(offset, offset + 80).map(symbolOf).join(',')
    const url = `${base}/api/grid-market?${new URLSearchParams({ kind: 'quotes', symbols })}`
    const response = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`最新报价请求失败 HTTP ${response.status}`)
    const text = new TextDecoder('gbk').decode(await response.arrayBuffer())
    for (const match of text.matchAll(/v_((?:sh|sz)\d{6}|r_hk\d{5}|us[A-Z0-9.]{1,10})="([^"]*)"/g)) {
      const fields = match[2].split('~')
      const stamp = (fields[30] ?? '').replace(/\D/g, '')
      const close = Number(fields[3]), change = Number(fields[32])
      if (!/^\d{14}$/.test(stamp) || !fields[32]?.trim() || !Number.isFinite(close) || close <= 0 || !Number.isFinite(change)) continue
      quotes.set(match[1], { close, change, quoteTime: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} ${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}` })
    }
  }
  if (!quotes.size) throw new Error('最新行情缺少有效报价')
  // 缺失个股显示为未知，不能混入 scanner 的旧价格。
  return stocks.map(stock => ({ ...stock, ...(quotes.get(symbolOf(stock)) ?? { close: null, change: null, quoteTime: undefined }) }))
}
