// 国家队 ETF 持仓快照：东方财富 ETF 清单 + 新浪十大持有人 → public/data/national-team/etf.json
// 用法：
//   node scripts/national-team-etf-snapshot.mjs            增量：已确认有国家队的 ETF 补齐全部报告期，其余只查最近 2 期
//   node scripts/national-team-etf-snapshot.mjs --deep     所有 ETF 都查全部报告期（慢，约 2 万次请求）
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildEtfDataset, fetchEtfUniverse, fetchLastClose, fetchNationalTeamHolders, fetchReportDates,
} from './lib/national-team-etf.mjs'
import { readJson, writeJsonIfChanged } from './lib/json-io.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILE = join(ROOT, 'data-raw/national-team/etf-holders.json')
const OUT_FILE = join(ROOT, 'public/data/national-team/etf.json')
const deep = process.argv.includes('--deep')
const RECENT = 2
const CONCURRENCY = 8

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const writeJson = (file, data) => writeJsonIfChanged(file, data)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const { list: universe, source } = await fetchEtfUniverse()
log(`ETF 清单 ${universe.length} 只（来源：${source}）`)
const cache = readJson(CACHE_FILE, {})

let failed = 0
let fetched = 0
let done = 0
let next = 0
async function worker() {
  while (next < universe.length) {
    const etf = universe[next]
    next += 1
    try {
      const dates = await fetchReportDates(etf.code)
      const have = cache[etf.code] ?? {}
      const isNt = Object.values(have).some(rows => rows.length)
      const want = (deep || isNt ? dates : dates.slice(0, RECENT)).filter(d => !(d in have))
      for (const d of want) {
        const rows = await fetchNationalTeamHolders(etf.code, d)
        ;(cache[etf.code] ??= {})[d] = rows
        fetched += 1
        await sleep(60)
      }
      if (!dates.length) cache[etf.code] ??= {}
    } catch (error) {
      failed += 1
      if (failed <= 5) log(`✗ ${etf.code} ${etf.name}：${error.message}`)
    }
    done += 1
    if (done % 200 === 0) log(`  进度 ${done}/${universe.length}，新抓持有人 ${fetched} 次，失败 ${failed}`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
writeJson(CACHE_FILE, cache)
log(`扫描完成：新抓 ${fetched} 次，失败 ${failed} 只`)

if (failed > universe.length * 0.2) {
  console.error(`失败比例过高（${failed}/${universe.length}），不覆盖已发布数据`)
  process.exit(1)
}
// 清单没带价格时（交易所兜底），只给出现过国家队的 ETF 补最近收盘价
const withNt = new Set(Object.entries(cache).filter(([, d]) => Object.values(d).some(rows => rows.length)).map(([c]) => c))
const needPrice = universe.filter(u => withNt.has(u.code) && !u.price)
if (needPrice.length) {
  log(`补最近收盘价 ${needPrice.length} 只`)
  for (const u of needPrice) {
    u.price = await fetchLastClose(u.code, u.market)
    await sleep(80)
  }
}
const data = buildEtfDataset(universe, cache, { generatedAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00') })
if (!data.etfs.length) {
  console.error('没有识别到任何国家队 ETF，不覆盖已发布数据')
  process.exit(1)
}
writeJson(OUT_FILE, data)
log(`写盘完成：国家队 ETF ${data.meta.numHolding} 只在持、${data.meta.numExited} 只已退出，估算持有市值 ${(data.meta.totalMv / 1e8).toFixed(0)} 亿，最新报告期 ${data.meta.latestDate}`)
