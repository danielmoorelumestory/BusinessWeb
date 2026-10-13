// 给 collect_rank_history.py 的结果补上北交所：baostock 不含北交所，而北交所常有高换手个股。
// 北交所换手率 = 当日成交量 ÷ 流通股本；流通股本由「最新交易日的成交量 ÷ 换手率」（腾讯报价）反推，
// 因此是按当前流通股本的估算，解禁/扩容会让更早日期偏高。用法：node daily-analysis-bj-turnover.mjs 输入.json 输出.json 最新交易日
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const UA = { 'User-Agent': 'Mozilla/5.0' }
const SINA_LIST = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page={}&num=80&sort=symbol&asc=1&node=hs_a'
const SINA_KLINE = 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol={}&scale=240&ma=no&datalen=45'
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places

async function getText(fetchImpl, url, encoding = 'utf-8') {
  const response = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(15000), redirect: 'error' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return new TextDecoder(encoding).decode(await response.arrayBuffer())
}

export async function listBeijing(fetchImpl) {
  const out = {}
  for (let page = 1; page <= 20; page++) {
    const rows = JSON.parse(await getText(fetchImpl, SINA_LIST.replace('{}', page)))
    const bj = rows.filter(row => row.symbol.startsWith('bj'))
    for (const row of bj) out[row.symbol] = row.name
    if (!rows.length || (!bj.length && Object.keys(out).length)) break
  }
  return out
}

/** 腾讯报价：成交量(手)=字段 6，换手率(%)=字段 38，日期=字段 30 前 8 位。 */
export async function floatShares(fetchImpl, symbols, latestDate) {
  const result = {}
  for (let i = 0; i < symbols.length; i += 50) {
    const text = await getText(fetchImpl, `https://qt.gtimg.cn/q=${symbols.slice(i, i + 50).join(',')}`, 'gb18030')
    for (const match of text.matchAll(/v_(bj\d{6})="([^"]*)"/g)) {
      const fields = match[2].split('~')
      const volume = Number(fields[6]) * 100, turnover = Number(fields[38])
      if (fields[30]?.slice(0, 8) !== latestDate.replace(/-/g, '') || !(volume > 0) || !(turnover > 0)) continue
      result[match[1]] = volume / (turnover / 100)
    }
  }
  return result
}

export function mergeBeijing(computed, bjByDate) {
  const out = {}
  for (const [date, entry] of Object.entries(computed)) {
    const turnover = [...entry.turnover, ...(bjByDate[date] ?? [])].sort((a, b) => b.turnover - a.turnover).slice(0, 5)
    out[date] = { ...entry, turnover }
  }
  return out
}

export async function buildBeijingTurnover({ fetchImpl = fetch, computed, latestDate }) {
  const names = await listBeijing(fetchImpl)
  const shares = await floatShares(fetchImpl, Object.keys(names), latestDate)
  const bjByDate = {}
  const queue = Object.keys(shares)
  const worker = async () => {
    for (let symbol = queue.shift(); symbol; symbol = queue.shift()) {
      let rows
      try { rows = JSON.parse(await getText(fetchImpl, SINA_KLINE.replace('{}', symbol))) } catch { continue }
      rows.forEach((row, i) => {
        const volume = Number(row.volume), close = Number(row.close), previous = Number(rows[i - 1]?.close)
        if (!computed[row.day] || i === 0 || !(volume > 0) || !(close > 0) || !(previous > 0)) return
        ;(bjByDate[row.day] ??= []).push({ symbol, name: names[symbol], price: close, amount: 0, turnover: round(volume / shares[symbol] * 100), change: round((close / previous - 1) * 100) })
      })
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return { merged: mergeBeijing(computed, bjByDate), beijingStocks: queue.length + Object.keys(shares).length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output, latestDate] = process.argv.slice(2)
  const computed = JSON.parse(await readFile(input, 'utf8'))
  buildBeijingTurnover({ computed, latestDate }).then(async ({ merged, beijingStocks }) => {
    await writeFile(output, JSON.stringify(merged))
    console.log(`北交所 ${beijingStocks} 只已并入，输出 ${output}`)
  }).catch(error => { console.error(`北交所换手率失败：${error.message}`); process.exitCode = 1 })
}
