// node --test server/etf-uptrend-live.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_POOL, POOL_API, PERIOD_API, REASONS_API, TAG_KEYS, createHandler, fetchDetail, fetchLive, parsePool } from './etf-uptrend-live.mjs'

const ALL = [['589200', '科创200ETF工银', '20:589200'], ['159253', '银行ETF博时', '36:159253'], ['515020', '银行ETF华夏', '20:515020'], ['560670', '银行ETF华泰柏瑞', '20:560670']]
const pool = rows => ({ total: rows.length, indexes: [{ type: 'code' }, { type: 'simpleName' }, { type: 'tradeCode' }], itemList: rows.map(r => [r[2], r[1], r[0]]) })
const ok = data => ({ ok: true, status: 200, json: async () => ({ status_code: 0, data }) })

function fakeFetch({ failPool = false, failTags = false, endDay = '2026-11-16' } = {}) {
  const calls = []
  const impl = async (url, init) => {
    calls.push(url)
    if (url === POOL_API) {
      const p = JSON.parse(init.body); const c = p.custom; const f = c.filterList?.[0]?.type
      if (failPool && p.businessPoolKey === ALL_POOL && !f && !c.uniqueTracking) throw new Error('RemoteDisconnected')
      if (failTags && (p.businessPoolKey !== ALL_POOL || f || c.uniqueTracking)) return { ok: false, status: 503 }
      if (c.uniqueTracking) return ok(pool([ALL[0], ALL[2]]))
      if (f === 'last_day_step_signal') return ok(pool([ALL[3]]))
      if (f === 'new_up_trend') return ok(pool([ALL[0]]))
      if (p.businessPoolKey === ALL_POOL) return ok(pool(ALL))
      if (p.businessPoolKey.startsWith('f3e1')) return ok(pool([ALL[1]]))
      if (p.businessPoolKey.startsWith('012e')) return ok(pool(ALL.slice(1)))
      return ok(pool(ALL.slice(0, 2)))
    }
    if (url.startsWith(PERIOD_API)) return ok([{ start_day: '2026-11-04', end_day: endDay }, { start_day: '2026-09-16', end_day: '2026-09-23' }])
    if (url.startsWith(REASONS_API)) return ok([{ title: '原因', content: 'AI 文本' }])
    throw new Error(url)
  }
  return { impl, calls }
}
const bit = k => 1 << TAG_KEYS.indexOf(k)

test('名单按 indexes 对齐，条数不符视为不完整', () => {
  assert.equal(parsePool(pool(ALL))[0].code, '20:589200')
  assert.throws(() => parsePool({ ...pool(ALL), total: 9 }), /不完整/)
})

test('实时名单：标签位掩码、计数与来源截止日', async () => {
  const { impl, calls } = fakeFetch()
  const live = await fetchLive(impl, () => new Date('2026-11-16T14:00:00Z'))
  assert.equal(live.asof, '2026-11-16')
  assert.equal(live.at, '2026-11-16T22:00:00+08:00')
  assert.deepEqual(live.cats, TAG_KEYS)
  assert.deepEqual(live.rows[0], ['20:589200', '科创200ETF工银', bit('new_pool') | bit('broad_index') | bit('unique_rep')])
  assert.equal(live.rows[3][2], bit('trend_retracement') | bit('industry'))
  assert.deepEqual(live.n, { all: 4, trend_retracement: 1, new_pool: 1, t0: 1, industry: 3, broad_index: 2, unique_rep: 2 })
  assert.equal(calls.filter(u => u.startsWith(PERIOD_API)).length, 3)   // 只探测前 3 只
})

test('分类失败只缺分类；全量名单失败则报错', async () => {
  const live = await fetchLive(fakeFetch({ failTags: true }).impl)
  assert.deepEqual(live.cats, [])
  assert.equal(live.rows[0][2], 0)
  await assert.rejects(fetchLive(fakeFetch({ failPool: true }).impl), /RemoteDisconnected/)
})

test('单只详情：区间 + 最近区间的 AI 原因', async () => {
  const d = await fetchDetail(fakeFetch().impl, '20:589200')
  assert.equal(d.periods.length, 2)
  assert.deepEqual(Object.keys(d.reasons), ['2026-11-04'])
})

test('接口：校验代码、成功可缓存、失败不缓存', async () => {
  const res = () => ({ code: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v }, status(c) { this.code = c; return this }, json(b) { this.body = b; return this } })
  const h = createHandler(fakeFetch().impl)
  let r = res(); await h({ method: 'GET', query: { code: '20:58920' } }, r); assert.equal(r.code, 400)
  r = res(); await h({ method: 'POST', query: {} }, r); assert.equal(r.code, 405)
  r = res(); await h({ method: 'GET', query: {} }, r)
  assert.equal(r.code, 200); assert.match(r.headers['Cache-Control'], /s-maxage=600/); assert.equal(r.body.rows.length, 4)
  r = res(); await createHandler(fakeFetch({ failPool: true }).impl)({ method: 'GET', query: {} }, r)
  assert.equal(r.code, 502); assert.equal(r.headers['Cache-Control'], 'no-store')
})
