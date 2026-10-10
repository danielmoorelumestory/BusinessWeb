// 指数月线与 PE：给「宏观温度 → 估值位置」用。
// 价格从雅虎财经自动拉取（月收盘，取全部历史）。
// 指数自己的 PE 没有免费接口，所以对有成分股名单的指数（NDX、SOX），逐只拉成分股的 Forward / 滚动 PE 和市值，
// 用市值加权的调和平均汇总成指数 PE，每次更新写入当月一个点，历史从第一次运行起逐月积累。
// 没有成分股名单的指数，Forward PE 仍可手动录入（npm run index:fpe）。
import { CSI300_MEMBERS, CSI500_MEMBERS, CHINEXT_MEMBERS } from './indexMembersCn.mjs'
const TIMEOUT_MS = 12000
const UA = { 'User-Agent': 'Mozilla/5.0' }

// 成分股名单是近似：NDX 取自本站 NDX 公司库（GOOG 与 GOOGL 同一公司，只留 GOOGL），SOX 取主要成分，均未与官方名单逐项核对
export const NDX_MEMBERS = ['ADBE', 'AMD', 'ABNB', 'ALNY', 'GOOGL', 'AMZN', 'AEP', 'AMGN', 'ADI', 'AAPL', 'AMAT', 'APP', 'ARM', 'ASML', 'ALAB', 'ADSK', 'ADP', 'AXON', 'BKR', 'BKNG', 'AVGO', 'CDNS', 'CTAS', 'CSCO', 'CCEP', 'CMCSA', 'CEG', 'CPRT', 'CRWV', 'COST', 'CRWD', 'CSX', 'DDOG', 'DXCM', 'FANG', 'DASH', 'EXC', 'FAST', 'FER', 'FTNT', 'GEHC', 'GILD', 'HON', 'IDXX', 'INTC', 'INTU', 'ISRG', 'KDP', 'KLAC', 'LRCX', 'LIN', 'LITE', 'MAR', 'MRVL', 'MELI', 'META', 'MCHP', 'MU', 'MSFT', 'MSTR', 'MDLZ', 'MPWR', 'MNST', 'NBIS', 'NFLX', 'NVDA', 'NXPI', 'ORLY', 'ODFL', 'PCAR', 'PLTR', 'PANW', 'PAYX', 'PYPL', 'PDD', 'PEP', 'QCOM', 'REGN', 'RKLB', 'ROP', 'ROST', 'SNDK', 'STX', 'SHOP', 'SBUX', 'SNPS', 'TMUS', 'TTWO', 'TER', 'TSLA', 'TXN', 'TRI', 'VRTX', 'WMT', 'WDC', 'WDAY', 'XEL']
export const SOX_MEMBERS = ['NVDA', 'AVGO', 'AMD', 'TSM', 'ASML', 'QCOM', 'TXN', 'INTC', 'MU', 'AMAT', 'LRCX', 'KLAC', 'ADI', 'MRVL', 'NXPI', 'MCHP', 'ON', 'TER', 'MPWR', 'ARM', 'SWKS', 'QRVO', 'ENTG']
// 外部参考序列：Siblis Research 免费 API，只有月末/季末快照（不到 10 个点）；口径与本站成分股汇总不同，图上单独标注
// 没有长历史的指数：Siblis Research 免费 API，只有半年一个点（8 个月末/季末快照）。
// 指数一致的（恒生、上证）再用每日价格估算成逐日序列
const SIBLIS = {
  hsi: { ticker: 'HSI', source: 'Siblis Research（免费版：8 个月末/季末快照）', estimate: true },
  sse: { ticker: 'SSE', source: 'Siblis Research（免费版：8 个月末/季末快照）', estimate: true },
}
async function fetchSiblis(ticker) {
  const res = await fetch(`https://siblisresearch.supabase.co/functions/v1/free-data-api/v1/${ticker}/pe-forward`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Siblis ${ticker}: HTTP ${res.status}`)
  const points = ((await res.json()).data ?? []).map(d => [d['trading_day (EOD)'], d.value]).filter(([d, v]) => d && Number.isFinite(v)).sort((a, b) => a[0].localeCompare(b[0]))
  if (!points.length) throw new Error(`Siblis ${ticker}: 无数据`)
  return points
}
// History of Market（CC BY 4.0，使用须署名）的周度 12 个月一致预期 Forward PE：NDX 自 2001、SOX 自 2002 起。
// SOX 2011 年前盈利接近零或为负，PE 失真（最高 195 倍），只取 2011 年起并剔除 >50 的值；NDX 自 2001 年起的读数连贯，但按需求只取 2011 年起（避开 2001 年互联网泡沫的极端值，分位更贴近近 15 年）
const HOM = {
  ndx: { url: 'https://historyofmarket.com/api/ndx/forward-pe.json', pick: d => d.forward, from: '2011-01-01', cap: 150 },
  spx: { url: 'https://historyofmarket.com/api/sp500/forward-pe.json', pick: d => d.forward, from: '1990-01-01', cap: 60 },
  sox: { url: 'https://historyofmarket.com/api/sectors/forward-pe.json', pick: d => d.sectors?.sox?.series, from: '2011-01-01', cap: 50 },
}
export const HOM_SOURCE = 'History of Market（historyofmarket.com，CC BY 4.0）：12 个月一致预期 Forward PE，周度（标普 500 自 1990 年，NDX、SOX 自 2011 年）'
export async function fetchHistoryOfMarket(key) {
  const { url, pick, from, cap } = HOM[key]
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`History of Market ${key}: HTTP ${res.status}`)
  const points = (pick(await res.json()) ?? []).filter(p => p.date >= from && p.value > 0 && p.value <= cap).map(p => [p.date, p.value])
  if (points.length < 100) throw new Error(`History of Market ${key}: 数据不足`)
  return points
}

const MEMBERS = { ndx: NDX_MEMBERS, sox: SOX_MEMBERS, csi300: CSI300_MEMBERS, csi500: CSI500_MEMBERS, chinext: CHINEXT_MEMBERS }

/** 要跟踪的指数；group 决定表格分组，顺序即显示顺序 */
export const INDEXES = [
  { key: 'ndx', symbol: '^NDX', name: '纳斯达克 100', group: '美股', note: '科技与成长权重最高；本站 NDX 公司库的对应指数' },
  { key: 'sox', symbol: '^SOX', name: '费城半导体 SOX', group: '美股', note: '半导体周期的温度计，波动是纳指的两倍以上' },
  { key: 'spx', symbol: '^GSPC', name: '标普 500', group: '美股', note: '美股大盘基准' },
  { key: 'rsp', symbol: '^SPXEW', name: '标普 500 等权重 SPW', group: '美股', note: '500 家各占相同权重（彭博代码 SPW），不被大科技股拉着走；没有可用的 Forward PE 历史，只看价格位置',
    links: [{ label: '彭博 SPW 行情（含 Forward PE 图）', url: 'https://www.bloomberg.com/quote/SPW:IND' }, { label: 'Yahoo ^SPXEW', url: 'https://finance.yahoo.com/quote/%5ESPXEW' }] },
  { key: 'rut', symbol: '^RUT', name: '罗素 2000', group: '美股', note: '小盘股，对利率和信用更敏感；没有可用的 Forward PE 历史，只看价格位置' },
  { key: 'hsi', symbol: '^HSI', name: '恒生指数', group: '港股', note: '' },
  { key: 'sse', symbol: '000001.SS', name: '上证指数', group: 'A 股', note: '' },
  { key: 'csi300', tencent: 'sh000300', symbol: '000300.SS', name: '沪深 300', group: 'A 股', note: '沪深两市最大的 300 家，A 股大盘基准；Forward PE 由成分股汇总，走势线是中证指数官网公布的滚动 PE（2011 年起）' },
  { key: 'csi500', tencent: 'sh000905', symbol: '000905.SS', name: '中证 500', group: 'A 股', note: '剔除沪深 300 后市值居前的 500 家，中盘代表；Forward PE 由成分股汇总，走势线是中证指数官网公布的滚动 PE（2011 年起）' },
  { key: 'chinext', tencent: 'sz399006', symbol: '399006.SZ', name: '创业板指', group: 'A 股', note: '创业板中市值最大、流动性最好的 100 家（新能源、医药、电子居多）；Forward PE 由成分股汇总，暂无长历史，随每月更新逐点积累' },
]

// 中证指数官网按日公布的滚动 PE（沪深 300、中证 500），2011 年起；日度太密，取每周最后一个交易日
const CSINDEX_PE = { csi300: '000300', csi500: '000905' }
export const CSINDEX_SOURCE = '中证指数官网（csindex.com.cn）：指数滚动 PE（TTM），2011 年起，按周取点'
export function weeklyPoints(rows) {
  const byWeek = new Map()
  for (const [d, v] of rows) {
    const t = new Date(`${d}T00:00:00Z`)
    const monday = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10)
    byWeek.set(monday, [d, v])
  }
  return [...byWeek.values()]
}
export async function fetchCsindexPe(code) {
  const end = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const res = await fetch(`https://www.csindex.com.cn/csindex-home/perf/index-perf?indexCode=${code}&startDate=20040101&endDate=${end}`, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS * 2) })
  if (!res.ok) throw new Error(`中证指数 ${code}: HTTP ${res.status}`)
  const rows = ((await res.json()).data ?? []).filter(r => r.peg > 0 && r.tradeDate).map(r => [`${r.tradeDate.slice(0, 4)}-${r.tradeDate.slice(4, 6)}-${r.tradeDate.slice(6, 8)}`, r.peg]).sort((a, b) => a[0].localeCompare(b[0]))
  const points = weeklyPoints(rows)
  if (points.length < 100) throw new Error(`中证指数 ${code}: 数据不足`)
  return points
}

/** 市值加权调和平均 PE：= Σ市值 ÷ Σ(市值/PE)，相当于"成分股总市值 ÷ 总盈利"，亏损股（PE ≤ 0 或缺失）不计入 */
export function weightedPe(rows, field) {
  const ok = rows.filter(r => r.mcap > 0 && r[field] > 0 && Number.isFinite(r[field]))
  if (!ok.length) return null
  const cap = ok.reduce((a, r) => a + r.mcap, 0)
  const earn = ok.reduce((a, r) => a + r.mcap / r[field], 0)
  return { pe: cap / earn, covered: cap / rows.reduce((a, r) => a + (r.mcap || 0), 0), count: ok.length }
}
export function medianOf(rows, field) {
  const v = rows.map(r => r[field]).filter(x => x > 0 && Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
}

export const round = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n

export function parseMonthly(json) {
  const r = json.chart.result[0]
  const close = r.indicators.quote[0].close
  const rows = r.timestamp.map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), close[i]]).filter(([, v]) => v !== null && Number.isFinite(v))
  return { rows: rows.map(([d, v]) => [d, round(v, 2)]), latestTime: r.meta.regularMarketTime ?? null }
}

