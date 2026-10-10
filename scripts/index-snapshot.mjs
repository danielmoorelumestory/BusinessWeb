#!/usr/bin/env node
// 生成 public/data/index-history.json（取数逻辑见 server/indexes.mjs）。
//   npm run index:update                        更新全部指数价格，保留已录入的 Forward PE
//   npm run index:ref-import -- hsi 文件.csv "来源说明" [trailing]   导入长历史 PE（表头 date,value）
//   npm run index:fpe-import -- 文件.csv        批量补录（表头 month,ndx,sox）
//   npm run index:fpe -- ndx 27.1 [2026-09]     录入某月 Forward PE（日期缺省为当月）
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildIndexSnapshot, setFpe, setRef } from '../server/indexes.mjs'

const FILE = fileURLToPath(new URL('../public/data/index-history.json', import.meta.url))
const read = async () => { try { return JSON.parse(await readFile(FILE, 'utf8')) } catch { return null } }
const save = (s) => writeFile(FILE, JSON.stringify(s) + '\n')

async function main() {
  const [cmd, key, value, date] = process.argv.slice(2)
  const previous = await read()
  if (cmd === 'ref-import') {
    if (!previous) throw new Error('还没有 index-history.json，请先运行 npm run index:update')
    if (!value) throw new Error('用法：npm run index:ref-import -- <指数代号> <文件.csv> "<来源说明>" [trailing]')
    const [head, ...lines] = (await readFile(value, 'utf8')).trim().split(/\r?\n/).map(l => l.split(',').map(c => c.trim()))
    if (head[0] !== 'date' || head[1] !== 'value') throw new Error('CSV 表头应为 date,value')
    setRef(previous, key, lines, date ?? '手动导入', process.argv[6])
    await save(previous)
    console.log(`已导入 ${key}：${previous.indexes[key].ref.points.length} 个点，${previous.indexes[key].ref.points[0][0]} 至 ${previous.indexes[key].ref.points.at(-1)[0]}`)
    return
  }
  if (cmd === 'fpe-import') {
    if (!previous) throw new Error('还没有 index-history.json，请先运行 npm run index:update')
    const [head, ...lines] = (await readFile(key, 'utf8')).trim().split(/\r?\n/).map(l => l.split(',').map(c => c.trim()))
    if (head[0] !== 'month') throw new Error('CSV 表头应为 month,ndx,sox,…')
    let n = 0
    for (const row of lines) for (let i = 1; i < head.length; i++) if (row[i]) { setFpe(previous, head[i], Number(row[i]), row[0]); n++ }
    await save(previous)
    console.log(`已导入 ${n} 个点`)
    return
  }
  if (cmd === 'fpe') {
    if (!previous) throw new Error('还没有 index-history.json，请先运行 npm run index:update')
    await save(setFpe(previous, key, Number(value), date ?? new Date().toISOString().slice(0, 10)))
    console.log(`已录入 ${key} Forward PE ${value}（${(date ?? new Date().toISOString()).slice(0, 7)}）`)
    return
  }
  const { snapshot, warnings } = await buildIndexSnapshot(previous)
  if (!Object.keys(snapshot.indexes).length) throw new Error('所有数据源都失败，未写入')
  await save(snapshot)
  for (const w of warnings) console.warn(`⚠ ${w}`)
  for (const [k, v] of Object.entries(snapshot.indexes)) console.log(`${k.padEnd(7)} ${String(v.latest.value).padStart(10)} ${v.latest.date}  月线 ${v.monthly.length} 点  PE ${v.fpe.length} 点`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1 })
