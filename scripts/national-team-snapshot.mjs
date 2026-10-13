// 国家队持仓快照：抓东方财富十大流通股东 → 原始层 data-raw/national-team → 前端数据 public/data/national-team
// 用法：
//   node scripts/national-team-snapshot.mjs                 增量：补缺失报告期 + 重抓最近 2 期
//   node scripts/national-team-snapshot.mjs --full          全部报告期重抓（默认 2016 起）
//   node scripts/national-team-snapshot.mjs --start 2022-03-31
//   node scripts/national-team-snapshot.mjs --rebuild       不联网抓十大，只用已有原始层重建（行业缺失仍会补抓）
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildDataset, disclosureOpen, fetchIndustry, fetchPeriodRows, findUnclassified,
  matureEnds, quarterEnds, summarizePeriod,
} from './lib/national-team.mjs'
import { readJson, writeJsonIfChanged } from './lib/json-io.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW_DIR = join(ROOT, 'data-raw/national-team')
const PERIOD_DIR = join(RAW_DIR, 'periods')
const INDUSTRY_FILE = join(RAW_DIR, 'industry-map.json')
const OUT_DIR = join(ROOT, 'public/data/national-team')

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const writeJson = (file, data, pretty = false) => writeJsonIfChanged(file, data, { pretty })

const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10) // 北京时间
const start = opt('--start', '2016-03-31')
const recent = Number(opt('--recent', '2'))
const errors = []

async function pool(items, size, fn) {
  let i = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) {
      const item = items[i]
      i += 1
      await fn(item)
    }
  }))
}

// 1) 抓十大流通股东（每期一个原始文件）
const ends = quarterEnds(start, today).filter(e => disclosureOpen(e, today))
const toFetch = flag('--rebuild') ? [] : ends.filter((e, i) => {
  if (flag('--full')) return true
  if (!existsSync(join(PERIOD_DIR, `${e}.json`))) return true
  return i >= ends.length - recent
})
log(`报告期 ${ends.length} 个，需抓取 ${toFetch.length} 个`)
for (const end of toFetch) {
  try {
    let lastLog = 0
    const rows = await fetchPeriodRows(end, {
      onPage: (p, total) => { if (Date.now() - lastLog > 15000) { lastLog = Date.now(); log(`  ${end} ${p}/${total}`) } },
    })
    const summary = summarizePeriod(end, rows)
    const unknown = findUnclassified(rows)
    if (unknown.length) log(`  ⚠ ${end} 东财标为国家队/社保但规则未识别：`, unknown.slice(0, 5).map(u => u.holder).join('；'))
    writeJson(join(PERIOD_DIR, `${end}.json`), summary)
    log(`${end} 覆盖 ${summary.coverage} 只，国家队记录 ${summary.nt.length} 条，命中 ${new Set(summary.nt.map(r => r.code)).size} 只`)
  } catch (error) {
    errors.push(`${end}: ${error.message}`)
    log(`✗ ${end} 失败，沿用已有数据：${error.message}`)
  }
}

// 2) 载入原始层
const periods = existsSync(PERIOD_DIR)
  ? readdirSync(PERIOD_DIR).filter(f => f.endsWith('.json')).sort().map(f => readJson(join(PERIOD_DIR, f)))
  : []
if (!periods.length) {
  console.error('没有任何原始数据，终止（不写盘）')
  process.exit(1)
}
// top10 只保留最新成熟期，控制仓库体积
const mature = matureEnds(periods)
const newest = mature[mature.length - 1]
for (const p of periods) {
  if (p.end !== newest && p.top10 && Object.keys(p.top10).length) {
    p.top10 = {}
    writeJson(join(PERIOD_DIR, `${p.end}.json`), p)
  }
}

// 3) 行业分类（只补缺，失败不缓存）
const industryMap = readJson(INDUSTRY_FILE, {})
const codes = [...new Set(periods.flatMap(p => p.nt.map(r => r.code)))]
const missing = codes.filter(c => !industryMap[c])
if (missing.length) {
  log(`补抓行业分类 ${missing.length} 只`)
  let done = 0
  let failed = 0
  await pool(missing, 6, async code => {
    try {
      const ind = await fetchIndustry(code)
      if (ind) industryMap[code] = ind
      else failed += 1
    } catch {
      failed += 1
    }
    done += 1
    if (done % 200 === 0) log(`  行业 ${done}/${missing.length}`)
  })
  writeJson(INDUSTRY_FILE, industryMap)
  if (failed) log(`⚠ ${failed} 只个股行业取不到，将归入「未分类」，下次运行自动重试`)
}

// 4) 构建并写盘
const data = buildDataset(periods, industryMap, { generatedAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00') })
writeJson(join(OUT_DIR, 'meta.json'), data.meta, true)
writeJson(join(OUT_DIR, 'stocks.json'), data.stocks)
writeJson(join(OUT_DIR, 'industries.json'), data.industries)
writeJson(join(OUT_DIR, 'top10.json'), data.top10)
writeJson(join(OUT_DIR, 'history.json'), data.history)
writeJson(join(OUT_DIR, 'series.json'), data.series)
writeJson(join(OUT_DIR, 'changes.json'), data.changes)
log(`写盘完成：个股 ${data.stocks.length}、行业 ${data.industries.length}、报告期 ${data.series.periods.length}，最新期 ${data.meta.reportDate}，合计市值 ${(data.meta.totalMv / 1e8).toFixed(0)} 亿`)

if (errors.length) {
  console.error(`有 ${errors.length} 个报告期抓取失败：\n${errors.join('\n')}`)
  process.exit(1)
}
