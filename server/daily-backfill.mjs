// 一次性回补历史交易日：东方财富股池按 date 参数返回历史数据（其 qdate 字段只是最新交易日，不是请求日期），
// 因此每个日期都用财联社的最高板、连板股数交叉核验，对不上就丢弃，不写入归档。
const POOL_TOKEN = '7eea3edcaed734bea9cbfc24409ed989'
const INDEXES = { sh000001: '上证指数', sz399001: '深证成指', sz399006: '创业板指' }
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places
const compact = date => date.replace(/-/g, '')
const UA = { 'User-Agent': 'Mozilla/5.0' }

async function getJson(fetchImpl, url, headers = {}, attempts = 2) {
  let error
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetchImpl(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(12000), redirect: 'error' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (e) { error = e }
  }
  throw error
}

export async function fetchCalendar(fetchImpl, count) {
  const out = {}
  for (const symbol of Object.keys(INDEXES)) {
    const body = await getJson(fetchImpl, `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?${new URLSearchParams({ param: `${symbol},day,,,${count},qfq` })}`)
    const rows = body?.data?.[symbol]?.day
    if (!Array.isArray(rows) || rows.length < 2) throw new Error(`${symbol} 日 K 线为空`)
    out[symbol] = rows.map(row => ({ date: row[0], close: Number(row[2]) })).filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.close > 0)
  }
  return out
}

export function parsePoolForDate(body, withBoards) {
  const data = body?.data
  if (body?.rc !== 0 || !data || !Array.isArray(data.pool) || !Number.isInteger(data.tc) || data.tc !== data.pool.length) throw new Error('股池完整性校验失败')
  const rows = data.pool.map(row => {
    const boards = Number(row.lbc)
    if (!/^\d{6}$/.test(row.c) || typeof row.n !== 'string' || !row.n.trim() || (withBoards && (!Number.isInteger(boards) || boards < 1))) throw new Error('股池字段不完整')
    return { code: row.c, name: row.n, boards: withBoards ? boards : 0 }
  })
  if (new Set(rows.map(row => row.code)).size !== rows.length) throw new Error('股池含重复证券')
  return rows
}

const poolUrl = (kind, sort, date) => `https://push2ex.eastmoney.com/getTopic${kind}?${new URLSearchParams({ ut: POOL_TOKEN, dpt: 'wz.ztzt', Pageindex: '0', pagesize: '10000', sort, date: compact(date) })}`

async function fetchPools(fetchImpl, date) {
  const up = parsePoolForDate(await getJson(fetchImpl, poolUrl('ZTPool', 'fbt:asc', date)), true)
  if (!up.length) return null // 休市日或超出东方财富保留期
  const [broken, down] = await Promise.all([
    getJson(fetchImpl, poolUrl('ZBPool', 'fbt:asc', date)).then(body => parsePoolForDate(body, false)),
    getJson(fetchImpl, poolUrl('DTPool', 'fund:asc', date)).then(body => parsePoolForDate(body, false)),
  ])
  return { up, broken, down }
}

async function clsBoards(fetchImpl, date) {
  const body = await getJson(fetchImpl, `https://x-quote.cls.cn/v2/quote/a/plate/up_down_analysis?up_limit=0&date=${compact(date)}`, { Referer: 'https://www.cls.cn/' })
  const levels = body?.data?.continuous_limit_up
  const times = (body?.data?.plate_stock ?? []).flatMap(plate => plate?.stock_list ?? []).map(stock => String(stock?.time ?? '')).filter(time => /^\d{4}-/.test(time))
  if (body?.code !== 200 || !Array.isArray(levels) || !times.length || times.some(time => time.slice(0, 10) !== date)) throw new Error('财联社日期校验失败')
  return { maxBoard: Math.max(0, ...levels.map(level => level.height)), lbCount: levels.filter(level => level.height >= 2).reduce((sum, level) => sum + level.stock_list.length, 0) }
}

