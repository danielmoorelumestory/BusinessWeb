// Usage: node scripts/generate-etf-technical.mjs 2026-10-16
// Uses full cached source series, not the archive's truncated last270Bars.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { aggregateBars, technicalState } from './etf-technical.mjs'
const root = process.cwd()
const date = process.argv[2]
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error('Provide an as-of date')
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const archive = read(`public/data/investment-market-refresh-${date}.json`)
const evidence = [], records = {}
for (const item of archive.records) {
  if (item.series || item.stockTrendApplicable === false) {
    records[item.code] = { applicable: false, reason: item.series ? '场外债基按净值申赎，此处不套用场内价格技术信号' : '货币ETF不适用股票式技术信号' }
    continue
  }
  const raw = read(`../tmp/market-refresh-${date}/${item.code}.json`)
  const basis = raw.data.qfqday?.length ? 'qfqday' : 'day'
  const bars = raw.data[basis].filter(bar => bar[0] <= date).map(bar => bar.slice(0, 6))
  // Some providers return the final daily bar only in the quote at refresh time.
  if (bars[bars.length - 1][0] < date && item.appendedQuote) bars.push(item.last270Bars[item.last270Bars.length - 1])
  if (bars[bars.length - 1][0] !== date || Number(bars[bars.length - 1][2]) !== item.close) throw new Error(`${item.code}: stale or mismatched close`)
  if (new Set(bars.map(bar => bar[0])).size !== bars.length) throw new Error(`${item.code}: duplicate dates`)
  const weekly = aggregateBars(bars, 'week'), monthly = aggregateBars(bars, 'month')
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const followingDay = new Date(`${date}T00:00:00Z`); followingDay.setUTCDate(followingDay.getUTCDate() + 1)
  const monthComplete = followingDay.toISOString().slice(0, 7) !== date.slice(0, 7)
  const state = { applicable: true, day: technicalState(bars), week: technicalState(weekly, weekday === 5), month: technicalState(monthly, monthComplete) }
  records[item.code] = state
  evidence.push({ code: item.code, sourceUrl: raw.sourceUrl, retrievedAt: raw.retrievedAt, priceSeries: basis, dailyBars: bars, ...state })
}
const methodology = {
  ma: 'Close > MA5 > MA10 > MA20: 多头; reverse: 空头; otherwise 震荡. At least 20 bars.',
  macd: 'DIF=EMA12-EMA26; DEA=EMA9(DIF); histogram=2*(DIF-DEA). EMA seeded with first close, DEA with 0. 金叉/死叉 only on latest crossover, otherwise 偏多/偏空 by DIF vs DEA. At least 26 bars; fewer than 60 flagged as limited initialization history.',
  rsi: 'Wilder RSI14; first 14 changes seed mean gain/loss; subsequent (previous*13+change)/14. Flat=50. <=30 超卖; >=70 超买; 30..50 偏弱; 50..70 偏强.',
  aggregation: 'Week uses Monday-Sunday; month uses calendar month. Each period uses its own closes. Current incomplete week/month is provisional; completion flag is conservative (Friday/calendar month end), not an exchange holiday calendar.',
  sources: 'Uses each cached series as returned, qfqday where available else day. Not standardized across adjustment bases; check per-record priceSeries. Cash and OTC bond funds excluded.'
}
const archivePath = `/data/etf-technical-${date}.json`
writeFileSync(resolve(root, `public${archivePath}`), JSON.stringify({ asOf: date, methodology, records: evidence }, null, 2) + '\n')
writeFileSync(resolve(root, 'src/data/etfTechnical.json'), JSON.stringify({ asOf: date, archivePath, records }, null, 2) + '\n')
console.log(`Generated ${Object.keys(records).length} records (${evidence.length} applicable), as of ${date}`)
