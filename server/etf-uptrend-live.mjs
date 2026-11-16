// ETF 主升浪「实时补拉」：页面打开时，存档快照比今天旧就调用这里，从同花顺公开接口取当前名单与分类标签，
// 展开某只 ETF 时再取它的历史区间与 AI 原因。结果只返回给页面、不存档；正式快照仍由 scripts/etf_uptrend.py 定时采集。
// 接口与口径与 scripts/etf_uptrend.py 一致（名单不带日期，来源截止日取当前名单前几只 ETF 最近区间 end_day 的最大值）。

export const SOURCE_PAGE = 'https://fund.10jqka.com.cn/thsjj-jj-fe-market-domain/uptrend-list/index.html#/'
export const POOL_API = 'https://fund.10jqka.com.cn/quotation/fund_pool/v2/query'
export const PERIOD_API = 'https://eq.10jqka.com.cn/open/api/etf_rank/etf/uptrend/v1/period/etf'
export const REASONS_API = 'https://eq.10jqka.com.cn/open/api/etf_rank/etf/uptrend/v1/ai/insights'
export const ALL_POOL = '1f3b943f-c5f4-312f-95b9-64de02642115'
export const TAG_KEYS = ['trend_retracement', 'new_pool', 't0', 'industry', 'broad_index', 'unique_rep']
// 标签 → [筛选类型, 名单池, 同类去重]；与 scripts/etf_uptrend.py 的 FILTERS / CATEGORY_POOLS 相同
const TAG_SOURCES = {
  trend_retracement: ['last_day_step_signal', ALL_POOL, false],
  new_pool: ['new_up_trend', ALL_POOL, false],
  t0: [null, 'f3e152a1-5cc0-3617-a89d-d68bdd0d1dab', false],
  industry: [null, '012e0cb0-f790-35ed-a369-eddc757f228e', false],
  broad_index: [null, 'd6d4b394-ab20-3f9d-9d65-a7589767c57a', false],
  unique_rep: [null, ALL_POOL, true],
}
const PROBE_COUNT = 3
const TIMEOUT_MS = 12000
const CODE_RE = /^(20|36):\d{6}$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function poolPayload(filterType = null, poolKey = ALL_POOL, unique = false) {
  const custom = { fieldList: ['code'], limit: 10000, offset: 0 }
  if (filterType) custom.filterList = [{ type: filterType, relation: 'AND', filterTypeQueryList: [{ cond: 'eq', value: '1' }] }]
  if (unique) custom.uniqueTracking = true
  return { businessKey: 'etfUpTrend', businessPoolKey: poolKey, custom }
}

/** 按 indexes[].type 对齐每行；条数与 total 不符视为不完整。 */
export function parsePool(data) {
  if (!data || !Array.isArray(data.itemList) || !Array.isArray(data.indexes)) throw new Error('名单响应结构不符')
  const fields = data.indexes.map(item => item.type)
  const rows = data.itemList.map(row => Object.fromEntries(fields.map((f, i) => [f, row[i]])))
  if (rows.length !== Number(data.total ?? rows.length)) throw new Error(`名单不完整：${rows.length} / ${data.total}`)
  if (rows.some(r => !CODE_RE.test(String(r.code)))) throw new Error('名单行缺少市场代码')
  return rows
}

export function sourceAsOf(periodLists) {
  const ends = periodLists.flat().map(p => p?.end_day).filter(d => typeof d === 'string' && DAY_RE.test(d))
  return ends.length ? ends.sort().at(-1) : null
}

async function thsJson(fetchImpl, url, payload) {
  const headers = { 'User-Agent': 'Mozilla/5.0', Referer: SOURCE_PAGE, Origin: 'https://fund.10jqka.com.cn' }
  const init = { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }
  if (payload) Object.assign(init, { method: 'POST', body: JSON.stringify(payload), headers: { ...headers, 'Content-Type': 'application/json' } })
  let last
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(url, init)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      if (!body || body.status_code !== 0) throw new Error(`接口返回错误 ${body?.status_code}`)
      return body.data
    } catch (err) { last = err }
  }
  throw last
}

