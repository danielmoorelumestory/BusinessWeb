// 指数全景：tools/index-panorama 是源目录（数据管线 + 前端源码 + 刷新所需缓存），
// public/index-panorama 是发布到站点 /index-panorama/ 的静态资产，只放页面运行必需的文件。
//
//   node scripts/index-panorama-sync.mjs publish   校验数据包后把白名单文件复制到 public/index-panorama（多余文件删除）
//   node scripts/index-panorama-sync.mjs restore   源目录没有 data-bundle.js 时，从已发布的副本取回（刷新前用作“上一版”基准）
//   node scripts/index-panorama-sync.mjs check     核对发布目录与源目录一致、数据包结构有效（不写盘）
//
// etf-catalog.js 由 ETF 目录维护者生成（已核实的产品目录），与数据包一样在发布前校验。
// data-bundle.js 只在 public/index-panorama 里提交一份（源目录的副本被 .gitignore 忽略），避免 13MB 文件重复入库。
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const SOURCE_DIR = join(ROOT, 'tools', 'index-panorama')
export const PUBLIC_DIR = join(ROOT, 'public', 'index-panorama')
export const BUNDLE = 'data-bundle.js'
export const ETF_CATALOG = 'etf-catalog.js'

/** 页面运行需要的全部文件（相对路径）。其余（Python、测试、缓存、报告）不进入公开目录。 */
export const PUBLIC_FILES = [
  'index.html',
  'styles.css',
  'detail.css',
  'analytics.js',
  'chart-edge.js',
  'etf-view.js',
  'detail.js',
  'home.js',
  'app.js',
  'assets/echarts.min.js',
  'assets/ECHARTS-LICENSE.txt',
  ETF_CATALOG,
  BUNDLE,
]

const FIELDS = ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume', 'np']
const ISO = /^\d{4}-\d{2}-\d{2}$/
export const MIN_INDICES = 36

/** 解析 data-bundle.js（window.PANO_DATA=...;）并做结构校验；返回 { data, errors }。 */
export function validateBundle(text, { minIndices = MIN_INDICES } = {}) {
  const errors = []
  const prefix = 'window.PANO_DATA='
  const at = text.indexOf(prefix)
  if (at < 0) return { data: null, errors: ['缺少 window.PANO_DATA= 赋值'] }
  let data
  try {
    data = JSON.parse(text.slice(at + prefix.length).trim().replace(/;\s*$/, ''))
  } catch (error) {
    return { data: null, errors: [`JSON 解析失败：${error.message}`] }
  }
  if (!ISO.test(data.asOf ?? '')) errors.push(`asOf 不是 ISO 日期：${data.asOf}`)
  if (!Array.isArray(data.indices)) return { data, errors: [...errors, 'indices 不是数组'] }
  if (data.indices.length < minIndices) errors.push(`指数只有 ${data.indices.length} 只，少于 ${minIndices}`)
  const codes = new Set()
  for (const s of data.indices) {
    const code = s?.code ?? '(无代码)'
    if (codes.has(code)) errors.push(`${code} 重复`)
    codes.add(code)
    const d = s?.d
    if (!Array.isArray(d) || d.length === 0) { errors.push(`${code} 没有日期轴`); continue }
    for (let i = 0; i < d.length; i++) {
      if (!ISO.test(d[i])) { errors.push(`${code} 日期格式错误：${d[i]}`); break }
      if (i && d[i] <= d[i - 1]) { errors.push(`${code} 日期未严格升序：${d[i - 1]} → ${d[i]}`); break }
    }
    if (d[d.length - 1] > data.asOf) errors.push(`${code} 末日 ${d[d.length - 1]} 晚于 asOf ${data.asOf}`)
    for (const f of FIELDS) {
      const v = s[f]
      if (!Array.isArray(v)) { errors.push(`${code}.${f} 缺失`); continue }
      if (v.length !== d.length) { errors.push(`${code}.${f} 长度 ${v.length} ≠ 日期 ${d.length}`); continue }
      if (v.some(x => x !== null && !(typeof x === 'number' && Number.isFinite(x)))) errors.push(`${code}.${f} 含非有限数`)
    }
  }
  return { data, errors }
}

