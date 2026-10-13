import { readFile } from 'node:fs/promises'

const INDEX_NAMES = { sh000001: '上证指数', sz399001: '深证成指', sz399006: '创业板指' }
const SINA = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/'
const POOL_TOKEN = '7eea3edcaed734bea9cbfc24409ed989'
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places
const shanghaiDate = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const number = value => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
const dateString = value => {
  const text = String(value).replace(/-/g, '')
  if (!/^\d{8}$/.test(text)) return null
  const result = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}`
  const parsed = new Date(`${result}T00:00:00Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === result ? result : null
}

function parsePool(body, today, needsBoards = false) {
  const { data } = body ?? {}
  const date = dateString(data?.qdate)
  if (body?.rc !== 0 || !date || date > today || !Array.isArray(data.pool)
    || !Number.isInteger(data.tc) || data.tc !== data.pool.length) throw new Error('股池日期或完整性校验失败')
  const rows = data.pool.map(row => {
    const boards = number(row.lbc)
    if (!/^\d{6}$/.test(row.c) || typeof row.n !== 'string' || !row.n.trim()
      || (needsBoards && (!Number.isInteger(boards) || boards < 1))) throw new Error('股池字段不完整')
    return { code: row.c, name: row.n, boards: needsBoards ? boards : 0 }
  })
  if (new Set(rows.map(row => row.code)).size !== rows.length) throw new Error('股池含重复证券，无法确认完整性')
  return { date, rows }
}

function parseQuotes(text, today) {
  const quotes = new Map()
  for (const match of text.matchAll(/v_((?:sh|sz|bj)\d{6})="([^"]*)"/g)) {
    const fields = match[2].split('~')
    const date = dateString(fields[30]?.slice(0, 8))
    const price = number(fields[3]), change = number(fields[32])
    if (!date || date > today || price === null || price <= 0 || change === null) continue
    const rawAmount = number(fields[35]?.split('/')[2])
    const tenThousands = number(fields[37])
    const amount = rawAmount ?? (tenThousands === null ? null : tenThousands * 10000)
    const turnover = number(fields[38])
    quotes.set(match[1], {
      symbol: match[1], code: match[1].slice(2), name: INDEX_NAMES[match[1]] ?? fields[1], date,
      price, change, amount: amount !== null && amount >= 0 ? amount : null,
      turnover: turnover !== null && turnover >= 0 ? turnover : null,
    })
  }
  if (!quotes.size) throw new Error('报价没有有效交易日期')
  return quotes
}

function parseCandidates(body) {
  if (!Array.isArray(body) || !body.length || body.length > 5
    || body.some(row => !/^(sh|sz|bj)\d{6}$/.test(row?.symbol))
    || new Set(body.map(row => row.symbol)).size !== body.length) throw new Error('榜单为空或格式异常')
  return body.map(row => row.symbol)
}

function parseFlows(body) {
  if (!Array.isArray(body) || !body.length || body.some(row => typeof row?.name !== 'string' || number(row.netamount) === null)) throw new Error('行业资金流格式异常')
  const rows = body.map(row => ({ name: row.name, amount: round(Number(row.netamount) / 1e8) }))
  return {
    inflow: rows.filter(row => row.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5),
    outflow: rows.filter(row => row.amount < 0).sort((a, b) => a.amount - b.amount).slice(0, 5),
  }
}

// 与上交所 2026 休市通知一致；未知年份不猜测相邻交易日，晋级率保留缺失。
function previousMarketDate(date) {
  if (!date.startsWith('2026-')) return null
  const holidays = [['01-01', '01-03'], ['02-15', '02-23'], ['04-04', '04-06'], ['05-01', '05-05'], ['06-19', '06-21'], ['09-25', '09-27'], ['10-01', '10-07']]
  const d = new Date(`${date}T00:00:00Z`)
  do { d.setUTCDate(d.getUTCDate() - 1) } while ([0, 6].includes(d.getUTCDay()) || holidays.some(([start, end]) => d.toISOString().slice(5, 10) >= start && d.toISOString().slice(5, 10) <= end))
  return d.toISOString().slice(0, 10)
}

