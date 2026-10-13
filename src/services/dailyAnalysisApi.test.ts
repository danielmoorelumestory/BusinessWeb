import { describe, expect, it } from 'vitest'
import { buildDailyAnalysis, handleDailyAnalysis } from '../../server/daily-analysis.mjs'

const NOW = new Date('2026-10-12T08:00:00Z')
const quote = (symbol: string, amount: number, change = 1, date = '20261012', turnover = 2) => {
  const fields = Array(60).fill('')
  Object.assign(fields, { 1: symbol, 2: symbol.slice(2), 3: '100', 4: '99', 30: `${date}150001`, 32: String(change), 35: `100/10/${amount}`, 37: String(amount / 10000), 38: String(turnover) })
  return `v_${symbol}="${fields.join('~')}";`
}
const stock = (c: string, lbc: number) => ({ c, n: c, lbc })
const pool = (stocks: unknown[], qdate = 20261012, tc = stocks.length) => ({ rc: 0, data: { qdate, tc, pool: stocks } })
const candidates = [{ symbol: 'sz000001', name: '平安银行' }, { symbol: 'sh600000', name: '浦发银行' }]

function fixtureFetch(overrides: Record<string, unknown | Error> = {}) {
  return async (input: string | URL | Request) => {
    const url = new URL(String(input))
    let key: string, body: unknown
    if (url.hostname === 'qt.gtimg.cn') {
      const symbols = url.pathname.slice('/q='.length).split(',')
      key = symbols.includes('sh000001') ? 'indices' : 'rankQuotes'
      body = key === 'indices'
        ? quote('sh000001', 100e8, 1) + quote('sz399001', 200e8, -2) + quote('sz399006', 50e8, 3)
        : quote('sz000001', 10e8, 1, '20261012', 20) + quote('sh600000', 5e8, -1, '20261012', 40)
    } else if (url.pathname.endsWith('getTopicZTPool')) {
      key = 'up'; body = pool([stock('000001', 3), stock('600000', 2), stock('600001', 1)])
    } else if (url.pathname.endsWith('getTopicZBPool')) {
      key = 'broken'; body = pool([stock('600002', 0)])
    } else if (url.pathname.endsWith('getTopicDTPool')) {
      key = 'down'; body = pool([stock('600003', 0)])
    } else if (url.pathname.includes('ssl_bkzj_bk')) {
      key = 'flows'; body = [{ name: '银行', netamount: '200000000', category: 'new_jrhy' }, { name: '软件', netamount: '-100000000', category: 'new_dzxx' }]
    } else {
      key = url.searchParams.get('sort') === 'amount' ? 'amount' : 'turnover'; body = candidates
    }
    const value = key in overrides ? overrides[key] : body
    if (value instanceof Error) throw value
    return new Response(typeof value === 'string' ? value : JSON.stringify(value))
  }
}

