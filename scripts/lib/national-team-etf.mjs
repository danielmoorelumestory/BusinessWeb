// 国家队持仓：ETF 口径（基金十大持有人，半年报/年报披露）。
// 清单与价格来自东方财富行情清单，持有人与报告期来自新浪财经基金持有人页。
import { classifyHolder } from './national-team.mjs'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function request(url, { headers = {}, retries = 4, timeoutMs = 25000, fetchImpl = fetch, decode = 'json' } = {}) {
  let lastError
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (decode === 'gbk') return new TextDecoder('gbk').decode(await res.arrayBuffer())
      return await res.json()
    } catch (error) {
      lastError = error
      await sleep(500 * attempt)
    }
  }
  throw new Error(lastError?.message ?? String(lastError))
}

// ---------------------------------------------------------------------------
// 清单：东方财富 沪深全部 ETF/LOF（价格 f2 按 f1 位小数还原，f20 为总市值，近似规模）
// ---------------------------------------------------------------------------
const CLIST = 'https://push2.eastmoney.com/api/qt/clist/get'

export function parseUniverseRow(x) {
  const digits = Number.isInteger(x.f1) ? x.f1 : 3
  const price = Number(x.f2) / 10 ** digits
  const code = String(x.f12 ?? '').trim()
  if (!code) return null
  return {
    code, name: String(x.f14 ?? '').trim(), market: x.f13 === 1 ? 'sh' : 'sz',
    price: Number.isFinite(price) && price > 0 ? Number(price.toFixed(4)) : null,
    scale: Number(x.f20) > 0 ? Number(x.f20) : null,
  }
}

async function fetchUniverseEastmoney({ fetchImpl = fetch } = {}) {
  const out = new Map()
  let total = Infinity
  for (let pn = 1; out.size < total && pn <= 40; pn += 1) {
    const params = new URLSearchParams({
      pn: String(pn), pz: '100', po: '1', fid: 'f12', fs: 'b:MK0021,b:MK0022,b:MK0023,b:MK0024',
      fields: 'f1,f2,f12,f13,f14,f20',
    })
    const json = await request(`${CLIST}?${params}`, { headers: { Referer: 'https://quote.eastmoney.com/' }, fetchImpl, retries: 3 })
    const data = json?.data
    total = data?.total ?? 0
    const rows = Array.isArray(data?.diff) ? data.diff : Object.values(data?.diff ?? {})
    if (!rows.length) break
    for (const r of rows) {
      const row = parseUniverseRow(r)
      if (row) out.set(row.code, row)
    }
  }
  if (!out.size) throw new Error('东方财富 ETF 清单为空')
  return [...out.values()]
}

// 兜底：上交所 + 深交所官方清单（无价格，价格之后只给有国家队的 ETF 用新浪 K 线补）
const SSE_LIST = date => 'https://query.sse.com.cn/commonQuery.do?isPagination=true&pageHelp.pageSize=10000&pageHelp.pageNo=1'
  + `&pageHelp.beginPage=1&pageHelp.cacheSize=1&pageHelp.endPage=1&sqlId=COMMON_SSE_ZQPZ_ETFZL_XXPL_ETFGM_SEARCH_L&STAT_DATE=${date}`
const SZSE_INDEX = 'https://www.szse.cn/market/product/list/etfList/index.html'
const SZSE_LIST = page => `https://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1945&TABKEY=tab1&PAGENO=${page}&random=0.123`

export function parseSzseRow(row) {
  const code = /<u>(.*?)<\/u>/.exec(row?.sys_key ?? '')?.[1]?.trim()
  if (!code) return null
  const name = /<u>(.*?)<\/u>/.exec(row?.kzjcurl ?? '')?.[1]?.trim() ?? ''
  return { code, name, market: 'sz', price: null, scale: null }
}

