import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBackfill } from '../server/daily-backfill.mjs'

const DEFAULT_FILE = fileURLToPath(new URL('../public/data/daily-analysis.json', import.meta.url))

/** 把回补得到的历史快照并入归档；已存在的日期（含真实采集的）一律不覆盖。 */
export async function backfillArchive({ file = DEFAULT_FILE, days = 25, now = new Date(), build = buildBackfill } = {}) {
  const body = JSON.parse(await readFile(file, 'utf8'))
  if (body.schemaVersion !== 1 || !Array.isArray(body.snapshots)) throw new Error('归档格式无效，未覆盖原文件')
  const { snapshots: fresh, skipped } = await build({ days, now, history: body.snapshots })
  const existing = new Set(body.snapshots.map(row => row.dataDate))
  const added = fresh.filter(row => !existing.has(row.dataDate))
  if (added.length) {
    const snapshots = [...body.snapshots, ...added].sort((a, b) => b.dataDate.localeCompare(a.dataDate)).slice(0, 60)
    const temporary = `${file}.${process.pid}.tmp`
    try { await writeFile(temporary, JSON.stringify({ schemaVersion: 1, snapshots }, null, 2) + '\n'); await rename(temporary, file) } finally { await rm(temporary, { force: true }) }
  }
  return { added: added.map(row => row.dataDate), skipped }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const days = Number(process.argv[2] ?? 25)
  backfillArchive({ days }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(`历史回补失败：${error.message}`); process.exitCode = 1 })
}