describe('每日分析：真实字段聚合与日期隔离', () => {
  it('自动统计股池和封板率，两市成交额不重复叠加创业板', async () => {
    const data = await buildDailyAnalysis({ fetchImpl: fixtureFetch(), now: NOW, history: [] })
    expect(data.dataDate).toBe('2026-10-12')
    expect(data.metrics).toMatchObject({ ztCount: 3, ztOpen: 1, ztSealRate: 75, dtCount: 1, volume: 300, lbCount: 2, maxBoard: 3 })
    expect(data.ladder.map(level => level.boards)).toEqual([3, 2])
    expect(data.rankings.amount.map(row => row.symbol)).toEqual(['sz000001', 'sh600000'])
    expect(data.rankings.turnover.map(row => row.symbol)).toEqual(['sh600000', 'sz000001'])
    expect(data.flows.inflow[0]).toMatchObject({ name: '银行', amount: 2 })
    expect(data.flows.outflow[0]).toMatchObject({ name: '软件', amount: -1 })
    expect(data.sources.find(source => source.id === 'flows')).toMatchObject({ date: null, status: 'undated' })
  })

  it('接口失败是缺失，不会伪装成零跌停或零打开', async () => {
    const data = await buildDailyAnalysis({ fetchImpl: fixtureFetch({ down: new Error('offline') }), now: NOW, history: [] })
    expect(data.metrics.dtCount).toBeNull()
    expect(data.metrics.dtOpen).toBeNull()
    expect(data.metrics.dtSealRate).toBeNull()
    expect(data.metrics.upCount).toBeNull()
    expect(data.metrics.ztCount).toBe(3)
    expect(data.sources.find(source => source.id === 'limitDown')?.status).toBe('unavailable')
  })

  it('同日完整空股池是有效零值，零分母封板率仍为缺失', async () => {
    const data = await buildDailyAnalysis({ fetchImpl: fixtureFetch({ up: pool([]), broken: pool([]), down: pool([]) }), now: NOW, history: [] })
    expect(data.metrics.ztCount).toBe(0)
    expect(data.metrics.dtCount).toBe(0)
    expect(data.metrics.ztSealRate).toBeNull()
    expect(data.metrics.maxBoard).toBe(0)
  })

  it('拒绝混入旧交易日、未来日期和不完整股池', async () => {
    const data = await buildDailyAnalysis({ fetchImpl: fixtureFetch({ up: pool([stock('000001', 2)], 20261009), broken: pool([], 20261013), down: pool([], 20261012, 10) }), now: NOW, history: [] })
    expect(data.dataDate).toBe('2026-10-12')
    expect(data.metrics.ztCount).toBeNull()
    expect(data.metrics.ztOpen).toBeNull()
    expect(data.metrics.dtCount).toBeNull()
    expect(data.ladder).toEqual([])
  })

  it('排行榜只有报价日期匹配时才展示，缺失不会保留成今天的榜单', async () => {
    const data = await buildDailyAnalysis({ fetchImpl: fixtureFetch({ rankQuotes: quote('sz000001', 10e8, 1, '20261009') + quote('sh600000', 5e8, 1, '20261009') }), now: NOW, history: [] })
    expect(data.rankings.amount).toEqual([])
    expect(data.rankings.turnover).toEqual([])
    expect(data.metrics.ztCount).toBe(3)
  })

  it('连板晋级只比较上一交易日同源涨停股票，缺档不跳日计算', async () => {
    const prev = await buildDailyAnalysis({ fetchImpl: fixtureFetch(), now: NOW, history: [] })
    const history = [{ ...prev, dataDate: '2026-10-09', upStocks: [{ code: '000001', name: '平安银行', boards: 2 }, { code: '600099', name: '林海股份', boards: 1 }] }]
    const data = await buildDailyAnalysis({ fetchImpl: fixtureFetch(), now: NOW, history })
    expect(data.metrics.lbRate).toBe(50)
    const skipped = await buildDailyAnalysis({ fetchImpl: fixtureFetch(), now: NOW, history: [{ ...history[0], dataDate: '2026-10-08' }] })
    expect(skipped.metrics.lbRate).toBeNull()
  })

  it('全市场日期无法确认时失败，不以采集当天冒充交易日期', async () => {
    const error = new Error('offline')
    await expect(buildDailyAnalysis({ fetchImpl: fixtureFetch({ indices: error, up: error, down: error, broken: error, rankQuotes: error }), now: NOW, history: [] })).rejects.toThrow()
  })

  it('休市展示来源返回的最近交易日，不生成周末记录', async () => {
    const data = await buildDailyAnalysis({ fetchImpl: fixtureFetch(), now: new Date('2026-10-17T08:00:00Z'), history: [] })
    expect(data.dataDate).toBe('2026-10-12')
    expect(data.session).toBe('previous')
  })
})

describe('每日分析接口边界', () => {
  it('拒绝写入方法，聚合失败返回错误状态', async () => {
    const response = () => ({ code: 200, body: null as unknown, headers: {} as Record<string, string>, setHeader(k: string, v: string) { this.headers[k] = v }, status(code: number) { this.code = code; return this }, json(body: unknown) { this.body = body; return this }, end() {} })
    const put = response()
    await handleDailyAnalysis({ method: 'PUT', query: {} }, put)
    expect(put.code).toBe(405)
    const failed = response()
    await handleDailyAnalysis({ method: 'GET', query: {} }, failed, async () => { throw new Error('provider unavailable') })
    expect(failed.code).toBe(503)
    expect(failed.body).toMatchObject({ error: expect.any(String) })
  })
})
