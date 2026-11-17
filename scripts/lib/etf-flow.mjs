// ETF 资金净流入：直接取同花顺行情 gateway 的「全市场 ETF 申购净流入」历史序列（原口径），
// 叠加上证指数日 K。纯函数 + 可注入 fetch 的采集，便于测试。
// 来源逆向：ths APK → hqMarket H5（sjdp_etf_capital / etfCapitalFlow）。
// 全A 合成码 48:883957 + 指标 a_etf_total_net_buy_flow_amount，日频 DAY_1，单位元、带负值。
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1'
const DAY = 86400

// 带重试的请求；fetchImpl 可注入以便测试。
async function request(url, { headers = {}, retries = 3, timeoutMs = 25000, fetchImpl = fetch } = {}) {
  let lastError
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': UA, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (error) {
      lastError = error
      if (attempt === retries) throw error
    }
  }
  throw lastError
}

/** 'YYYY-MM-DD' → 该日北京 00:00 的 unix 秒。北京固定 UTC+8（无夏令时）：00:00 = 前一日 16:00 UTC。 */
export function beijingDayUnix(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d, 0, 0, 0) / 1000 - 8 * 3600
}

/** unix 秒 → 北京日期 'YYYY-MM-DD'。加 8h 后按 UTC 读即北京墙钟。 */
export function secToBeijingDate(sec) {
  return new Date((Number(sec) + 8 * 3600) * 1000).toISOString().slice(0, 10)
}

/** 元 → 亿元（两位小数）。 */
export const toYi = yuan => Number((yuan / 1e8).toFixed(2))

/** gateway 资金流响应 → [{ date, yuan|null }]。status 非 0 或结构缺失返回空数组。 */
export function parseFlowGateway(json) {
  if (json?.status_code !== 0) return []
  const tr = json?.data?.time_range
  const vals = json?.data?.data?.[0]?.values?.[0]?.values
  if (!Array.isArray(tr) || !Array.isArray(vals)) return []
  const out = []
  for (let i = 0; i < tr.length; i += 1) {
    const sec = Number(tr[i])
    if (!Number.isFinite(sec)) continue
    const v = vals[i]
    out.push({ date: secToBeijingDate(sec), yuan: v == null ? null : Number(v) })
  }
  return out
}

/** sina 日 K 数组 → Map(date → close)。去非正收盘。 */
export function parseSinaKline(rows) {
  const m = new Map()
  for (const r of Array.isArray(rows) ? rows : []) {
    const day = String(r?.day ?? '').slice(0, 10)
    const close = Number(r?.close)
    if (day && close > 0) m.set(day, close)
  }
  return m
}

/**
 * 全A 行 + 宽基 行 + 指数 Map → 展示序列。
 * 以全A为主轴，丢弃 yuan 为 null 的行（金额未准备，不画 0 柱）；
 * 宽基按日对齐，缺某日则该日 flow_broad=null。
 */
export function mergeSeries(allRows, broadRows = [], indexMap = new Map()) {
  const broadByDate = new Map(broadRows.filter(r => r.yuan != null).map(r => [r.date, toYi(r.yuan)]))
  return allRows
    .filter(r => r.yuan != null)
    .map(r => ({
      date: r.date,
      flow_all: toYi(r.yuan),
      flow_broad: broadByDate.has(r.date) ? broadByDate.get(r.date) : null,
      index: indexMap.get(r.date) ?? null,
    }))
}

/** 近 n 个值之和（不足 n 则全取），忽略非有限值。 */
export function cumulative(values, n) {
  return values.slice(-n).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
}

/** KPI：昨日=末值、cum60=近 60 之和。 */
export function kpiOf(series, key) {
  const vals = series.map(s => s[key]).filter(v => v != null)
  return { yesterday: series.at(-1)?.[key] ?? 0, cum60: Number(cumulative(vals, 60).toFixed(2)) }
}

// 同花顺 ETF资金 全市场合成码；各口径是同码上的不同指标名（逆向 hqMarket + gateway 实测）。
const FLOW_CODE = '48%3A883957'
export const FLOW_INDEX_ALL = 'a_etf_total_net_buy_flow_amount'        // 全A
export const FLOW_INDEX_BROAD = 'broad_etf_total_net_buy_flow_amount'  // 宽基
export const FLOW_INDEX_INDUSTRY = 'industry_etf_total_net_buy_flow_amount' // 行业
export const FLOW_INDEX_GOLD = 'gold_etf_total_net_buy_flow_amount'    // 黄金
export const FLOW_INDEX_HK = 'hk_etf_total_net_buy_flow_amount'        // 港股
const FLOW_URL = (index, start, end) =>
  'https://fund.10jqka.com.cn/quotation/data/query/gateway/cache/v2/line'
  + `/${FLOW_CODE}/${index}/DAY_1/${start}/${end}/-150`
const SINA_KLINE = datalen =>
  'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData'
  + `?symbol=sh000001&scale=240&ma=no&datalen=${datalen}`

/** 取某口径 ETF 申购净流入历史（同花顺 gateway）。endDate 当日含在内（上界取次日 0 点）。 */
export async function fetchFlowHistory({ startDate, endDate, index = FLOW_INDEX_ALL, fetchImpl = fetch } = {}) {
  const start = beijingDayUnix(startDate)
  const end = beijingDayUnix(endDate) + DAY
  const json = await request(FLOW_URL(index, start, end), { headers: { Referer: 'https://fund.10jqka.com.cn/' }, fetchImpl })
  return parseFlowGateway(json)
}

/** 取上证指数日 K（sina）→ Map(date → close)。失败兜底空 Map，不阻断资金柱。 */
export async function fetchIndexHistory({ datalen = 3200, fetchImpl = fetch } = {}) {
  try {
    const rows = await request(SINA_KLINE(datalen), { fetchImpl })
    return parseSinaKline(rows)
  } catch {
    return new Map()
  }
}
