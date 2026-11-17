// ETF 资金净流入日度快照：直接取同花顺行情 gateway 的「全市场 ETF 申购净流入」历史序列（原口径），
// 叠加上证指数日 K，写 public/data/etf-flow.json。gateway 返回全量历史，天然幂等、无需本地前值基准。
// 用法：node scripts/etf-flow-snapshot.mjs [startDate=2024-01-01]
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonIfChanged } from './lib/json-io.mjs'
import { fetchFlowHistory, fetchIndexHistory, mergeSeries, kpiOf, FLOW_INDEX_ALL, FLOW_INDEX_BROAD } from './lib/etf-flow.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const START = '2024-01-01'
const NOTE = '同花顺原口径（全市场 / 宽基 ETF 申购净流入，数据来源同花顺行情）+ 上证指数叠加；红=净流入、绿=净流出；T+1、无盘中。'

/**
 * 跑一次快照。所有外部依赖可注入以便测试。
 * @returns {Promise<{written:boolean, reason?:string}>}
 */
export async function runSnapshot({
  today = beijingToday(),
  startDate = START,
  root = REPO,
  fetchImpl = fetch,
  flowFn = fetchFlowHistory,
  indexFn = fetchIndexHistory,
} = {}) {
  const outFile = join(root, 'public/data/etf-flow.json')

  let allRows = []
  try {
    allRows = await flowFn({ startDate, endDate: today, index: FLOW_INDEX_ALL, fetchImpl })
  } catch (error) {
    // 全A 资金接口暂时不可用：像非交易日一样优雅跳过，不写、不让定时任务报错。
    log(`${today} 资金接口不可用（${error.message}），跳过`)
    return { written: false, reason: '资金接口不可用' }
  }
  if (allRows.length === 0) {
    log(`${today} 资金序列为空，跳过`)
    return { written: false, reason: '资金序列为空' }
  }

  // 宽基为次口径，失败不阻断全A（该日 flow_broad 留 null）。
  let broadRows = []
  try { broadRows = await flowFn({ startDate, endDate: today, index: FLOW_INDEX_BROAD, fetchImpl }) } catch { broadRows = [] }

  // 指数为叠加层，失败不阻断资金柱。
  let indexMap = new Map()
  try { indexMap = await indexFn({ fetchImpl }) } catch { indexMap = new Map() }

  const series = mergeSeries(allRows, broadRows, indexMap)
  const data = {
    updated: new Date().toISOString(), // 该字段在 writeJsonIfChanged 里按 VOLATILE 忽略，内容不变不触发重写
    note: NOTE,
    sample: false,
    series,
    kpi: { all: kpiOf(series, 'flow_all'), broad: kpiOf(series, 'flow_broad') },
  }
  const changed = writeJsonIfChanged(outFile, data, { pretty: true })
  log(`${today} 全A昨日=${series.at(-1)?.flow_all}亿 近60=${data.kpi.all.cum60}亿 series=${series.length} ${changed ? '已写' : '无变化'}`)
  return { written: true }
}

function beijingToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2]
  runSnapshot(arg ? { startDate: arg } : {})
    .then(r => { if (!r.written) log('未写入：', r.reason) })
    .catch(e => { console.error('快照失败：', e); process.exitCode = 1 })
}
