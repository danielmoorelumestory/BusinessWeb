// 宏观快照：拉取并整理中美宏观指标。月度脚本、Vercel 函数和本地开发服务共用这一份逻辑。
// 美国：FRED 公开 CSV；KRE 对标普：雅虎财经周线；中国：国家统计局 / 人民银行数据（经东方财富数据中心）。
const FRED = id => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`
import { inflateRawSync } from 'node:zlib'

const HISTORY_MONTHS = 24
const FINRA_MARGIN = 'https://www.finra.org/sites/default/files/2021-03/margin-statistics.xlsx'
const TIMEOUT_MS = 12000 // 东方财富偶尔较慢；Vercel 函数上限已设为 30 秒
const get = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })

/** 解析 FRED CSV：跳过表头与缺失值（"."） */
export function parseCsv(text) {
  return text.trim().split('\n').slice(1)
    .map(line => line.split(','))
    .filter(([date, v]) => date && v && v !== '.' && Number.isFinite(Number(v)))
    .map(([date, v]) => [date, Number(v)])
}

/** 日度、周度数据按月取最后一个观测值 */
export function monthly(rows) {
  const byMonth = new Map()
  for (const row of rows) byMonth.set(row[0].slice(0, 7), row)
  return [...byMonth.values()]
}

/** 同比：与 12 个月前的同月比较 */
export function yoy(rows) {
  const m = monthly(rows)
  const index = new Map(m.map(([d, v]) => [d.slice(0, 7), v]))
  return m.flatMap(([d, v]) => {
    const prev = index.get(`${Number(d.slice(0, 4)) - 1}${d.slice(4, 7)}`)
    return prev ? [[d, round((v / prev - 1) * 100, 2)]] : []
  })
}

/** 距窗口内最高点的回撤（正数，%） */
export function drawdown(rows) {
  let peak = -Infinity
  return rows.map(([d, v]) => { peak = Math.max(peak, v); return [d, round((1 - v / peak) * 100, 2)] })
}

/** 两个月度序列按月对齐相减 */
export function subtract(a, b) {
  const bm = new Map(monthly(b).map(([d, v]) => [d.slice(0, 7), v]))
  return monthly(a).flatMap(([d, v]) => (bm.has(d.slice(0, 7)) ? [[d, round(v - bm.get(d.slice(0, 7)), 2)]] : []))
}

export const round = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n
const scale = (rows, k, n = 2) => rows.map(([d, v]) => [d, round(v * k, n)])

/** 读 xlsx（zip）里的一个文件：只依赖 node:zlib，避免为一张表引入解析库 */
export function unzipEntry(buf, name) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('不是有效的 xlsx')
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    if (buf.toString('utf8', p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const raw = buf.subarray(start, start + size)
      return (method === 0 ? raw : inflateRawSync(raw)).toString('utf8')
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`xlsx 里没有 ${name}`)
}

/** FINRA 保证金统计表 → 按月升序的 { date, debit, cash, margin }（单位：百万美元） */
export function parseFinraMargin(xml) {
  const rows = []
  for (const [, row] of xml.matchAll(/<row [^>]*>(.*?)<\/row>/gs)) {
    // 早年的行缺列，必须按列号而不是顺序取值
    const col = {}
    for (const [, ref, body] of row.matchAll(/<c r="([A-Z]+)\d+"[^>]*>(.*?)<\/c>/gs)) col[ref] = (body.match(/<t[^>]*>([^<]*)<\/t>/) ?? body.match(/<v>([^<]*)<\/v>/) ?? [])[1]
    if (!/^\d{4}-\d{2}$/.test(col.A ?? '')) continue
    const debit = Number(col.B), cash = Number(col.C), margin = Number(col.D ?? 0)
    if ([debit, cash, margin].every(Number.isFinite) && debit > 0) rows.push({ date: `${col.A}-01`, debit, cash, margin })
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

/** 每个时点除以"不晚于该月的最新一期"名义 GDP（滚动一年），结果为百分比 */
export function ratioToGdp(points, gdpRows) {
  const gdp = [...gdpRows].sort((a, b) => a[0].localeCompare(b[0]))
  return points.flatMap(([d, v]) => {
    const g = [...gdp].reverse().find(([gd]) => gd.slice(0, 7) <= d.slice(0, 7))
    return g ? [[d, round((v / g[1]) * 100, 2)]] : []
  })
}

async function fetchSeries(id) {
  const res = await get(FRED(id))
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`)
  const rows = parseCsv(await res.text())
  if (!rows.length) throw new Error(`${id}: 无数据`)
  return rows
}

