import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDailyAnalysis } from '../server/daily-analysis.mjs'
import { canReplaceSnapshot } from '../src/features/daily-analysis/quality.mjs'

const DEFAULT_FILE = fileURLToPath(new URL('../public/data/daily-analysis.json', import.meta.url))

export async function updateDailyArchive({ file = DEFAULT_FILE, now = new Date(), build = buildDailyAnalysis } = {}) {
  let history = []
  try {
    const body = JSON.parse(await readFile(file, 'utf8'))
    if (body.schemaVersion !== 1 || !Array.isArray(body.snapshots)) throw new Error('归档格式无效，未覆盖原文件')
    history = body.snapshots
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  const snapshot = await build({ now, history })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  if (snapshot.dataDate !== today || snapshot.session !== 'closed') return { saved: false, dataDate: snapshot.dataDate, reason: '未取得当日收盘快照，保留已有归档' }
  const previous = history.find(row => row.dataDate === snapshot.dataDate)
  if (previous && !canReplaceSnapshot(previous, snapshot)) return { saved: false, dataDate: snapshot.dataDate, reason: '新快照未更新或有来源退化，保留已有归档' }
  const snapshots = [snapshot, ...history.filter(row => row.dataDate !== snapshot.dataDate)].sort((a, b) => b.dataDate.localeCompare(a.dataDate)).slice(0, 60)
  const temporary = `${file}.${process.pid}.tmp`
  try {
    await writeFile(temporary, JSON.stringify({ schemaVersion: 1, snapshots }, null, 2) + '\n')
    await rename(temporary, file)
  } finally { await rm(temporary, { force: true }) }
  return { saved: true, dataDate: snapshot.dataDate, count: snapshots.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updateDailyArchive().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(`每日复盘归档失败：${error.message}`)
    process.exitCode = 1
  })
}
