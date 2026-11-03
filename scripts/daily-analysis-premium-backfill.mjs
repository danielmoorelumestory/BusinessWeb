import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computePremium } from '../server/daily-premium.mjs'

const DEFAULT_FILE = fileURLToPath(new URL('../public/data/daily-analysis.json', import.meta.url))

/**
 * 给还没有溢价的归档日期补上溢价。涨停名单取归档里前一交易日的 upStocks，前一交易日不在归档时跳过。
 * history 由 scripts/python/collect_premium_history.py 生成：{ tradingDates, prices: { 代码: { 日期: [开盘, 收盘, 前收] } } }。
 */
export async function backfillPremium({ file = DEFAULT_FILE, history }) {
  const body = JSON.parse(await readFile(file, 'utf8'))
  if (body.schemaVersion !== 1 || !Array.isArray(body.snapshots)) throw new Error('归档格式无效，未覆盖原文件')
  const byDate = new Map(body.snapshots.map(row => [row.dataDate, row]))
  const updated = [], skipped = []
  for (const snapshot of body.snapshots) {
    if (snapshot.metrics.premiumOpen != null) continue
    const at = history.tradingDates.indexOf(snapshot.dataDate)
    const codes = at > 0 ? byDate.get(history.tradingDates[at - 1])?.upStocks?.map(row => row.code) : undefined
    if (!codes?.length) { skipped.push({ date: snapshot.dataDate, reason: '归档缺前一交易日的涨停名单' }); continue }
    const rows = codes.flatMap(code => {
      const price = history.prices[code]?.[snapshot.dataDate]
      return price ? [{ open: price[0], close: price[1], previousClose: price[2] }] : []
    })
    const premium = computePremium(rows, codes.length)
    if (premium.open === null) { skipped.push({ date: snapshot.dataDate, reason: `样本不足（${premium.sample}/${premium.total}）` }); continue }
    snapshot.metrics.premiumOpen = premium.open
    snapshot.metrics.premiumClose = premium.close
    updated.push({ date: snapshot.dataDate, open: premium.open, close: premium.close, sample: premium.sample, total: premium.total })
  }
  if (updated.length) {
    const temporary = `${file}.${process.pid}.tmp`
    try { await writeFile(temporary, JSON.stringify(body, null, 2) + '\n'); await rename(temporary, file) } finally { await rm(temporary, { force: true }) }
  }
  return { updated, skipped }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) { console.error('用法：npm run daily-analysis:premium-backfill 价格.json'); process.exitCode = 1 }
  else readFile(process.argv[2], 'utf8').then(text => backfillPremium({ history: JSON.parse(text) }))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(`打板溢价回补失败：${error.message}`); process.exitCode = 1 })
}