async function fetchUniverseExchanges({ fetchImpl = fetch } = {}) {
  const out = new Map()
  const day = d => new Date(Date.now() + 8 * 3600 * 1000 - d * 86400000).toISOString().slice(0, 10)
  for (let back = 1; back <= 10 && !out.size; back += 1) {
    const json = await request(SSE_LIST(day(back)), { headers: { Referer: 'https://www.sse.com.cn/' }, fetchImpl, retries: 2 })
    for (const r of json?.result ?? []) {
      const code = String(r.SEC_CODE ?? '').trim()
      if (code) out.set(code, { code, name: String(r.SEC_NAME ?? '').trim(), market: 'sh', price: null, scale: null })
    }
  }
  // 深交所要先拿 cookie，否则返回空体
  const home = await fetchImpl(SZSE_INDEX, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) })
  const cookie = (home.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
  const headers = { Referer: SZSE_INDEX, Accept: 'application/json, text/javascript, */*; q=0.01', ...(cookie ? { Cookie: cookie } : {}) }
  let pages = 1
  for (let page = 1; page <= pages; page += 1) {
    const blocks = await request(SZSE_LIST(page), { headers, fetchImpl, retries: 3 })
    const block = blocks?.[0]
    pages = Number(block?.metadata?.pagecount) || pages
    for (const row of block?.data ?? []) {
      const parsed = parseSzseRow(row)
      if (parsed) out.set(parsed.code, parsed)
    }
  }
  if (!out.size) throw new Error('交易所 ETF 清单为空')
  return [...out.values()]
}

/** 优先东方财富（带价格与规模）；不可用时退到交易所清单。返回 { list, source }。 */
export async function fetchEtfUniverse(opts = {}) {
  try {
    return { list: await fetchUniverseEastmoney(opts), source: '东方财富' }
  } catch (error) {
    console.warn(`  ⚠ 东方财富 ETF 清单不可用（${error.message}），改用上交所/深交所清单`)
    return { list: await fetchUniverseExchanges(opts), source: '交易所' }
  }
}

// 新浪日 K：只取最近收盘价
export function parseKlineClose(text) {
  const m = /var\s+_data\s*=\s*\((\[[\s\S]*?\])\)/.exec(String(text))
  if (!m) return null
  try {
    const rows = JSON.parse(m[1])
    const close = Number(rows[rows.length - 1]?.close)
    return Number.isFinite(close) && close > 0 ? close : null
  } catch {
    return null
  }
}

export async function fetchLastClose(code, market, { fetchImpl = fetch } = {}) {
  const url = `https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_data=/CN_MarketDataService.getKLineData?symbol=${market}${code}&scale=240&ma=no&datalen=3`
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Referer: 'https://finance.sina.com.cn/' }, signal: AbortSignal.timeout(20000) })
      const close = parseKlineClose(await res.text())
      if (close) return close
    } catch { /* 重试 */ }
    await sleep(500 * attempt)
  }
  return null
}

// ---------------------------------------------------------------------------
// 新浪：报告期列表 + 十大持有人
// ---------------------------------------------------------------------------
const SINA_PAGE = code => `https://stock.finance.sina.com.cn/fundInfo/view/FundInfo_JJCYR.php?symbol=${code}`
const SINA_API = 'https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/CaihuiFundInfoService.getFundHolder'

