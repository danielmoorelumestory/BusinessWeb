// 国家队持仓：东方财富「十大流通股东」采集与聚合（纯函数 + 网络层，便于测试）。
// 口径：A 股个股，按报告期（季度末）。国家队 = 名称严格匹配的汇金/证金/社保等机构，
// 不用「含某字」的宽松匹配（"证金"会误中"中证金融"类产品）。

export const GROUPS = [
  { id: '中央汇金', core: true },
  { id: '汇金资管', core: true },
  { id: '证金公司', core: true },
  { id: '社保基金', core: true },
  { id: '养老基金', core: false },
  { id: '国新投资', core: false },
  { id: '大基金', core: false },
  { id: '梧桐树', core: false },
]

// 顺序即优先级；全部锚定全称，避免子串误伤。
const RULES = [
  ['中央汇金', /^中央汇金投资有限责任公司$/],
  ['汇金资管', /^中央汇金资产管理有限责任公司$/],
  ['汇金资管', /^.+基金-中央汇金资产管理有限责任公司-.+汇金资管单一资产管理计划$/],
  ['证金公司', /^中国证券金融股份有限公司(转融通.*)?$/],
  ['社保基金', /^全国社保(基金)?[^-]{1,10}组合$/],
  ['社保基金', /^[^-]{2,20}-社保基金[^-]{1,10}组合$/],
  ['社保基金', /^全国社会保障基金理事会(转持.{0,4})?$/],
  ['养老基金', /^基本养老保险基金[^-]{1,10}组合$/],
  ['国新投资', /^国新投资有限公司$/],
  ['国新投资', /^中国国新控股有限责任公司$/],
  ['大基金', /^国家集成电路产业投资基金(二期)?股份有限公司$/],
  ['大基金', /^华芯投资管理有限责任公司-国家集成电路产业投资基金(二期)?股份有限公司$/],
  ['梧桐树', /^梧桐树投资平台有限责任公司$/],
]

// 东财标成国家队/社保、但经核对不是这些机构自身持仓的账户（国资划转专户），不计入，也不再提示。
const EXCLUDED = /委托管理划转社保国有股权基金专户/

/** 持有人名称 → 国家队机构组，非国家队返回 ''。 */
export function classifyHolder(name) {
  // 新浪等来源用全角连字符/括号，统一成半角再匹配
  const n = String(name ?? '').trim().replace(/[－—–]/g, '-').replace(/（/g, '(').replace(/）/g, ')')
  if (!n) return ''
  for (const [group, re] of RULES) if (re.test(n)) return group
  return ''
}

/** 季度末日期列表（含 start 到 today 的所有 03-31/06-30/09-30/12-31），升序，字符串 YYYY-MM-DD。 */
export function quarterEnds(start, today) {
  const startYear = Number(start.slice(0, 4))
  const endYear = Number(today.slice(0, 4))
  const out = []
  for (let y = startYear; y <= endYear; y += 1) {
    for (const md of ['03-31', '06-30', '09-30', '12-31']) {
      const d = `${y}-${md}`
      if (d >= start && d <= today) out.push(d)
    }
  }
  return out
}

