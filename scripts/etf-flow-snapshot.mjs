// ETF 资金净流入日度快照：采当日份额 → 结合库中前值算净流入 → 写 public/data/etf-flow.json。
// 用法：node scripts/etf-flow-snapshot.mjs [YYYY-MM-DD]（默认今天，北京时区）
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson, writeJsonIfChanged } from './lib/json-io.mjs'
import { fetchShares, computeDailyFlow, aggregateFlow, cumulative, makeIsBroad } from './lib/etf-flow.mjs'
import { fetchEtfUniverse, fetchLastClose } from './lib/national-team-etf.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const toYi = yuan => Number((yuan / 1e8).toFixed(2)) // 元 → 亿元
const KPI_N = 60
const NOTE = '市价估算（份额差×市价），非同花顺原口径；无盘中数据，T+1；红=净流入、绿=净流出；宽基为近似人工名单。'

function kpiFor(series, key) {
  const vals = series.map(s => s[key])
  return { yesterday: series.at(-1)?.[key] ?? 0, cum60: Number(cumulative(vals, KPI_N).toFixed(2)) }
}

/**
 * 跑一次快照。所有外部依赖可注入以便测试。
 * @returns {Promise<{written:boolean, reason?:string}>}
 */
export async function runSnapshot({
  today = beijingToday(),
  root = REPO,
  fetchImpl = fetch,
  universeFn = fetchEtfUniverse,
  fetchSharesFn = fetchShares,
  lastCloseFn = fetchLastClose,
  broadCodes = readJson(join(REPO, 'data-raw/etf-flow/broad-base.json'), { codes: [] }).codes,
} = {}) {
  const outFile = join(root, 'public/data/etf-flow.json')
  const baselineFile = join(root, 'data-raw/etf-flow/shares-latest.json')

  const { list = [] } = await universeFn({ fetchImpl })
  const priceOf = new Map(list.map(e => [e.code, e.price]))

  const { sse, szse } = await fetchSharesFn({ date: today, fetchImpl })
  if (Object.keys(sse).length === 0) {
    // 沪市份额为空：非交易日或当日未披露。落库残缺快照会毒化次一交易日前值基准，故跳过。
    log(`${today} 沪市份额为空（非交易日/未披露），跳过`)
    return { written: false, reason: '沪市份额为空（非交易日/未披露）' }
  }
  const sharesToday = { ...sse, ...szse }

  const prev = readJson(baselineFile, { date: null, shares: {} }).shares ?? {}
  const isBroad = makeIsBroad(broadCodes)
  const flows = {}
  for (const [code, sh] of Object.entries(sharesToday)) {
    flows[code] = computeDailyFlow(sh, prev[code] ?? null, priceOf.get(code) ?? null)
  }
  const { all, broad } = aggregateFlow(flows, isBroad)

  let index = null
  try { index = await lastCloseFn('000001', 'sh', { fetchImpl }) } catch { index = null }

  const old = readJson(outFile, { series: [] })
  const series = (old.series ?? []).filter(s => s.date !== today)
  series.push({ date: today, flow_all: toYi(all), flow_broad: toYi(broad), index })
  series.sort((a, b) => a.date.localeCompare(b.date))

  const data = {
    updated: new Date().toISOString(),
    note: NOTE,
    sample: false,
    series,
    kpi: { all: kpiFor(series, 'flow_all'), broad: kpiFor(series, 'flow_broad') },
  }
  writeJsonIfChanged(outFile, data, { pretty: true })
  writeJsonIfChanged(baselineFile, { date: today, shares: sharesToday })
  log(`${today} 全A=${toYi(all)}亿 宽基=${toYi(broad)}亿 指数=${index ?? 'null'} series=${series.length}`)
  return { written: true }
}

function beijingToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2]
  runSnapshot(arg ? { today: arg } : {})
    .then(r => { if (!r.written) log('未写入：', r.reason) })
    .catch(e => { console.error('快照失败：', e); process.exitCode = 1 })
}