export function parseReportDates(html) {
  return [...new Set([...String(html).matchAll(/<option\s+value="(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1]))].sort().reverse()
}

export async function fetchReportDates(code, { fetchImpl = fetch } = {}) {
  const html = await request(SINA_PAGE(code), { decode: 'gbk', fetchImpl })
  return parseReportDates(html)
}

/** 某报告期十大持有人 → 仅保留国家队行。 */
export function pickNationalTeam(rows) {
  const out = []
  for (const r of rows ?? []) {
    const holder = String(r.cyrmc ?? '').trim()
    const group = classifyHolder(holder)
    if (!group) continue
    out.push({ g: group, h: holder, shares: Number(r.cyfe) || 0, ratio: Number(r.zfeb) || 0 })
  }
  return out
}

export async function fetchNationalTeamHolders(code, date, { fetchImpl = fetch } = {}) {
  const json = await request(`${SINA_API}?${new URLSearchParams({ symbol: code, date })}`, {
    headers: { Referer: SINA_PAGE(code) }, fetchImpl,
  })
  return pickNationalTeam(json?.result?.data)
}

// ---------------------------------------------------------------------------
// 主题归类：按 ETF 名称关键词，顺序即优先级
// ---------------------------------------------------------------------------
const THEMES = [
  ['债券货币', /债|货币|利率|国债|可转债|短融|信用|城投/],
  ['黄金商品', /黄金|白银|豆粕|有色|能源化工|原油|商品|石油/],
  ['港股海外', /恒生|港股|H股|香港|纳指|纳斯达克|标普|道琼斯|日经|德国|法国|沙特|越南|印度|东南亚|中概|海外|美国|中韩|亚太/],
  ['半导体电子', /半导体|芯片|集成电路|电子|科创芯片|光刻|消费电子|元件/],
  ['人工智能软件', /人工智能|AI|机器人|软件|计算机|云计算|大数据|信创|数据|游戏|传媒|通信|5G|算力|互联网|信息技术|科技/],
  ['医药生物', /医药|医疗|生物|创新药|健康|中药|疫苗|器械/],
  ['证券保险', /证券|券商|保险|非银/],
  ['银行', /银行/],
  ['大金融', /金融/],
  ['房地产', /地产|房地产/],
  ['食品饮料消费', /消费|食品|饮料|白酒|酒|家电|畜牧|养殖|农业|旅游|零售|文娱/],
  ['新能源电力', /新能源|光伏|电池|储能|锂|电力|绿电|碳中和|风电|核电|电网|环保|能源|低碳|公用事业/],
  ['军工制造', /军工|国防|航空|航天|卫星|制造|装备|机械|汽车|智能驾驶|基建|工程|建材|钢铁|煤炭|化工|材料|稀土|资源|石化/],
  ['红利价值', /红利|股息|价值|低波|自由现金流|央企|国企|治理|成长|质量|动量/],
  ['宽基', /沪深300|上证50|中证500|中证1000|中证2000|中证A500|A500|A50|创业板|科创50|科创100|科创板|上证180|上证380|深证|100ETF|50ETF|300ETF|500ETF|1000ETF|MSCI|全指|综指|红利|北证|中小|大盘|科创|180|800|300|500|1000/],
]

export function classifyTheme(name) {
  const n = String(name ?? '')
  for (const [theme, re] of THEMES) if (re.test(n)) return theme
  return '其他'
}

// ---------------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------------

/**
 * cache: { [code]: { [date]: NtRow[] } }（空数组 = 查过、无国家队）
 * universe: [{code,name,price,scale}]
 * 只输出「历史上出现过国家队」的 ETF；latest 取该 ETF 自己最新已查报告期。
 */
export function buildEtfDataset(universe, cache, { generatedAt } = {}) {
  const byCode = new Map(universe.map(u => [u.code, u]))
  const etfs = []
  for (const [code, dates] of Object.entries(cache)) {
    const keys = Object.keys(dates).sort()
    if (!keys.some(d => dates[d].length)) continue
    const u = byCode.get(code)
    const hist = keys.map(d => {
      const nt = dates[d]
      return { d, shares: nt.reduce((a, r) => a + r.shares, 0), ratio: Number(nt.reduce((a, r) => a + r.ratio, 0).toFixed(2)), nt }
    })
    const latest = hist[hist.length - 1]
    const prev = hist.length > 1 ? hist[hist.length - 2] : null
    const holding = latest.nt.length > 0
    etfs.push({
      c: code, n: u?.name ?? code, theme: classifyTheme(u?.name), price: u?.price ?? null, scale: u?.scale ?? null,
      status: holding ? 'hold' : 'exited',
      latest: { d: latest.d, shares: latest.shares, ratio: latest.ratio },
      prev: prev ? { d: prev.d, shares: prev.shares, ratio: prev.ratio } : null,
      mv: holding && u?.price ? Math.round(latest.shares * u.price) : null,
      groups: [...new Set(latest.nt.map(r => r.g))],
      hist,
    })
  }
  etfs.sort((a, b) => (b.mv ?? -1) - (a.mv ?? -1))
  const holding = etfs.filter(e => e.status === 'hold')
  const themes = new Map()
  for (const e of holding) {
    const t = themes.get(e.theme) ?? { theme: e.theme, n: 0, mv: 0 }
    t.n += 1
    t.mv += e.mv ?? 0
    themes.set(e.theme, t)
  }
  const dates = [...new Set(etfs.flatMap(e => e.hist.map(h => h.d)))].sort()
  const latestDate = holding.map(e => e.latest.d).sort().pop() ?? null
  return {
    meta: {
      generatedAt, universeCount: universe.length, scanned: Object.keys(cache).length,
      numHolding: holding.length, numExited: etfs.length - holding.length,
      totalMv: holding.reduce((a, e) => a + (e.mv ?? 0), 0), latestDate, dates,
      themes: [...themes.values()].sort((a, b) => b.mv - a.mv),
    },
    etfs,
  }
}
