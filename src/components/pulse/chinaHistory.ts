export type Period = 'day' | 'week' | 'month' | 'year'
export type HistorySymbol = 'sh000300' | 'sh000852' | 'sh000001' | 'sz399106' | 'sz399001' | 'sz399006'
export type HistoryCandle = { date: string; open: number; close: number; high: number; low: number; volume: number; amount?: number }
export const periods: { id: Period; label: string }[] = [
  { id: 'day', label: '日' }, { id: 'week', label: '周' }, { id: 'month', label: '月' }, { id: 'year', label: '年' },
]

export function parseHistory(raw: unknown): HistoryCandle[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error('行情源未返回历史数据，请稍后重试')
  const unique = new Map<string, HistoryCandle>()
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 6) throw new Error('历史行情格式不完整')
    const [date, ...values] = row
    const [open, close, high, low, volume] = values.slice(0, 5).map(Number)
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))
      || new Date(date).toISOString().slice(0, 10) !== date
      || values.slice(0, 5).some(v => v == null || String(v).trim() === '')
      || ![open, close, high, low, volume].every(Number.isFinite) || low <= 0 || volume < 0
      || low > Math.min(open, close) || high < Math.max(open, close)) throw new Error('历史行情包含无效数据，请刷新重试')
    // 腾讯 newfqkline 第九列为成交额，单位万元；旧接口没有该列。
    const amount = row[8] == null || String(row[8]).trim() === '' ? undefined : Number(row[8])
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) throw new Error('历史成交额包含无效数据，请刷新重试')
    unique.set(date, { date, open, close, high, low, volume, ...(amount === undefined ? {} : { amount }) })
  }
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function periodKey(date: string, period: Period): string {
  if (period === 'year') return date.slice(0, 4)
  if (period === 'month') return date.slice(0, 7)
  if (period === 'day') return date
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7)
  return d.toISOString().slice(0, 10)
}

export function aggregateCandles(rows: HistoryCandle[], period: Period): HistoryCandle[] {
  const grouped = new Map<string, HistoryCandle>()
  for (const row of rows) {
    const key = periodKey(row.date, period), previous = grouped.get(key)
    grouped.set(key, previous ? {
      date: row.date, open: previous.open, close: row.close,
      high: Math.max(previous.high, row.high), low: Math.min(previous.low, row.low), volume: previous.volume + row.volume,
      ...(previous.amount !== undefined && row.amount !== undefined ? { amount: previous.amount + row.amount } : {}),
    } : { ...row })
  }
  return [...grouped.values()]
}

// 腾讯指数历史成交量单位为手；一手=100股，一亿股=1,000,000手。
export function combineVolume(sh: HistoryCandle[], sz: HistoryCandle[], period: Period): HistoryCandle[] {
  return combineActivity(sh, sz, period, 'volume')
}

export function combineAmount(sh: HistoryCandle[], sz: HistoryCandle[], period: Period): HistoryCandle[] {
  if ([...sh, ...sz].some(r => r.amount === undefined || !Number.isFinite(r.amount) || r.amount < 0)) throw new Error('沪深成交额数据不完整')
  return combineActivity(sh, sz, period, 'amount')
}

function combineActivity(sh: HistoryCandle[], sz: HistoryCandle[], period: Period, metric: 'volume' | 'amount'): HistoryCandle[] {
  const label = metric === 'volume' ? '成交量' : '成交额'
  // 深证综指月线在 1993–1996 年有缺档，长周期只采用双方自 1997 年起的连续记录。
  if (period === 'year') return aggregateCandles(combineActivity(sh, sz, 'month', metric), 'year')
  if (period === 'month') {
    sh = sh.filter(r => r.date >= '1997-01-01')
    sz = sz.filter(r => r.date >= '1997-01-01')
  }
  const left = aggregateCandles(sh, period), right = aggregateCandles(sz, period)
  if (!left.length || !right.length) throw new Error(`沪深${label}数据不完整`)
  const start = [periodKey(left[0].date, period), periodKey(right[0].date, period)].sort()[1]
  const a = new Map(left.filter(r => periodKey(r.date, period) >= start).map(r => [periodKey(r.date, period), r]))
  const b = new Map(right.filter(r => periodKey(r.date, period) >= start).map(r => [periodKey(r.date, period), r]))
  if (!a.size || a.size !== b.size || [...a.keys()].some(k => !b.has(k))) throw new Error(`沪深${label}日期未对齐，请稍后刷新`)
  return [...a].map(([key, row]) => ({ ...row, date: row.date > b.get(key)!.date ? row.date : b.get(key)!.date,
    ...(metric === 'volume' ? { volume: (row.volume + b.get(key)!.volume) / 1_000_000 }
      : { amount: (row.amount! + b.get(key)!.amount!) / 10_000 }) }))
}

type HistoryResult = { rows: HistoryCandle[]; fetchedAt: string }
const cache = new Map<string, { at: number; result: HistoryResult }>()
const base = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export async function fetchHistory(symbol: HistorySymbol, period: Period, signal: AbortSignal, force = false, metric: 'volume' | 'amount' = 'volume'): Promise<HistoryResult> {
  const interval = period === 'year' ? 'month' : period
  const key = `${symbol}:${interval}:${metric}`
  const hit = cache.get(key)
  if (!force && hit && Date.now() - hit.at < 300_000) return hit.result
  const response = await fetch(`${base}/api/grid-market?${new URLSearchParams({ kind: metric === 'amount' ? 'index-amount-history' : 'index-history', symbol, period: interval })}`, { signal })
  if (!response.ok) throw new Error('历史行情暂时无法获取，请重试')
  const json = await response.json()
  const data = json.data?.[symbol]
  const result = { rows: parseHistory(data?.[interval] ?? data?.[`qfq${interval}`]), fetchedAt: new Date().toISOString() }
  cache.set(key, { at: Date.now(), result })
  return result
}