/** 报告期是否已过披露期：季报/半年报/年报法定披露截止前数据不齐，距季末不足 N 天的期不抓。 */
export function disclosureOpen(end, today, minDays = 20) {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${end}T00:00:00Z`)
  return ms / 86400000 >= minDays
}

// ---------------------------------------------------------------------------
// 网络层
// ---------------------------------------------------------------------------
const DC_URL = 'https://datacenter.eastmoney.com/securities/api/data/get'
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://data.eastmoney.com/' }
const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function getJson(params, { retries = 4, timeoutMs = 30000, fetchImpl = fetch } = {}) {
  const url = `${DC_URL}?${new URLSearchParams(params)}`
  let lastError
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json?.success) throw new Error(json?.message || 'success=false')
      return json.result
    } catch (error) {
      lastError = error
      await sleep(600 * attempt)
    }
  }
  throw new Error(`东方财富接口失败：${lastError?.message ?? lastError}`)
}

const HOLDER_FIELDS = [
  'SECURITY_CODE', 'SECURITY_NAME_ABBR', 'HOLDER_NAME', 'HOLDER_RANK', 'HOLD_NUM',
  'HOLD_RATIO', 'HOLDER_MARKET_CAP', 'HOLDER_NEWTYPE', 'END_DATE',
].join(',')

const num = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 抓某报告期全市场十大流通股东全部行。
 * 排序键必须含 HOLDER_RANK：只按 SECURITY_CODE 排序时同股 10 行次序不稳定，分页会重复/丢行。
 * 行数与接口 count 不符、或 (代码, 名称, 名次) 不唯一时抛错，由调用方决定是否沿用旧数据。
 */
export async function fetchPeriodRows(end, { concurrency = 3, fetchImpl = fetch, onPage } = {}) {
  const base = {
    type: 'RPT_F10_EH_FREEHOLDERS', sty: HOLDER_FIELDS, filter: `(END_DATE='${end}')`,
    ps: '500', st: 'SECURITY_CODE,HOLDER_RANK', sr: '1,1',
    source: 'SELECT_SECU_DATA', client: 'WEB',
  }
  const first = await getJson({ ...base, p: '1' }, { fetchImpl })
  const pages = first.pages ?? 1
  const total = first.count ?? 0
  const results = new Array(pages)
  results[0] = first.data ?? []
  let next = 2
  const worker = async () => {
    while (next <= pages) {
      const p = next
      next += 1
      const r = await getJson({ ...base, p: String(p) }, { fetchImpl })
      results[p - 1] = r.data ?? []
      onPage?.(p, pages)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(pages - 1, 0)) }, worker))
  const rows = results.flat()
  if (rows.length !== total) throw new Error(`${end} 行数不符：拿到 ${rows.length}，接口声明 ${total}`)
  // 老报告期源数据里偶有完全相同的重复行：去重保留；比例异常高说明分页出了问题，拒绝。
  const seen = new Set()
  const unique = []
  for (const r of rows) {
    const key = `${r.SECURITY_CODE}|${r.HOLDER_NAME}|${r.HOLDER_RANK}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(r)
  }
  const dupes = rows.length - unique.length
  if (dupes > Math.max(20, rows.length * 0.002)) throw new Error(`${end} 存在大量重复行：${dupes} 条`)
  if (dupes) console.warn(`  ⚠ ${end} 源数据有 ${dupes} 条重复行，已去重`)
  return unique
}

/** 一期原始行 → 国家队行 + 覆盖统计 + 命中股的完整十大。 */
export function summarizePeriod(end, rows) {
  const codes = new Set()
  const nt = []
  const byStock = new Map()
  for (const r of rows) {
    codes.add(r.SECURITY_CODE)
    const group = classifyHolder(r.HOLDER_NAME)
    if (!group) continue
    nt.push({
      code: r.SECURITY_CODE, name: String(r.SECURITY_NAME_ABBR ?? '').trim(),
      holder: String(r.HOLDER_NAME).trim(), group, rank: num(r.HOLDER_RANK),
      num: num(r.HOLD_NUM), ratio: num(r.HOLD_RATIO), mv: num(r.HOLDER_MARKET_CAP),
    })
    byStock.set(r.SECURITY_CODE, true)
  }
  const top10 = {}
  for (const r of rows) {
    if (!byStock.has(r.SECURITY_CODE)) continue
    ;(top10[r.SECURITY_CODE] ??= []).push({
      rank: num(r.HOLDER_RANK), holder: String(r.HOLDER_NAME).trim(), num: num(r.HOLD_NUM),
      ratio: num(r.HOLD_RATIO), mv: num(r.HOLDER_MARKET_CAP),
      group: classifyHolder(r.HOLDER_NAME),
    })
  }
  for (const list of Object.values(top10)) list.sort((a, b) => a.rank - b.rank)
  return { end, coverage: codes.size, rowCount: rows.length, nt, top10 }
}

/** 东财自带标签交叉校验：被东财标成「国家队/社保」但我们规则没认出的持有人名（供人工复核）。 */
export function findUnclassified(rows) {
  const seen = new Map()
  for (const r of rows) {
    if (classifyHolder(r.HOLDER_NAME) || EXCLUDED.test(r.HOLDER_NAME)) continue
    if (r.HOLDER_NEWTYPE === '国家队' || r.HOLDER_NEWTYPE === '社保') {
      seen.set(r.HOLDER_NAME, (seen.get(r.HOLDER_NAME) ?? 0) + 1)
    }
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([holder, count]) => ({ holder, count }))
}