export async function buildBackfill({ fetchImpl = fetch, days = 25, now = new Date(), history = [] } = {}) {
  const calendar = await fetchCalendar(fetchImpl, days + 15)
  const dates = calendar.sh000001.map(row => row.date)
  const have = new Set(history.filter(row => row.sources?.some(source => source.id === 'limitUp' && source.status === 'ready')).map(row => row.dataDate))
  const targets = dates.slice(1).slice(-days).filter(date => !have.has(date))
  const poolsOf = new Map()
  const poolFor = async date => { if (!poolsOf.has(date)) poolsOf.set(date, fetchPools(fetchImpl, date).catch(() => undefined)); return poolsOf.get(date) }
  const snapshots = [], skipped = []
  for (const date of targets) {
    const pools = await poolFor(date)
    if (!pools) { skipped.push({ date, reason: pools === undefined ? '股池获取或校验失败' : '无股池数据（休市或超出保留期）' }); continue }
    const eastmoney = { maxBoard: Math.max(...pools.up.map(row => row.boards)), lbCount: pools.up.filter(row => row.boards >= 2).length }
    let cls
    try { cls = await clsBoards(fetchImpl, date) } catch { skipped.push({ date, reason: '财联社交叉核验失败，不写入' }); continue }
    if (cls.maxBoard !== eastmoney.maxBoard || cls.lbCount !== eastmoney.lbCount) { skipped.push({ date, reason: `与财联社不一致（最高板 ${eastmoney.maxBoard}/${cls.maxBoard}，连板 ${eastmoney.lbCount}/${cls.lbCount}）` }); continue }
    const i = dates.indexOf(date), previousDate = dates[i - 1]
    const previousRows = history.find(row => row.dataDate === previousDate && row.upStocks?.length)?.upStocks ?? (await poolFor(previousDate))?.up
    const codes = new Set(pools.up.map(row => row.code))
    const lbRate = previousRows?.length ? round(previousRows.filter(row => codes.has(row.code)).length / previousRows.length * 100, 1) : null
    const indices = Object.entries(INDEXES).flatMap(([symbol, name]) => {
      const rows = calendar[symbol], at = rows.findIndex(row => row.date === date)
      return at > 0 ? [{ symbol, code: symbol.slice(2), name, date, price: rows[at].close, change: round((rows[at].close / rows[at - 1].close - 1) * 100) }] : []
    })
    const boards = new Map()
    for (const row of pools.up) if (row.boards >= 2) boards.set(row.boards, [...(boards.get(row.boards) ?? []), row])
    const note = '按日期回补，最高板与连板股数已用财联社交叉核验'
    snapshots.push({
      schemaVersion: 1, dataDate: date, fetchedAt: now.toISOString(), session: 'closed',
      metrics: {
        ztCount: pools.up.length, ztOpen: pools.broken.length,
        ztSealRate: round(pools.up.length / (pools.up.length + pools.broken.length) * 100, 1),
        dtCount: pools.down.length, dtOpen: null, dtSealRate: null, volume: null, upCount: null, downCount: null,
        lbCount: eastmoney.lbCount, maxBoard: eastmoney.maxBoard, lbRate,
      },
      indices, upStocks: pools.up,
      ladder: [...boards].sort(([a], [b]) => b - a).map(([height, stocks]) => ({ boards: height, stocks })),
      rankings: { amount: [], turnover: [] }, flows: { inflow: [], outflow: [] },
      sources: [
        { id: 'indices', label: '腾讯指数日 K 线', url: 'https://web.ifzq.gtimg.cn/', date: indices.length === 3 ? date : null, status: indices.length === 3 ? 'ready' : indices.length ? 'partial' : 'unavailable', note: '历史回补，涨跌幅由相邻收盘价计算' },
        { id: 'limitUp', label: '东方财富涨停股池', url: 'https://quote.eastmoney.com/ztb/', date, status: 'ready', note },
        { id: 'brokenUp', label: '东方财富炸板股池', url: 'https://quote.eastmoney.com/ztb/', date, status: 'ready', note: '按日期回补' },
        { id: 'limitDown', label: '东方财富跌停股池', url: 'https://quote.eastmoney.com/ztb/', date, status: 'ready', note: '按日期回补' },
        { id: 'amountRank', label: '新浪成交额排名 / 腾讯报价', url: 'https://finance.sina.com.cn/', date: null, status: 'unavailable', note: '历史回补不含榜单' },
        { id: 'turnoverRank', label: '新浪换手率排名 / 腾讯报价', url: 'https://finance.sina.com.cn/', date: null, status: 'unavailable', note: '历史回补不含榜单' },
        { id: 'flows', label: '新浪行业资金流', url: 'https://finance.sina.com.cn/', date: null, status: 'unavailable', note: '历史回补不含资金流' },
      ],
    })
  }
  return { snapshots, skipped }
}