/** 北京时间 ISO 字符串，与 scripts/etf_uptrend.py 的时间格式一致，如 2026-11-16T22:05:00+08:00。 */
export const shanghaiIso = date => new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 19) + '+08:00'

const periodUrl = code => { const [m, c] = code.split(':'); return `${PERIOD_API}/${m}/${c}` }

/** 当前名单 + 各标签位掩码 + 来源截止日。全量名单失败则抛错；单个标签失败只是缺这一分类（与存档快照同样处理）。 */
export async function fetchLive(fetchImpl, clock = () => new Date()) {
  const keys = Object.keys(TAG_SOURCES)
  const [all, ...tagResults] = await Promise.allSettled([
    thsJson(fetchImpl, POOL_API, poolPayload()).then(parsePool),
    ...keys.map(k => { const [f, p, u] = TAG_SOURCES[k]; return thsJson(fetchImpl, POOL_API, poolPayload(f, p, u)).then(parsePool) }),
  ])
  if (all.status !== 'fulfilled') throw all.reason
  if (!all.value.length) throw new Error('来源返回空名单')
  const tags = {}
  keys.forEach((k, i) => { if (tagResults[i].status === 'fulfilled') tags[k] = new Set(tagResults[i].value.map(r => r.code)) })
  const cats = TAG_KEYS.filter(k => tags[k])
  const rows = all.value.map(r => [r.code, r.simpleName ?? '', cats.reduce((s, k) => (tags[k].has(r.code) ? s | (1 << TAG_KEYS.indexOf(k)) : s), 0)])
  const probes = await Promise.allSettled(all.value.slice(0, PROBE_COUNT).map(r => thsJson(fetchImpl, periodUrl(r.code))))
  const asof = sourceAsOf(probes.filter(p => p.status === 'fulfilled' && Array.isArray(p.value)).map(p => p.value))
  const n = { all: rows.length }
  for (const k of cats) n[k] = rows.filter(r => r[2] & (1 << TAG_KEYS.indexOf(k))).length
  return { asof, at: shanghaiIso(clock()), cats, rows, n }
}

/** 单只 ETF 的历史区间，以及最近一个区间的 AI 上涨原因（原因失败不影响区间）。 */
export async function fetchDetail(fetchImpl, code, clock = () => new Date()) {
  const periods = await thsJson(fetchImpl, periodUrl(code))
  if (!Array.isArray(periods)) throw new Error('区间响应结构不符')
  const reasons = {}
  const latest = periods.reduce((a, b) => (!a || (b.start_day ?? '') > (a.start_day ?? '') ? b : a), null)
  if (latest?.start_day && DAY_RE.test(latest.start_day)) {
    const [m, c] = code.split(':')
    try {
      const items = await thsJson(fetchImpl, `${REASONS_API}/${m}/${c}/${latest.start_day}`)
      if (Array.isArray(items)) reasons[latest.start_day] = items.map(it => ({ title: String(it?.title ?? ''), content: String(it?.content ?? '') }))
    } catch { /* 原因取不到时只给区间 */ }
  }
  return { at: shanghaiIso(clock()), periods, reasons }
}

export function createHandler(fetchImpl = (...args) => fetch(...args)) {
  return async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: '只支持 GET' })
    const code = req.query?.code
    if (code !== undefined && (typeof code !== 'string' || !CODE_RE.test(code))) return res.status(400).json({ error: '代码格式应为 20:589200 或 36:159887' })
    try {
      const body = code ? await fetchDetail(fetchImpl, code) : await fetchLive(fetchImpl)
      // 边缘缓存 10 分钟：多人同时打开也只向来源请求一次
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600')
      return res.status(200).json(body)
    } catch (err) {
      res.setHeader('Cache-Control', 'no-store')
      return res.status(502).json({ error: `同花顺接口请求失败：${err instanceof Error ? err.message : String(err)}` })
    }
  }
}

export default createHandler()