function pack(rows, meta) {
  const latest = rows[rows.length - 1]
  const history = monthly(rows).slice(-HISTORY_MONTHS)
  return { ...meta, latest: { date: latest[0], value: latest[1] }, history }
}

/** 带长历史：history 仍是近两年（给迷你图），long 是全部月度数据（给长历史图和分位） */
function packLong(rows, meta) {
  return { ...pack(rows, meta), long: monthly(rows) }
}

/** 连续多少周 a 的周涨幅低于 b（从最近一周往前数） */
export function underperformStreak(a, b) {
  const bm = new Map(b.map(([d, v]) => [d, v]))
  const pairs = a.filter(([d]) => bm.has(d)).map(([d, v]) => [v, bm.get(d)])
  let streak = 0
  for (let i = pairs.length - 1; i > 0; i--) {
    const ra = pairs[i][0] / pairs[i - 1][0] - 1
    const rb = pairs[i][1] / pairs[i - 1][1] - 1
    if (ra < rb) streak++
    else break
  }
  return streak
}

/** 日线收盘（含今天），用于大宗商品和美元指数这类要看最新价的品种 */
async function yahooDaily(symbol, range = '10y') {
  const res = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)
  const r = (await res.json()).chart.result[0]
  const close = r.indicators.quote[0].close
  return r.timestamp.map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), close[i] === null ? null : round(close[i], 2)]).filter(([, v]) => v !== null)
}

async function yahooWeekly(symbol, range = '1y') {
  const res = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1wk`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)
  const r = (await res.json()).chart.result[0]
  const close = r.indicators.quote[0].close
  // 只用已收盘的完整周，去掉本周未完成的最后一根
  return r.timestamp.map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), close[i]]).filter(([, v]) => v !== null).slice(0, -1)
}

/** 滚动窗口求和（按时间升序的 [日期, 值]），窗口不足时跳过 */
export function rollingSum(rows, n) {
  return rows.flatMap((r, i) => (i + 1 >= n ? [[r[0], round(rows.slice(i + 1 - n, i + 1).reduce((a, x) => a + x[1], 0), 1)]] : []))
}

/** 两条按日期对齐的日度序列相加（缺一边的日期丢弃） */
export function addByDate(a, b) {
  const bm = new Map(b.map(([d, v]) => [d, v]))
  return a.filter(([d]) => bm.has(d)).map(([d, v]) => [d, v + bm.get(d)])
}

async function eastmoney(reportName, sortColumn = 'REPORT_DATE', pageSize = 30) {
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=${reportName}&columns=ALL&sortColumns=${sortColumn}&sortTypes=-1&pageSize=${pageSize}&pageNumber=1`
  const res = await get(url)
  const body = await res.json()
  if (!body.success || !body.result?.data?.length) throw new Error(`${reportName}: ${body.message || '无数据'}`)
  return body.result.data.reverse()
}
/** 东方财富单页上限 800 条：并行取够 pages 页，按日期升序返回 */
async function eastmoneyPaged(reportName, columns, sortColumn, pages) {
  const one = async n => {
    const res = await get(`https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=${reportName}&columns=${columns}&sortColumns=${sortColumn}&sortTypes=-1&pageSize=800&pageNumber=${n}`)
    const body = await res.json()
    if (!body.success || !body.result?.data?.length) throw new Error(`${reportName}: ${body.message || '无数据'}`)
    return body.result.data
  }
  return (await Promise.all(Array.from({ length: pages }, (_, i) => one(i + 1)))).flat().reverse()
}

/** 年内累计 GDP → 滚动一年：本期累计 + 上年全年 − 上年同期累计。返回 [月初日期, 亿元] */
export function gdpTtm(rows) {
  const cum = new Map(rows.map(r => [r.REPORT_DATE.slice(0, 7), r.DOMESTICL_PRODUCT_BASE]))
  return rows.flatMap(r => {
    const [y, m] = [Number(r.REPORT_DATE.slice(0, 4)), r.REPORT_DATE.slice(5, 7)]
    const prevSame = cum.get(`${y - 1}-${m}`), prevYear = cum.get(`${y - 1}-12`)
    if (m === '12') return [[r.REPORT_DATE.slice(0, 10), r.DOMESTICL_PRODUCT_BASE]]
    return prevSame && prevYear ? [[r.REPORT_DATE.slice(0, 10), round(r.DOMESTICL_PRODUCT_BASE + prevYear - prevSame, 1)]] : []
  }).sort((a, b) => a[0].localeCompare(b[0]))
}

