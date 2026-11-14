// ETF 资金净流入：份额抓取（沪深）与净流入计算的纯函数 + 可注入 fetch 的采集。
// 口径承接已评审版：净流入 = (份额_t − 份额_前一交易日) × 市价_t（元）。
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

// 带重试的请求；fetchImpl 可注入以便测试。
async function request(url, { headers = {}, retries = 3, timeoutMs = 25000, fetchImpl = fetch, decode = 'json' } = {}) {
  let lastError
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': UA, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return decode === 'json' ? await res.json() : await res.text()
    } catch (error) {
      lastError = error
      if (attempt === retries) throw error
    }
  }
  throw lastError
}

const WAN = 10000 // 万份 → 份

/** 上交所 commonQuery 响应 → { code: 份 }。TOT_VOL 单位万份。 */
export function parseSseShares(raw) {
  const out = {}
  for (const row of raw?.result ?? []) {
    const code = String(row?.SEC_CODE ?? '').trim()
    const vol = Number(String(row?.TOT_VOL ?? '').replace(/,/g, ''))
    // 必须为正：字段改名/空值会使 Number('')===0，若收下就得到一个非空全零 map，
    // 绕过「沪市份额为空」守卫并毒化次日基准。丢弃非正值 → 字段漂移时返回空 map、守卫正常触发。
    if (code && vol > 0) out[code] = vol * WAN
  }
  return out
}

const CODE_RE = /<u>(\d{6})<\/u>/

/** 深交所 ShowReport(CATALOGID=1105) 响应 → { code: 份 }。dqgm 单位万份、带逗号、含 HTML。仅 ETF。 */
export function parseSzseShares(raw) {
  const out = {}
  const data = Array.isArray(raw) ? raw[0]?.data ?? [] : []
  for (const row of data) {
    if (row?.jjlb && row.jjlb !== 'ETF') continue
    const code = CODE_RE.exec(row?.sys_key ?? '')?.[1]
    const gm = Number(String(row?.dqgm ?? '').replace(/,/g, ''))
    if (code && gm > 0) out[code] = gm * WAN // 同沪市：非正值（含字段改名/空）丢弃，不产生全零 map
  }
  return out
}

/** 单只日净流入（元）。不合格返回 null（不计入合计）。 */
export function computeDailyFlow(sharesT, sharesPrev, price, { splitThreshold = 0.5 } = {}) {
  if (sharesPrev == null || sharesPrev === 0) return null
  if (price == null || !(price > 0)) return null
  if (sharesT == null || !Number.isFinite(sharesT)) return null
  if (Math.abs(sharesT - sharesPrev) / sharesPrev > splitThreshold) return null // 疑似折算/拆分
  return (sharesT - sharesPrev) * price
}

/** 聚合为 { all, broad }（元）。flows 值为 null 的跳过。 */
export function aggregateFlow(flows, isBroad) {
  let all = 0, broad = 0
  for (const [code, flow] of Object.entries(flows)) {
    if (flow == null || !Number.isFinite(flow)) continue
    all += flow
    if (isBroad(code)) broad += flow
  }
  return { all, broad }
}

/** 近 n 个值之和（不足 n 则全取）。 */
export function cumulative(values, n) {
  return values.slice(-n).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
}

/** 由宽基代码表生成判定函数。 */
export function makeIsBroad(codes) {
  const set = new Set(codes)
  return code => set.has(code)
}

const SSE_URL = date =>
  'https://query.sse.com.cn/commonQuery.do?isPagination=true&pageHelp.pageSize=10000'
  + '&pageHelp.pageNo=1&pageHelp.beginPage=1&pageHelp.cacheSize=1&pageHelp.endPage=1'
  + `&sqlId=COMMON_SSE_ZQPZ_ETFZL_XXPL_ETFGM_SEARCH_L&STAT_DATE=${date}`
const SZSE_HOME = 'https://www.szse.cn/market/product/list/etfList/index.html'
const SZSE_DATA = page =>
  `https://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1105&TABKEY=tab1&PAGENO=${page}&random=0.1`

async function fetchSse(date, fetchImpl) {
  const json = await request(SSE_URL(date), { headers: { Referer: 'https://www.sse.com.cn/' }, fetchImpl, retries: 3 })
  return parseSseShares(json)
}

async function fetchSzse(fetchImpl) {
  // 深交所需先拿 cookie，否则返回空体
  const home = await fetchImpl(SZSE_HOME, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) })
  const cookie = (home.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
  const headers = { Referer: SZSE_HOME, Accept: 'application/json, text/javascript, */*; q=0.01', ...(cookie ? { Cookie: cookie } : {}) }
  const out = {}
  let pages = 1
  for (let page = 1; page <= pages; page += 1) {
    const blocks = await request(SZSE_DATA(page), { headers, fetchImpl, retries: 3 })
    pages = Number(blocks?.[0]?.metadata?.pagecount) || pages
    Object.assign(out, parseSzseShares(blocks))
  }
  return out
}

/** 抓当日沪深份额。沪深各自 try/catch，一边失败返回空对象、不影响另一边。 */
export async function fetchShares({ date, fetchImpl = fetch } = {}) {
  let sse = {}, szse = {}
  try { sse = await fetchSse(date, fetchImpl) } catch { sse = {} }
  try { szse = await fetchSzse(fetchImpl) } catch { szse = {} }
  return { sse, szse }
}
