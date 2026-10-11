// 把分析笔记「结论速览」里的短期、中期最终判断写入云端 D1（表 note_analysis）。
// 用法：
//   npm run sync:analysis            只预览将要写入的内容（不改数据库）
//   npm run sync:analysis -- --write 真正写入线上 D1（需要已登录 wrangler）
// 笔记发布或修改后重新运行即可刷新；同一代码按 upsert 覆盖，不会产生重复行。
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNote, pickLatest, titlesFromNotesTs, toSql } from './noteAnalysis.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_DIR = join(ROOT, 'notes-site/workers/grid-trading-sync')
const DATABASE = 'grid-trading-sync'
const write = process.argv.includes('--write')

const notesDir = join(ROOT, 'public/notes')
const titles = titlesFromNotesTs(readFileSync(join(ROOT, 'src/data/notes.ts'), 'utf8'))
const parsed = [], skipped = []
for (const file of readdirSync(notesDir).filter(name => /^\d{6}-.*\.md$/.test(name)).sort()) {
  const row = parseNote(file, readFileSync(join(notesDir, file), 'utf8'), titles.get(file.replace(/\.md$/, '')))
  if (row.skipped) skipped.push(`${file}：${row.skipped}`)
  else parsed.push(row)
}
const rows = pickLatest(parsed)

console.log(`解析到 ${parsed.length} 篇，按代码取最新后共 ${rows.length} 个标的：`)
for (const row of rows) console.log(`  ${row.code}  基准 ${row.asOf || '—'}\n    短期：${row.short}\n    中期：${row.mid}`)
if (skipped.length) console.log(`\n跳过 ${skipped.length} 篇（结构不符，数据库里已有数据不变）：\n${skipped.map(item => `  ${item}`).join('\n')}`)
if (!rows.length) { console.log('\n没有可写入的内容。'); process.exit(skipped.length ? 1 : 0) }

if (!write) { console.log('\n这是预览，没有修改数据库。确认无误后加 --write 写入。'); process.exit(0) }

const wrangler = (args) => execFileSync('npx', ['wrangler', 'd1', 'execute', DATABASE, '--remote', '--json', ...args], { cwd: WORKER_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const count = () => Number(JSON.parse(wrangler(['--command', 'SELECT COUNT(*) AS n FROM note_analysis']))[0].results[0].n)
const tmp = mkdtempSync(join(tmpdir(), 'note-analysis-'))
try {
  const file = join(tmp, 'note-analysis.sql')
  writeFileSync(file, toSql(rows))
  // 建表语句在 SQL 文件里（幂等），所以第一次运行也能直接写入；写入前表可能还不存在，计数失败按 0 处理
  let before = 0
  try { before = count() } catch { /* 表尚未创建 */ }
  wrangler(['--file', file])
  const after = count()
  console.log(`\n已写入：表中行数 ${before} → ${after}（本次处理 ${rows.length} 个标的）。`)
} finally { rmSync(tmp, { recursive: true, force: true }) }