const ETF_RELATIONS = new Set(['tracks', 'related_theme'])
const CN_SUFFIX = new Set(['SH', 'SZ', 'CSI'])
/** 同一指数：主体相同，且后缀相容（任一方无后缀、后缀相同、或同为境内 SH/SZ/CSI）。与 etf-view.js sameIndex 一致。 */
export function sameIndex(a, b) {
  const [ba, sa = ''] = String(a ?? '').trim().toUpperCase().split('.')
  const [bb, sb = ''] = String(b ?? '').trim().toUpperCase().split('.')
  if (!ba || ba !== bb) return false
  return !sa || !sb || sa === sb || (CN_SUFFIX.has(sa) && CN_SUFFIX.has(sb))
}
/** 指数自身代码 + 条目声明的官方代码别名（如 DJI.US ↔ DJIA、000300.SH ↔ 深市登记的 399300）。 */
const ownCodes = (code, entry) => [code, ...(Array.isArray(entry?.benchmarkAliases) ? entry.benchmarkAliases : [])].filter(c => typeof c === 'string' && c.trim())
const tracksOwn = (code, entry, bench) => ownCodes(code, entry).some(c => sameIndex(c, bench))

/**
 * 解析并校验 etf-catalog.js（window.PANO_ETFS=...;）。公开目录只放已核实条目：
 * 每条产品都要有代码/名称/交易所/关系/实际跟踪指数/https 官方来源/核验日期；
 * relationship=tracks 的 benchmarkCode 必须就是该指数或其 benchmarkAliases（相关主题必须标 related_theme）。
 * indexCodes 给出时，目录里出现数据包没有的指数代码也报错。
 */
export function validateEtfCatalog(text, { indexCodes = null } = {}) {
  const errors = []
  const prefix = 'window.PANO_ETFS='
  const at = text.indexOf(prefix)
  if (at < 0) return { catalog: null, errors: ['缺少 window.PANO_ETFS= 赋值'] }
  let catalog
  try {
    catalog = JSON.parse(text.slice(at + prefix.length).trim().replace(/;\s*$/, ''))
  } catch (error) {
    return { catalog: null, errors: [`JSON 解析失败：${error.message}`] }
  }
  if (catalog?.schemaVersion !== 1) errors.push(`schemaVersion 应为 1：${catalog?.schemaVersion}`)
  if (!ISO.test(String(catalog?.verifiedAt ?? '').slice(0, 10))) errors.push(`verifiedAt 不是 ISO 日期：${catalog?.verifiedAt}`)
  const indices = catalog?.indices
  if (!indices || typeof indices !== 'object' || Array.isArray(indices)) return { catalog, errors: [...errors, 'indices 不是对象'] }
  const known = indexCodes ? new Set(indexCodes) : null
  for (const [code, entry] of Object.entries(indices)) {
    if (known && !known.has(code)) errors.push(`${code} 不在数据包中`)
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.products)) { errors.push(`${code}.products 不是数组`); continue }
    if (entry.benchmarkAliases !== undefined && (!Array.isArray(entry.benchmarkAliases) || entry.benchmarkAliases.some(a => typeof a !== 'string' || !a.trim()))) {
      errors.push(`${code}.benchmarkAliases 应为非空字符串数组`)
    }
    const seen = new Set()
    entry.products.forEach((p, i) => {
      const at = `${code}.products[${i}]`
      for (const k of ['code', 'name', 'exchange', 'benchmarkCode', 'benchmarkName', 'sourceTitle']) {
        if (typeof p?.[k] !== 'string' || !p[k].trim()) errors.push(`${at}.${k} 为空`)
      }
      if (!ETF_RELATIONS.has(p?.relationship)) errors.push(`${at}.relationship 应为 tracks 或 related_theme：${p?.relationship}`)
      if (!/^https:\/\/[^\s"'<>]+$/i.test(p?.sourceUrl ?? '')) errors.push(`${at}.sourceUrl 不是 https 官方链接：${p?.sourceUrl}`)
      if (!ISO.test(String(p?.verifiedAt ?? '').slice(0, 10))) errors.push(`${at}.verifiedAt 不是 ISO 日期：${p?.verifiedAt}`)
      if (p?.relationship === 'tracks' && !tracksOwn(code, entry, p.benchmarkCode)) {
        errors.push(`${at} 标为 tracks，但跟踪 ${p.benchmarkCode}，不是 ${code}（主题相关应标 related_theme）`)
      }
      const key = `${p?.code}|${p?.exchange}`
      if (seen.has(key)) errors.push(`${at} 重复产品 ${p?.code}`)
      seen.add(key)
    })
  }
  return { catalog, errors }
}