/** 所属行业：取 BOARD_TYPE='行业' 中层级最小者为主行业；取不到返回 null（调用方不缓存失败）。 */
export async function fetchIndustry(code, { fetchImpl = fetch } = {}) {
  const secucode = `${code}${code.startsWith('6') || code.startsWith('9') ? '.SH' : code.startsWith('4') || code.startsWith('8') ? '.BJ' : '.SZ'}`
  const result = await getJson({
    type: 'RPT_F10_CORETHEME_BOARDTYPE', sty: 'BOARD_NAME,BOARD_TYPE,BOARD_LEVEL',
    filter: `(SECUCODE="${secucode}")`, p: '1', ps: '50', source: 'HSF10', client: 'PC',
  }, { fetchImpl })
  const rows = (result?.data ?? [])
    .filter(r => r.BOARD_TYPE === '行业' && r.BOARD_NAME)
    .map(r => ({ level: Number(r.BOARD_LEVEL) || 9, name: String(r.BOARD_NAME).trim() }))
    .sort((a, b) => a.level - b.level)
  if (!rows.length) return null
  return { primary: rows[0].name, all: rows.map(r => r.name) }
}

// ---------------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------------

/** 选出「成熟」报告期：覆盖股票数不低于上一成熟期的 90%，且 NT 命中数不为 0。 */
export function matureEnds(periods) {
  const out = []
  let lastCoverage = 0
  for (const p of periods) {
    if (!p.nt.length) continue
    if (lastCoverage && p.coverage < lastCoverage * 0.9) continue
    out.push(p.end)
    lastCoverage = p.coverage
  }
  return out
}

const round = (v, d = 0) => {
  const k = 10 ** d
  return Math.round(v * k) / k
}

/**
 * periods: [{end, coverage, nt, top10}]（升序）；industryMap: {code: {primary, all}}
 * 返回前端需要的全部产物。行业用「当前分类」套用到所有历史期（页面需注明）。
 */
