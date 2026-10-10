#!/usr/bin/env node
// 生成 public/data/macro-us.json 与 macro-cn.json（取数逻辑见 server/macro.mjs）。
// 用法：npm run macro:update     每月非农公布后运行一次即可（GitHub Action 每月 8 日自动运行）。
// 某个数据源失败时保留上一次的读数并打印警告，不会把已有数据清空。
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildSnapshots } from '../server/macro.mjs'

export const DATA_FILES = {
  us: fileURLToPath(new URL('../public/data/macro-us.json', import.meta.url)),
  cn: fileURLToPath(new URL('../public/data/macro-cn.json', import.meta.url)),
  hk: fileURLToPath(new URL('../public/data/macro-hk.json', import.meta.url)),
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return null }
}

/** 拉取最新数据并写入 public/data；本地开发服务的「刷新」也调用它 */
export async function updateSnapshotFiles() {
  const previous = { us: await readJson(DATA_FILES.us), cn: await readJson(DATA_FILES.cn), hk: await readJson(DATA_FILES.hk) }
  const result = await buildSnapshots(previous)
  // 文件里只保留日期，避免每次运行都产生无意义的改动
  // live 标记只在实时刷新时有意义，不写进文件
  const strip = ({ fetchedAt, series, ...rest }) => ({ ...rest, series: Object.fromEntries(Object.entries(series).map(([k, { live, ...v }]) => [k, v])) })
  await writeFile(DATA_FILES.us, JSON.stringify(strip(result.us)) + '\n')
  await writeFile(DATA_FILES.cn, JSON.stringify(strip(result.cn)) + '\n')
  await writeFile(DATA_FILES.hk, JSON.stringify(strip(result.hk)) + '\n')
  return result
}

async function main() {
  const { us, cn, hk, warnings } = await updateSnapshotFiles()
  for (const w of warnings) console.warn(`⚠ ${w}`)
  for (const [label, set] of [['美国', us.series], ['中国', cn.series], ['港股', hk.series]]) {
    console.log(`── ${label}`)
    for (const [k, v] of Object.entries(set)) console.log(`${k.padEnd(9)} ${String(v.latest.value).padStart(8)} ${(v.unit || '').padEnd(3)} ${v.latest.date}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1 })