// 注意：range=max 时雅虎会把月线悄悄合并成季线，所以用 period1/period2 取真正的月线
async function fetchMonthly(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=0&period2=${Math.floor(Date.now() / 1000)}&interval=1mo`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)
  return parseMonthly(await res.json())
}

/** 雅虎没有沪深 300、中证 500、创业板指的历史（只返回当天一个点），月线改用腾讯行情；每行 [日期, 开, 收, 高, 低, 量]，最后一行是当月未收盘的最新价 */
export async function fetchTencentMonthly(code) {
  const res = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${code},month,,,800,qfq`, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`)
  const k = (await res.json()).data?.[code]
  const raw = k?.month ?? k?.qfqmonth ?? []
  const rows = raw.map(r => [r[0], round(Number(r[2]), 2)]).filter(([, v]) => Number.isFinite(v) && v > 0)
  return { rows, latestTime: null }
}

/** 近 N 年日收盘，用来把半年一个点的参考序列估算成每天一个点 */
async function fetchDaily(symbol, years = 5) {
  const now = Math.floor(Date.now() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${now - years * 366 * 86400}&period2=${now}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)
  return parseMonthly(await res.json()).rows
}

/** 雅虎的 quote 接口要 cookie + crumb */
async function yahooSession() {
  const r = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
  const cookie = (r.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
  const res = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, cookie }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`crumb: HTTP ${res.status}`)
  return { cookie, crumb: await res.text() }
}

/** 批量取个股：名称、市值、Forward PE、滚动 PE */
export async function fetchQuotes(symbols) {
  const { cookie, crumb } = await yahooSession()
  const out = new Map()
  const batches = []
  for (let i = 0; i < symbols.length; i += 40) batches.push(symbols.slice(i, i + 40))
  await Promise.all(batches.map(async batch => {
    const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${batch.join(',')}&crumb=${encodeURIComponent(crumb)}`, { headers: { ...UA, cookie }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`quote: HTTP ${res.status}`)
    for (const q of (await res.json()).quoteResponse.result) out.set(q.symbol, { code: q.symbol, name: q.shortName ?? q.symbol, mcap: q.marketCap ?? 0, fwd: q.forwardPE ?? null, ttm: q.trailingPE ?? null })
  }))
  return out
}