export function buildDataset(periods, industryMap, { generatedAt, includeExtended = true } = {}) {
  const allowed = new Set(GROUPS.filter(g => includeExtended || g.core).map(g => g.id))
  const ends = matureEnds(periods)
  const used = periods.filter(p => ends.includes(p.end))
  if (!used.length) throw new Error('没有成熟的报告期')
  const idx = new Map(ends.map((e, i) => [e, i]))

  const stocks = new Map() // code -> {name, mv[], ratio[], num[]}
  const groupSeries = new Map() // group -> {mv[], n[]}
  const totalMv = ends.map(() => 0)
  const totalN = ends.map(() => 0)
  const perStockPeriod = new Map() // `${code}|${i}` -> {mv, ratio, num, groups:Set}

  for (const p of used) {
    const i = idx.get(p.end)
    for (const r of p.nt) {
      if (!allowed.has(r.group)) continue
      let s = stocks.get(r.code)
      if (!s) {
        s = { name: r.name, mv: ends.map(() => 0), ratio: ends.map(() => 0), num: ends.map(() => 0) }
        stocks.set(r.code, s)
      }
      s.name = r.name || s.name
      s.mv[i] += r.mv
      s.ratio[i] += r.ratio
      s.num[i] += r.num
      const g = groupSeries.get(r.group) ?? { mv: ends.map(() => 0), n: ends.map(() => 0) }
      g.mv[i] += r.mv
      groupSeries.set(r.group, g)
      const key = `${r.code}|${i}|${r.group}`
      if (!perStockPeriod.has(key)) {
        perStockPeriod.set(key, true)
        g.n[i] += 1
      }
    }
  }
  for (const s of stocks.values()) s.mv.forEach((v, i) => { if (v) { totalMv[i] += v; totalN[i] += 1 } })

  const last = ends.length - 1
  const prev = last - 1
  const indOf = code => industryMap[code]?.primary ?? '未分类'

  // 行业序列（点位：每期只计当期实际持有的股）
  const indSeries = new Map()
  for (const [code, s] of stocks) {
    const ind = indOf(code)
    const cell = indSeries.get(ind) ?? { mv: ends.map(() => 0), n: ends.map(() => 0) }
    s.mv.forEach((v, i) => { if (v) { cell.mv[i] += v; cell.n[i] += 1 } })
    indSeries.set(ind, cell)
  }

  const latest = used[used.length - 1]
  const holdersByStock = {}
  for (const r of latest.nt) {
    if (!allowed.has(r.group)) continue
    ;(holdersByStock[r.code] ??= []).push({ g: r.group, h: r.holder, num: round(r.num), ratio: round(r.ratio, 4), mv: round(r.mv) })
  }
  for (const list of Object.values(holdersByStock)) list.sort((a, b) => b.mv - a.mv)

  const snapshot = []
  for (const [code, s] of stocks) {
    if (!s.mv[last]) continue // 最新期不在 → 已退出，仅历史保留
    const prevMv = prev >= 0 && s.mv[prev] ? s.mv[prev] : null
    snapshot.push({
      c: code, n: s.name, ind: indOf(code),
      mv: round(s.mv[last]), mvPrev: prevMv === null ? null : round(prevMv),
      ratio: round(s.ratio[last], 4), num: round(s.num[last]),
      ratioPrev: prevMv === null ? null : round(s.ratio[prev], 4),
      numPrev: prevMv === null ? null : round(s.num[prev]),
      isNew: prevMv === null,
      groups: [...new Set((holdersByStock[code] ?? []).map(h => h.g))],
      holders: holdersByStock[code] ?? [],
    })
  }
  snapshot.sort((a, b) => b.mv - a.mv)

  // 行业快照（本期）
  const indSnap = new Map()
  for (const s of snapshot) {
    const cell = indSnap.get(s.ind) ?? { name: s.ind, n: 0, mv: 0, mvPrev: 0, rw: 0, newN: 0 }
    cell.n += 1
    cell.mv += s.mv
    cell.mvPrev += s.mvPrev ?? 0
    cell.rw += s.ratio * s.mv
    if (s.isNew) cell.newN += 1
    indSnap.set(s.ind, cell)
  }
  const industries = [...indSnap.values()].map(c => ({
    name: c.name, n: c.n, mv: round(c.mv), mvPrev: prev >= 0 ? round(c.mvPrev) : null,
    ratio: c.mv ? round(c.rw / c.mv, 2) : 0, newN: c.newN,
  })).sort((a, b) => b.mv - a.mv)

  // 机构组快照
  const groupSnap = GROUPS.filter(g => allowed.has(g.id) && groupSeries.has(g.id) && groupSeries.get(g.id).mv[last] > 0).map(g => {
    const gs = groupSeries.get(g.id)
    return {
      id: g.id, core: g.core, mv: round(gs.mv[last]), mvPrev: prev >= 0 ? round(gs.mv[prev]) : null,
      n: gs.n[last],
    }
  }).sort((a, b) => b.mv - a.mv)

  // 变动榜：增减持按持股数变化（剔除股价涨跌），新进/退出按有无
  const brief = s => ({ c: s.c, n: s.n, ind: s.ind, mv: s.mv, mvPrev: s.mvPrev, num: s.num, numPrev: s.numPrev, ratio: s.ratio, ratioPrev: s.ratioPrev })
  const held = snapshot.filter(s => s.numPrev)
  const delta = s => (s.num - s.numPrev) / s.numPrev
  const exited = prev >= 0
    ? [...stocks].filter(([, s]) => s.mv[prev] && !s.mv[last])
      .map(([code, s]) => ({ c: code, n: s.name, ind: indOf(code), mvPrev: round(s.mv[prev]), ratioPrev: round(s.ratio[prev], 4) }))
      .sort((a, b) => b.mvPrev - a.mvPrev)
    : []
  const changes = {
    reportDate: ends[last], prevReportDate: prev >= 0 ? ends[prev] : null,
    newEntries: snapshot.filter(s => s.isNew).map(brief),
    exited,
    increased: held.filter(s => delta(s) > 0.01).sort((a, b) => delta(b) - delta(a)).map(brief),
    decreased: held.filter(s => delta(s) < -0.01).sort((a, b) => delta(a) - delta(b)).map(brief),
  }

  const top10 = {}
  for (const s of snapshot) if (latest.top10[s.c]) top10[s.c] = latest.top10[s.c]

  const history = {}
  for (const [code, s] of stocks) {
    history[code] = { n: s.name, ind: indOf(code), mv: s.mv.map(v => round(v)), r: s.ratio.map(v => round(v, 2)) }
  }
  const series = {
    periods: ends,
    total: { mv: totalMv.map(v => round(v)), n: totalN },
    groups: Object.fromEntries([...groupSeries].map(([k, v]) => [k, { mv: v.mv.map(x => round(x)), n: v.n }])),
    industries: Object.fromEntries([...indSeries].map(([k, v]) => [k, { mv: v.mv.map(x => round(x)), n: v.n }])),
  }
  const meta = {
    generatedAt, reportDate: ends[last], prevReportDate: prev >= 0 ? ends[prev] : null,
    periods: ends, numStocks: snapshot.length, numIndustries: industries.length,
    totalMv: round(totalMv[last]), totalMvPrev: prev >= 0 ? round(totalMv[prev]) : null,
    coverage: latest.coverage, groups: groupSnap,
    groupDefs: GROUPS.map(g => ({ id: g.id, core: g.core })),
  }
  return { meta, stocks: snapshot, industries, top10, history, series, changes }
}