export async function readDailyArchive() {
  try {
    const body = JSON.parse(await readFile(new URL('../public/data/daily-analysis.json', import.meta.url), 'utf8'))
    return body.schemaVersion === 1 && Array.isArray(body.snapshots) ? body.snapshots : []
  } catch { return [] }
}

export async function buildDailyAnalysis({ fetchImpl = fetch, now = new Date(), history } = {}) {
  const today = shanghaiDate(now)
  const fetchedAt = now.toISOString()
  const sources = []
  const get = async (url, kind = 'json') => {
    const response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.sina.com.cn/' }, signal: AbortSignal.timeout(7000), redirect: 'error' })
    if (!response.ok) throw new Error(`数据源 HTTP ${response.status}`)
    return kind === 'quotes' ? new TextDecoder('gb18030').decode(await response.arrayBuffer()) : response.json()
  }
  const collect = async (id, label, url, parser, kind) => {
    const source = { id, label, url, date: null, status: 'unavailable', note: '' }
    sources.push(source)
    try { return { source, value: parser(await get(url, kind)) } }
    catch (error) { source.note = error instanceof Error ? error.message : '数据源暂时不可用'; return { source, value: null } }
  }
  const poolUrl = (path, sort) => `https://push2ex.eastmoney.com/${path}?${new URLSearchParams({ ut: POOL_TOKEN, dpt: 'wz.ztzt', Pageindex: '0', pagesize: '10000', sort, date: today.replace(/-/g, '') })}`
  const rankUrl = sort => `${SINA}Market_Center.getHQNodeData?${new URLSearchParams({ node: 'hs_a', sort, asc: '0', num: '5', page: '1' })}`
  const [indices, up, broken, down, amount, turnover, flows] = await Promise.all([
    collect('indices', '腾讯指数行情', `https://qt.gtimg.cn/q=${Object.keys(INDEX_NAMES).join(',')}`, raw => parseQuotes(raw, today), 'quotes'),
    collect('limitUp', '东方财富涨停股池', poolUrl('getTopicZTPool', 'fbt:asc'), body => parsePool(body, today, true)),
    collect('brokenUp', '东方财富炸板股池', poolUrl('getTopicZBPool', 'fbt:asc'), body => parsePool(body, today)),
    collect('limitDown', '东方财富跌停股池', poolUrl('getTopicDTPool', 'fund:asc'), body => parsePool(body, today)),
    collect('amountRank', '新浪成交额排名 / 腾讯报价', rankUrl('amount'), parseCandidates),
    collect('turnoverRank', '新浪换手率排名 / 腾讯报价', rankUrl('turnoverratio'), parseCandidates),
    collect('flows', '新浪行业资金流', `${SINA}MoneyFlow.ssl_bkzj_bk?paixu=op%2Fturnover&fenlei=0`, parseFlows),
  ])
  const symbols = [...new Set([...(amount.value ?? []), ...(turnover.value ?? [])])]
  let rankQuotes = new Map()
  if (symbols.length) {
    try { rankQuotes = parseQuotes(await get(`https://qt.gtimg.cn/q=${symbols.join(',')}`, 'quotes'), today) }
    catch { /* 排名必须用实际报价日期校验；失败时不展示未核验的榜单。 */ }
  }
  const dates = [...(indices.value?.values() ?? []), ...rankQuotes.values()].map(row => row.date)
  dates.push(...[up, broken, down].flatMap(result => result.value ? [result.value.date] : []))
  const dataDate = dates.sort().at(-1)
  if (!dataDate) throw new Error('暂未取得可核验交易日期的行情，请稍后刷新')
  const aligned = result => {
    if (!result.value) return null
    result.source.date = result.value.date
    if (result.value.date !== dataDate) { result.source.note = `返回 ${result.value.date}，与 ${dataDate} 不一致，已排除`; return null }
    result.source.status = 'ready'
    return result.value.rows
  }
  const upStocks = aligned(up), brokenStocks = aligned(broken), downStocks = aligned(down)
  const indexRows = [...(indices.value?.values() ?? [])].filter(row => row.date === dataDate && row.symbol in INDEX_NAMES)
  if (indices.value) {
    indices.source.date = [...indices.value.values()].map(row => row.date).sort().at(-1) ?? null
    indices.source.status = indexRows.length === 3 ? 'ready' : indexRows.length ? 'partial' : 'unavailable'
    if (indexRows.length !== 3) indices.source.note = '部分指数缺失或日期不一致，未取得的数值显示 —'
  }
  const rankings = { amount: [], turnover: [] }
  for (const [key, result] of [['amount', amount], ['turnover', turnover]]) {
    if (!result.value) continue
    const rows = result.value.map(symbol => rankQuotes.get(symbol)).filter(row => row?.date === dataDate && row[key] !== null)
    rankings[key] = rows.map(row => ({ ...row, amount: row.amount === null ? null : round(row.amount / 1e8) })).sort((a, b) => b[key] - a[key])
    result.source.status = rows.length === 5 ? 'ready' : rows.length ? 'partial' : 'unavailable'
    result.source.date = rows.length ? dataDate : null
    if (rows.length !== 5) result.source.note = rows.length ? `仅取得 ${rows.length} 只日期匹配的股票` : '未取得日期匹配的报价，榜单已排除'
  }
  if (flows.value) { flows.source.status = 'undated'; flows.source.note = '源未标注交易日期；仅代表本次获取的行业资金流快照，非主力净流入口径' }
  const sh = indexRows.find(row => row.symbol === 'sh000001'), sz = indexRows.find(row => row.symbol === 'sz399001')
  const boards = new Map()
  for (const row of upStocks ?? []) if (row.boards >= 2) boards.set(row.boards, [...(boards.get(row.boards) ?? []), row])
  const previousDate = previousMarketDate(dataDate)
  const archives = history ?? await readDailyArchive()
  const previous = archives.find(row => row.dataDate === previousDate && row.sources?.some(source => source.id === 'limitUp' && source.status === 'ready'))
  const currentCodes = new Set((upStocks ?? []).map(row => row.code))
  const lbRate = upStocks && previous?.upStocks?.length
    ? round(previous.upStocks.filter(row => currentCodes.has(row.code)).length / previous.upStocks.length * 100, 1) : null
  const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).replace(':', ''))
  return {
    schemaVersion: 1, dataDate, fetchedAt,
    session: dataDate !== today ? 'previous' : localHour >= 1515 ? 'closed' : 'intraday',
    metrics: {
      ztCount: upStocks?.length ?? null, ztOpen: brokenStocks?.length ?? null,
      ztSealRate: upStocks && brokenStocks && upStocks.length + brokenStocks.length > 0 ? round(upStocks.length / (upStocks.length + brokenStocks.length) * 100, 1) : null,
      dtCount: downStocks?.length ?? null, dtOpen: null, dtSealRate: null,
      volume: sh?.amount !== null && sz?.amount !== null && sh?.amount !== undefined && sz?.amount !== undefined ? round((sh.amount + sz.amount) / 1e8) : null,
      upCount: null, downCount: null,
      lbCount: upStocks ? upStocks.filter(row => row.boards >= 2).length : null,
      maxBoard: upStocks ? Math.max(0, ...upStocks.map(row => row.boards)) : null, lbRate,
    },
    indices: indexRows.map(({ amount: _amount, turnover: _turnover, ...row }) => row),
    upStocks: upStocks ?? [],
    ladder: [...boards].sort(([a], [b]) => b - a).map(([height, stocks]) => ({ boards: height, stocks })),
    rankings, flows: flows.value ?? { inflow: [], outflow: [] }, sources,
  }
}

export async function handleDailyAnalysis(req, res, builder = buildDailyAnalysis) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET, OPTIONS'); return res.status(405).json({ error: '只支持 GET 请求' }) }
  try {
    const snapshot = await builder()
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=120')
    return res.status(200).json(snapshot)
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).json({ error: '暂未取得可核验日期的行情，请稍后刷新；可继续查看已保存的快照' })
  }
}

export function dailyAnalysisMiddleware(req, res, next) {
  if (new URL(req.url, 'http://localhost').pathname !== '/api/daily-analysis') return next()
  const adapter = {
    setHeader: (key, value) => res.setHeader(key, value), status(code) { res.statusCode = code; return this },
    json(body) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)) }, end() { res.end() },
  }
  void handleDailyAnalysis(req, adapter)
}
