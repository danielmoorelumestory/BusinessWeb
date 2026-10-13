import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_FILE = fileURLToPath(new URL('../public/data/daily-analysis.json', import.meta.url))
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places
const KEYS = {
  amount: ['amountRank', '成交额', 'baostock 不含北交所'],
  turnover: ['turnoverRank', '换手率', 'baostock 沪深为交易所口径；北交所个股由日线成交量按当前流通股本估算，解禁或扩容前的日期可能偏高'],
}

const toRow = (pick, date) => ({
  symbol: pick.symbol, code: pick.symbol.slice(2), name: pick.name, date, price: round(pick.price), change: round(pick.change),
  amount: round(pick.amount), turnover: pick.turnover === null ? null : round(pick.turnover),
})

/**
 * 把 collect_rank_history.py 算出的历史榜单并入归档。
 * 先用「已有真实榜单的日期」核对（前五代码与顺序必须完全一致）；核对不通过的榜单类型整体不写入。
 * 已有榜单的日期不覆盖。
 */
export function applyRankBackfill(snapshots, computed, { minVerified = 1, now = new Date() } = {}) {
  const report = {}
  const next = snapshots.map(snapshot => structuredClone(snapshot))
  for (const [kind, [sourceId, label, caveat]] of Object.entries(KEYS)) {
    const checked = next.filter(snapshot => snapshot.rankings?.[kind]?.length === 5 && computed[snapshot.dataDate])
    const mismatched = checked.filter(snapshot => computed[snapshot.dataDate][kind].map(row => row.symbol).join() !== snapshot.rankings[kind].map(row => row.symbol).join())
    if (checked.length < minVerified) { report[kind] = { written: [], reason: `没有可核对的真实${label}榜单，未写入` }; continue }
    if (mismatched.length) { report[kind] = { written: [], reason: `与真实榜单不一致：${mismatched.map(row => row.dataDate).join('、')}，未写入` }; continue }
    const written = []
    for (const snapshot of next) {
      const picks = computed[snapshot.dataDate]?.[kind]
      if (!picks || picks.length !== 5 || snapshot.rankings[kind].length) continue
      snapshot.rankings[kind] = picks.map(pick => toRow(pick, snapshot.dataDate))
      const source = snapshot.sources.find(row => row.id === sourceId)
      if (source) Object.assign(source, { label: `${label}排名（历史回补）`, url: 'https://www.baostock.com/', date: snapshot.dataDate, status: 'ready', note: `按日期回补；已用真实榜单核对（${checked.length} 个交易日一致）；${caveat}` })
      // 页面按 fetchedAt 判断新旧；不更新的话，浏览器里已缓存的旧快照会一直压住补好的榜单。
      snapshot.fetchedAt = now.toISOString()
      written.push(snapshot.dataDate)
    }
    report[kind] = { written, verifiedDates: checked.map(snapshot => snapshot.dataDate) }
  }
  return { snapshots: next, report }
}

export async function rankBackfillArchive({ file = DEFAULT_FILE, input, now = new Date() }) {
  const body = JSON.parse(await readFile(file, 'utf8'))
  if (body.schemaVersion !== 1 || !Array.isArray(body.snapshots)) throw new Error('归档格式无效，未覆盖原文件')
  const { snapshots, report } = applyRankBackfill(body.snapshots, JSON.parse(await readFile(input, 'utf8')), { now })
  if (Object.values(report).some(entry => entry.written.length)) {
    const temporary = `${file}.${process.pid}.tmp`
    try { await writeFile(temporary, JSON.stringify({ schemaVersion: 1, snapshots }, null, 2) + '\n'); await rename(temporary, file) } finally { await rm(temporary, { force: true }) }
  }
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  rankBackfillArchive({ input: process.argv[2] }).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(`榜单回补失败：${error.message}`); process.exitCode = 1 })
}