const emRows = (data, field, dateField = 'REPORT_DATE') => data.filter(d => d[field] !== null && d[field] !== undefined).map(d => [d[dateField].slice(0, 10), Number(d[field])])

/** 并行拉取各项；失败的保留旧值（没有旧值就跳过，并记录原因） */
async function collect(builders, previous, warnings) {
  const entries = Object.entries(builders)
  const results = await Promise.allSettled(entries.map(([, build]) => build()))
  const out = {}
  results.forEach((r, i) => {
    const key = entries[i][0]
    if (r.status === 'fulfilled') { out[key] = { ...r.value, live: true }; return }
    if (previous?.[key]) out[key] = { ...previous[key], live: false }
    warnings.push(`${key}：${r.reason?.message ?? r.reason}${previous?.[key] ? `（保留 ${previous[key].latest.date} 的旧值）` : ''}`)
  })
  return out
}

export const US_SOURCE = 'FRED, Federal Reserve Bank of St. Louis；KRE/SPY：Yahoo Finance'
export const HK_SOURCE = '雅虎财经（恒生指数）、FRED（港元汇率、联邦基金利率）、东方财富（南向资金）'
export const CN_SOURCE = '国家统计局、中国人民银行（经东方财富数据中心）'

/**
 * 拉取最新快照。previous 为上一次的快照（{ us, cn }），某项失败时沿用其中的旧值。
 * 返回 { us, cn, warnings }，us/cn 的结构与 public/data/macro-*.json 相同。
 */