/** 直接跟踪（tracks）产品数，按指数统计；related_theme 不计入。 */
export function directEtfCounts(catalog) {
  const out = {}
  for (const [code, entry] of Object.entries(catalog?.indices ?? {})) {
    out[code] = (entry?.products ?? []).filter(p => p?.relationship === 'tracks' && tracksOwn(code, entry, p.benchmarkCode)).length
  }
  return out
}

/** 每只指数每个字段最后一个非 null 观测的日期，用于和上一版比较“末日不回退”。 */
export function lastDates(data) {
  const out = {}
  for (const s of data.indices) {
    out[s.code] = {}
    for (const f of FIELDS) {
      const v = s[f] || []
      let i = v.length - 1
      while (i >= 0 && v[i] === null) i--
      out[s.code][f] = i >= 0 ? s.d[i] : null
    }
  }
  return out
}

/** 新数据包相对上一版：指数减少、字段末日回退、字段整列消失都算退化。 */
export function compareBundles(prev, next) {
  const problems = []
  const a = lastDates(prev)
  const b = lastDates(next)
  for (const code of Object.keys(a)) {
    if (!b[code]) { problems.push(`${code} 在新数据包中消失`); continue }
    for (const f of FIELDS) {
      if (a[code][f] && !b[code][f]) problems.push(`${code}.${f} 原有数据（末日 ${a[code][f]}）全部消失`)
      else if (a[code][f] && b[code][f] < a[code][f]) problems.push(`${code}.${f} 末日回退 ${a[code][f]} → ${b[code][f]}`)
    }
  }
  return problems
}

/** 只比较实际观测（asOf、每只指数的日期轴与 13 个字段）；生成时间、报告文字等元数据变化不算新数据。 */
export function sameObservations(prev, next) {
  const pick = data => JSON.stringify([data.asOf, data.indices.map(s => [s.code, s.d, ...FIELDS.map(f => s[f])])])
  return pick(prev) === pick(next)
}

function readBundle(path) {
  const { data, errors } = validateBundle(readFileSync(path, 'utf8'))
  if (errors.length) throw new Error(`数据包无效（${relative(ROOT, path)}）：\n  ${errors.slice(0, 20).join('\n  ')}`)
  return data
}

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? listFiles(p, base) : [relative(base, p).split('\\').join('/')]
  })
}

/** 发布：校验 → 原子复制白名单 → 删除发布目录里的多余文件。prev 存在时拒绝退化的数据包。 */
export function publish({ source = SOURCE_DIR, target = PUBLIC_DIR, allowRegression = false } = {}) {
  for (const f of PUBLIC_FILES) if (!existsSync(join(source, f))) throw new Error(`源目录缺少 ${f}`)
  const next = readBundle(join(source, BUNDLE))
  const etf = validateEtfCatalog(readFileSync(join(source, ETF_CATALOG), 'utf8'), { indexCodes: next.indices.map(s => s.code) })
  if (etf.errors.length) throw new Error(`ETF 目录无效（${ETF_CATALOG}），未发布：\n  ${etf.errors.slice(0, 20).join('\n  ')}`)
  const prevPath = join(target, BUNDLE)
  let unchanged = false
  if (existsSync(prevPath)) {
    const { data: prev, errors } = validateBundle(readFileSync(prevPath, 'utf8'))
    if (!errors.length) unchanged = sameObservations(prev, next)
    if (!errors.length && !allowRegression) {
      const problems = compareBundles(prev, next)
      if (problems.length) throw new Error(`新数据包相对已发布版本退化，未发布：\n  ${problems.slice(0, 20).join('\n  ')}`)
    }
  }
  mkdirSync(target, { recursive: true })
  for (const f of PUBLIC_FILES) {
    const to = join(target, f)
    mkdirSync(dirname(to), { recursive: true })
    const tmp = `${to}.tmp-${process.pid}`
    copyFileSync(join(source, f), tmp)
    renameSync(tmp, to)
  }
  const keep = new Set(PUBLIC_FILES)
  const removed = listFiles(target).filter(f => !keep.has(f))
  for (const f of removed) rmSync(join(target, f))
  const counts = directEtfCounts(etf.catalog)
  const etfSummary = { indices: Object.keys(counts).length, withDirect: Object.values(counts).filter(n => n > 0).length }
  return { asOf: next.asOf, generatedAt: next.generatedAt, indices: next.indices.length, removed, unchanged, etf: etfSummary }
}