/** 拉取全部指数；某项失败时沿用 previous 里的旧数据并记入 warnings */
export async function buildIndexSnapshot(previous = null) {
  const warnings = []
  const out = {}
  await Promise.all(INDEXES.map(async ix => {
    const old = previous?.indexes?.[ix.key]
    try {
      const { rows, latestTime } = ix.tencent ? await fetchTencentMonthly(ix.tencent) : await fetchMonthly(ix.symbol)
      if (rows.length < 24) throw new Error('历史数据不足')
      const date = latestTime ? new Date(latestTime * 1000).toISOString().slice(0, 10) : rows[rows.length - 1][0]
      out[ix.key] = { symbol: ix.symbol, name: ix.name, group: ix.group, note: ix.note, links: ix.links, latest: { date, value: rows[rows.length - 1][1] }, monthly: rows, fpe: old?.fpe ?? [] }
    } catch (e) {
      warnings.push(`${ix.name}：${e instanceof Error ? e.message : '拉取失败'}${old ? '，沿用旧数据' : ''}`)
      if (old) out[ix.key] = old
    }
  }))
  // 有成分股名单的指数：逐只取 PE，汇总后写入当月 Forward PE 点
  try {
    const symbols = [...new Set(Object.keys(MEMBERS).filter(k => out[k]).flatMap(k => MEMBERS[k]))]
    const quotes = await fetchQuotes(symbols)
    for (const key of Object.keys(MEMBERS)) {
      if (!out[key]) continue
      const members = MEMBERS[key].map(c => quotes.get(c)).filter(Boolean).sort((a, b) => b.mcap - a.mcap)
      const fwd = weightedPe(members, 'fwd'), ttm = weightedPe(members, 'ttm')
      if (!fwd) { warnings.push(`${out[key].name}：成分股没有拿到 Forward PE`); continue }
      const date = new Date().toISOString().slice(0, 10)
      out[key].members = members.map(m => ({ ...m, mcap: round(m.mcap / 1e9, 1), fwd: m.fwd && round(m.fwd, 1), ttm: m.ttm && round(m.ttm, 1) }))
      out[key].agg = { date, fwd: round(fwd.pe, 1), fwdCovered: round(fwd.covered, 3), fwdCount: fwd.count, ttm: ttm && round(ttm.pe, 1), medianFwd: round(medianOf(members, 'fwd'), 1), total: MEMBERS[key].length, got: members.length }
      setFpe({ indexes: out }, key, round(fwd.pe, 1), date)
    }
  } catch (e) {
    warnings.push(`成分股 PE：${e instanceof Error ? e.message : '拉取失败'}，沿用旧数据`)
    for (const key of Object.keys(MEMBERS)) if (out[key]) { out[key].members = previous?.indexes?.[key]?.members; out[key].agg = previous?.indexes?.[key]?.agg }
  }
  for (const key of Object.keys(HOM)) {
    if (!out[key]) continue
    try { out[key].ref = { source: HOM_SOURCE, points: await fetchHistoryOfMarket(key) } }
    catch (e) { warnings.push(`${out[key].name} 参考序列：${e instanceof Error ? e.message : '拉取失败'}${previous?.indexes?.[key]?.ref ? '，沿用旧数据' : ''}`); out[key].ref = previous?.indexes?.[key]?.ref }
  }
  for (const [key, code] of Object.entries(CSINDEX_PE)) {
    if (!out[key]) continue
    try { out[key].ref = { source: CSINDEX_SOURCE, points: await fetchCsindexPe(code), kind: 'trailing' } }
    catch (e) { warnings.push(`${out[key].name} 参考序列：${e instanceof Error ? e.message : '拉取失败'}${previous?.indexes?.[key]?.ref ? '，沿用旧数据' : ''}`); out[key].ref = previous?.indexes?.[key]?.ref }
  }
  for (const [key, cfg] of Object.entries(SIBLIS)) {
    if (!out[key]) continue
    // 手动导入的长历史（npm run index:ref-import）优先，不被免费 8 点快照覆盖
    if (previous?.indexes?.[key]?.ref?.manual) { out[key].ref = previous.indexes[key].ref; continue }
    try {
      out[key].ref = { source: cfg.source, points: await fetchSiblis(cfg.ticker), ...(cfg.estimate ? {} : { proxy: true }) }
      if (cfg.estimate) out[key].daily = await fetchDaily(out[key].symbol)
    } catch (e) {
      warnings.push(`${out[key].name} 参考序列：${e instanceof Error ? e.message : '拉取失败'}${previous?.indexes?.[key]?.ref ? '，沿用旧数据' : ''}`)
      out[key].ref = previous?.indexes?.[key]?.ref; out[key].daily = previous?.indexes?.[key]?.daily
    }
  }
  // 保持 INDEXES 的顺序
  const ordered = Object.fromEntries(INDEXES.filter(ix => out[ix.key]).map(ix => [ix.key, out[ix.key]]))
  return { snapshot: { generatedAt: new Date().toISOString().slice(0, 10), source: '雅虎财经（指数月收盘、成分股 PE 与市值）；无成分股名单的指数 Forward PE 为手动录入', indexes: ordered }, warnings }
}