export async function buildSnapshots(previous = null) {
  const warnings = []
  const fred = {}
  const series = id => (fred[id] ??= fetchSeries(id))
  let finraData
  const finra = () => (finraData ??= (async () => {
    const res = await get(FINRA_MARGIN, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error(`FINRA: HTTP ${res.status}`)
    const rows = parseFinraMargin(unzipEntry(Buffer.from(await res.arrayBuffer()), 'xl/worksheets/sheet1.xml'))
    if (!rows.length) throw new Error('FINRA: 无数据')
    return rows
  })())
  const corePce = async () => yoy(await series('PCEPILFE'))

  const usTask = collect({
    gdp: async () => pack(await series('A191RL1Q225SBEA'), { fred: 'A191RL1Q225SBEA', unit: '%' }),
    unrate: async () => pack(await series('UNRATE'), { fred: 'UNRATE', unit: '%' }),
    sahm: async () => pack(await series('SAHMREALTIME'), { fred: 'SAHMREALTIME', unit: 'pp' }),
    claims: async () => pack(scale(await series('IC4WSA'), 1 / 10000, 1), { fred: 'IC4WSA', unit: '万人' }),
    corePce: async () => pack(await corePce(), { fred: 'PCEPILFE', unit: '%', note: '由价格指数计算同比' }),
    realRate: async () => pack(subtract(await series('FEDFUNDS'), await corePce()), { fred: 'FEDFUNDS − PCEPILFE', unit: 'pp', note: '联邦基金利率减核心 PCE 同比' }),
    curve: async () => pack(await series('T10Y2Y'), { fred: 'T10Y2Y', unit: 'pp' }),
    hy: async () => pack(scale(await series('BAMLH0A0HYM2'), 100, 0), { fred: 'BAMLH0A0HYM2', unit: 'bp' }),
    nfci: async () => pack(await series('NFCI'), { fred: 'NFCI', unit: '' }),
    vix: async () => pack(await series('VIXCLS'), { fred: 'VIXCLS', unit: '' }),
    dd: async () => pack(drawdown(await series('SP500')), { fred: 'SP500', unit: '%', note: '距 FRED 可得窗口（约十年）内最高收盘的回撤' }),
    marginGdp: async () => {
      const [debit, gdp] = await Promise.all([finra(), series('GDP')])
      return packLong(ratioToGdp(debit.map(r => [r.date, r.debit / 1000]), gdp), { source: 'FINRA 保证金统计 ÷ FRED GDP', unit: '%', note: '客户保证金账户借方余额 ÷ 名义 GDP（最近一期 GDP 尚未公布的月份沿用上一季）' })
    },
    cashDebt: async () => {
      const rows = (await finra()).map(r => [r.date, round(((r.cash + r.margin) / r.debit) * 100, 1)])
      return packLong(rows, { source: 'FINRA 保证金统计', unit: '%', note: '客户现金账户与保证金账户的闲置现金余额 ÷ 保证金债务' })
    },
    equityShare: async () => packLong(await series('BOGZ1FL153064486Q'), { fred: 'BOGZ1FL153064486Q', unit: '%', note: '美联储资金流量表 Z.1：家庭及非营利机构直接+间接持有的股票占金融资产比重' }),
    buffett: async () => {
      const [mcap, gdp] = await Promise.all([series('NCBEILQ027S'), series('GDP')])
      return packLong(ratioToGdp(mcap.map(([d, v]) => [d, v / 1000]), gdp), { fred: 'NCBEILQ027S ÷ GDP', unit: '%', note: '非金融企业股票市值（Z.1，百万美元转十亿）÷ 名义 GDP' })
    },
    debtService: async () => packLong(await series('TDSP'), { fred: 'TDSP', unit: '%', note: '家庭债务偿付额占可支配收入比例' }),
    ccDelinq: async () => pack(await series('DRCCLACBS'), { fred: 'DRCCLACBS', unit: '%', note: '商业银行信用卡贷款逾期率（季调）' }),
    tenYear: async () => pack(await series('DGS10'), { fred: 'DGS10', unit: '%' }),
    saving: async () => pack(await series('PSAVERT'), { fred: 'PSAVERT', unit: '%' }),
    dxy: async () => packLong(await yahooDaily('DX-Y.NYB'), { source: '雅虎财经 DX-Y.NYB', unit: '', note: 'ICE 美元指数（对一篮子主要货币）' }),
    gold: async () => packLong(await yahooDaily('GC%3DF'), { source: '雅虎财经 GC=F', unit: '美元', note: 'COMEX 黄金期货主力合约，美元/盎司' }),
    silver: async () => packLong(await yahooDaily('SI%3DF'), { source: '雅虎财经 SI=F', unit: '美元', note: 'COMEX 白银期货主力合约，美元/盎司' }),
    wti: async () => packLong(await yahooDaily('CL%3DF'), { source: '雅虎财经 CL=F', unit: '美元', note: 'NYMEX WTI 原油期货主力合约，美元/桶' }),
    kre: async () => {
      const [kre, spy] = await Promise.all([yahooWeekly('KRE'), yahooWeekly('SPY')])
      // 走势：每周往回算的连续跑输周数
      const history = kre.map(([d], i) => [d, underperformStreak(kre.slice(0, i + 1), spy)]).slice(-HISTORY_MONTHS * 2)
      return { fred: 'Yahoo Finance: KRE vs SPY', unit: '周', note: '区域银行 ETF 周涨幅连续低于标普 500 ETF 的周数', latest: { date: history[history.length - 1][0], value: history[history.length - 1][1] }, history }
    },
  }, previous?.us?.series, warnings)

  let marginData
  const marginDaily = () => (marginData ??= eastmoneyPaged('RPTA_RZRQ_LSHJ', 'DIM_DATE,RZYE,RZYEZB', 'DIM_DATE', 6))
  let pmiData
  const pmi = () => (pmiData ??= eastmoney('RPT_ECONOMY_PMI'))
  let moneyData
  const money = () => (moneyData ??= eastmoney('RPT_ECONOMY_CURRENCY_SUPPLY'))
  const cnTask = collect({
    gdp: async () => pack(emRows(await eastmoney('RPT_ECONOMY_GDP'), 'SUM_SAME'), { source: '国家统计局', unit: '%', note: '年内累计同比' }),
    pmi: async () => pack(emRows(await pmi(), 'MAKE_INDEX'), { source: '国家统计局', unit: '' }),
    nmpmi: async () => pack(emRows(await pmi(), 'NMAKE_INDEX'), { source: '国家统计局', unit: '' }),
    cpi: async () => pack(emRows(await eastmoney('RPT_ECONOMY_CPI'), 'NATIONAL_SAME'), { source: '国家统计局', unit: '%' }),
    ppi: async () => pack(emRows(await eastmoney('RPT_ECONOMY_PPI'), 'BASE_SAME'), { source: '国家统计局', unit: '%' }),
    ip: async () => pack(emRows(await eastmoney('RPT_ECONOMY_INDUS_GROW'), 'BASE_SAME'), { source: '国家统计局', unit: '%' }),
    m1m2: async () => {
      const data = await money()
      const rows = data.filter(d => d.CURRENCY_SAME !== null && d.BASIC_CURRENCY_SAME !== null).map(d => [d.REPORT_DATE.slice(0, 10), round(d.CURRENCY_SAME - d.BASIC_CURRENCY_SAME, 2)])
      return pack(rows, { source: '中国人民银行', unit: 'pp', note: 'M1 同比减 M2 同比' })
    },
    marginGdp: async () => {
      const [margin, gdp] = await Promise.all([marginDaily(), eastmoney('RPT_ECONOMY_GDP', 'REPORT_DATE', 80)])
      const rows = ratioToGdp(margin.map(r => [r.DIM_DATE.slice(0, 10), r.RZYE / 1e8]), gdpTtm(gdp))
      return packLong(rows, { source: '沪深交易所融资余额 ÷ 国家统计局 GDP（经东方财富）', unit: '%', note: '两市融资余额（取每月最后一个交易日）÷ 滚动一年名义 GDP' })
    },
    marginMcap: async () => {
      const rows = (await marginDaily()).map(r => [r.DIM_DATE.slice(0, 10), round(r.RZYEZB, 2)])
      return packLong(rows, { source: '沪深交易所（经东方财富）', unit: '%', note: '融资余额占 A 股流通市值' })
    },
    lpr: async () => pack(emRows(await eastmoney('RPTA_WEB_RATE', 'TRADE_DATE', 60), 'LPR1Y', 'TRADE_DATE'), { source: '中国人民银行', unit: '%' }),
  }, previous?.cn?.series, warnings)

  // 南向资金 = 港股通(沪) 002 + 港股通(深) 004，原始单位百万元 → 亿元
  const southbound = async type => {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_MUTUAL_DEAL_HISTORY&columns=MUTUAL_TYPE,TRADE_DATE,NET_DEAL_AMT&filter=${encodeURIComponent(`(MUTUAL_TYPE="${type}")`)}&sortColumns=TRADE_DATE&sortTypes=-1&pageSize=800&pageNumber=1`
    const body = await (await get(url)).json()
    if (!body.success || !body.result?.data?.length) throw new Error(`南向资金 ${type}: ${body.message || '无数据'}`)
    return body.result.data.filter(d => d.NET_DEAL_AMT !== null).map(d => [d.TRADE_DATE.slice(0, 10), d.NET_DEAL_AMT / 100]).reverse()
  }
  const hkTask = collect({
    hsiDd: async () => pack(drawdown(await yahooWeekly('%5EHSI', '10y')), { source: '雅虎财经 ^HSI', unit: '%', note: '距近十年周收盘最高点的回撤' }),
    hsi12m: async () => {
      const w = await yahooWeekly('%5EHSI', '5y')
      const rows = w.flatMap(([d, v], i) => (i >= 52 ? [[d, round((v / w[i - 52][1] - 1) * 100, 1)]] : []))
      return pack(rows, { source: '雅虎财经 ^HSI', unit: '%', note: '恒生指数较 52 周前的涨跌幅' })
    },
    hkd: async () => pack(await series('DEXHKUS'), { fred: 'DEXHKUS', unit: '', note: '每 1 美元兑港元；联系汇率区间 7.75–7.85' }),
    fed: async () => pack(await series('FEDFUNDS'), { fred: 'FEDFUNDS', unit: '%' }),
    south: async () => {
      const [sh, sz] = await Promise.all([southbound('002'), southbound('004')])
      return pack(rollingSum(addByDate(sh, sz), 20), { source: '东方财富（沪深交易所港股通）', unit: '亿元', note: '近 20 个交易日南向净买入合计（人民币）' })
    },
  }, previous?.hk?.series, warnings)

  const [us, cn, hk] = await Promise.all([usTask, cnTask, hkTask])
  const fetchedAt = new Date().toISOString()
  return {
    us: { generatedAt: fetchedAt.slice(0, 10), fetchedAt, source: US_SOURCE, series: us },
    cn: { generatedAt: fetchedAt.slice(0, 10), fetchedAt, source: CN_SOURCE, series: cn },
    hk: { generatedAt: fetchedAt.slice(0, 10), fetchedAt, source: HK_SOURCE, series: hk },
    warnings,
  }
}

/** 本地开发（npm run dev）：/api/macro 由本机 Node 直接拉取，与线上 Vercel 函数返回同样的结构 */
export async function macroMiddleware(req, res, next) {
  if (!req.url?.startsWith('/api/macro')) return next()
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  try {
    res.end(JSON.stringify(await buildSnapshots()))
  } catch {
    res.statusCode = 502
    res.end(JSON.stringify({ error: '数据源暂时不可用' }))
  }
}