/** 刷新前：源目录没有数据包时从发布目录取回，让 fetch_data.py 能和上一版对比。 */
export function restore({ source = SOURCE_DIR, target = PUBLIC_DIR } = {}) {
  const to = join(source, BUNDLE)
  if (existsSync(to)) return { restored: false }
  const from = join(target, BUNDLE)
  if (!existsSync(from)) throw new Error(`发布目录也没有 ${BUNDLE}，无法取回上一版`)
  readBundle(from)
  copyFileSync(from, to)
  return { restored: true }
}

/** 核对：发布目录只含白名单文件；前端文件与源目录逐字节一致；数据包有效（源目录有数据包时也须一致）。 */
export function check({ source = SOURCE_DIR, target = PUBLIC_DIR } = {}) {
  const problems = []
  const keep = new Set(PUBLIC_FILES)
  for (const f of listFiles(target)) if (!keep.has(f)) problems.push(`发布目录有多余文件：${f}`)
  for (const f of PUBLIC_FILES) {
    const pub = join(target, f)
    if (!existsSync(pub)) { problems.push(`发布目录缺少 ${f}`); continue }
    const src = join(source, f)
    if (f === BUNDLE && !existsSync(src)) continue
    if (!existsSync(src)) { problems.push(`源目录缺少 ${f}`); continue }
    if (!readFileSync(src).equals(readFileSync(pub))) problems.push(`${f} 与源目录不一致，请运行 npm run index-panorama:publish`)
  }
  let codes = null
  if (existsSync(join(target, BUNDLE))) {
    const { data, errors } = validateBundle(readFileSync(join(target, BUNDLE), 'utf8'))
    problems.push(...errors.slice(0, 20).map(e => `数据包：${e}`))
    if (Array.isArray(data?.indices)) codes = data.indices.map(s => s?.code)
  }
  if (existsSync(join(target, ETF_CATALOG))) {
    const { errors } = validateEtfCatalog(readFileSync(join(target, ETF_CATALOG), 'utf8'), { indexCodes: codes })
    problems.push(...errors.slice(0, 20).map(e => `ETF 目录：${e}`))
  }
  return problems
}

function main(argv) {
  const [cmd, ...rest] = argv
  if (cmd === 'publish') {
    const r = publish({ allowRegression: rest.includes('--allow-regression') })
    console.log(`已发布 public/index-panorama：${r.indices} 只指数，asOf ${r.asOf}，生成于 ${r.generatedAt}${r.removed.length ? `；删除多余文件 ${r.removed.join(', ')}` : ''}${r.unchanged ? '；实际观测与上一版相同（只有元数据变化）' : ''}；ETF 目录 ${r.etf.indices} 只指数，其中 ${r.etf.withDirect} 只有直接跟踪 ETF`)
    // 给 GitHub Actions 用：观测没有变化时不提交，避免休市日也产生一次提交和部署
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `unchanged=${r.unchanged}\n`)
  } else if (cmd === 'restore') {
    console.log(restore().restored ? '已从 public/index-panorama 取回上一版数据包' : '源目录已有数据包，未改动')
  } else if (cmd === 'check') {
    const problems = check()
    if (problems.length) { for (const p of problems) console.error(p); process.exit(1) }
    console.log('public/index-panorama 与源目录一致，数据包有效')
  } else {
    console.error('用法：node scripts/index-panorama-sync.mjs publish [--allow-regression] | restore | check')
    process.exit(2)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)) } catch (error) { console.error(error.message); process.exit(1) }
}