/** 录入或覆盖某月的 Forward PE（同一个月只保留一个点） */
export function setFpe(snapshot, key, value, date) {
  const ix = snapshot.indexes[key]
  if (!ix) throw new Error(`未知指数 ${key}，可选：${Object.keys(snapshot.indexes).join('、')}`)
  if (!Number.isFinite(value) || value <= 0 || value > 200) throw new Error('Forward PE 应是 0–200 之间的数字')
  const month = date.slice(0, 7)
  ix.fpe = [...ix.fpe.filter(([d]) => d.slice(0, 7) !== month), [`${month}-01`, value]].sort((a, b) => a[0].localeCompare(b[0]))
  return snapshot
}

/** 本地开发（npm run dev）：/api/indexes 由本机 Node 直接拉取，与线上 Vercel 函数返回同样的结构 */
export async function indexesMiddleware(req, res, next) {
  if (!req.url?.startsWith('/api/indexes')) return next()
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  try {
    const { snapshot, warnings } = await buildIndexSnapshot()
    res.end(JSON.stringify({ ...snapshot, fetchedAt: new Date().toISOString(), warnings }))
  } catch {
    res.statusCode = 502
    res.end(JSON.stringify({ error: '数据源暂时不可用' }))
  }
}

/** 导入某指数的长历史 PE 序列（CSV 表头 date,value），来源与口径由调用方写明；kind='trailing' 表示滚动 PE */
export function setRef(snapshot, key, rows, source, kind = 'forward') {
  const ix = snapshot.indexes[key]
  if (!ix) throw new Error(`未知指数 ${key}，可选：${Object.keys(snapshot.indexes).join('、')}`)
  const points = rows.map(([d, v]) => [d.slice(0, 10), Number(v)]).filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(v) && v > 0).sort((a, b) => a[0].localeCompare(b[0]))
  if (points.length < 24) throw new Error('有效数据不足 24 行（日期需为 YYYY-MM-DD，数值需大于 0）')
  ix.ref = { source, points, manual: true, ...(kind === 'trailing' ? { kind } : {}) }
  delete ix.daily
  return snapshot
}
