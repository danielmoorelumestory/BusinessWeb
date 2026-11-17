import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  beijingDayUnix, secToBeijingDate, parseFlowGateway, parseSinaKline,
  toYi, mergeSeries, cumulative, kpiOf, fetchFlowHistory, fetchIndexHistory,
  FLOW_INDEX_ALL, FLOW_INDEX_BROAD,
} from './etf-flow.mjs'

// —— 北京时区 unix 互转（固定 UTC+8，无夏令时） ——
test('beijingDayUnix: 北京 00:00 = 前一日 16:00 UTC', () => {
  // 2026-11-17T00:00:00+08:00 === 2026-11-16T16:00:00Z
  assert.equal(beijingDayUnix('2026-11-17'), Date.UTC(2026, 10, 16, 16, 0, 0) / 1000)
})
test('secToBeijingDate: 秒级时间戳 → 北京日期', () => {
  assert.equal(secToBeijingDate(beijingDayUnix('2026-11-17')), '2026-11-17')
  // 同花顺 time_range 里的真实点（2026-11-16 的 0 点附近）
  assert.equal(secToBeijingDate(1794758400), '2026-11-16')
})
test('两者互逆', () => {
  for (const d of ['2024-01-02', '2026-05-06', '2026-11-16']) {
    assert.equal(secToBeijingDate(beijingDayUnix(d)), d)
  }
})

// —— 解析同花顺 gateway 资金流响应 ——
const gw = (timeRange, values, status = 0) => ({
  status_code: status, status_msg: 'Success',
  data: { time_range: timeRange, data: [{ values: [{ idx: 0, values }] }] },
})
test('parseFlowGateway: time_range 与 values 按序配对，单位元', () => {
  const r = parseFlowGateway(gw(['1777996800', '1778083200'], [12167617980.43, -873311115]))
  assert.equal(r.length, 2)
  assert.equal(r[0].yuan, 12167617980.43)
  assert.equal(r[1].yuan, -873311115)
  assert.match(r[0].date, /^\d{4}-\d{2}-\d{2}$/)
})
test('parseFlowGateway: null 值保留为 null（当日金额未准备）', () => {
  const r = parseFlowGateway(gw(['1777996800'], [null]))
  assert.equal(r[0].yuan, null)
})
test('parseFlowGateway: status_code 非 0 或结构缺失 → 空数组', () => {
  assert.deepEqual(parseFlowGateway(gw(['1'], [1], 2003)), [])
  assert.deepEqual(parseFlowGateway({}), [])
  assert.deepEqual(parseFlowGateway({ status_code: 0, data: {} }), [])
})

// —— 解析 sina 日K ——
test('parseSinaKline: day→close，去非正收盘', () => {
  const m = parseSinaKline([
    { day: '2026-11-13', close: '3715.4' },
    { day: '2026-11-16', close: '3602.57' },
    { day: '2026-11-17', close: '0' },      // 无效收盘丢弃
  ])
  assert.equal(m.get('2026-11-16'), 3602.57)
  assert.equal(m.has('2026-11-17'), false)
})
test('parseSinaKline: 空/非数组 → 空 Map', () => {
  assert.equal(parseSinaKline(null).size, 0)
  assert.equal(parseSinaKline([]).size, 0)
})

// —— 元转亿 ——
test('toYi: 元 → 亿元（两位小数）', () => {
  assert.equal(toYi(20657277210), 206.57)
  assert.equal(toYi(-14943813840), -149.44)
})

// —— 合并为序列 ——
test('mergeSeries: 全A行 + 宽基行 + 指数 → 序列，各转亿、按日对齐、补 index', () => {
  const all = [{ date: '2026-11-13', yuan: -14943813840 }, { date: '2026-11-16', yuan: 20657277210 }]
  const broad = [{ date: '2026-11-13', yuan: -13179000000 }, { date: '2026-11-16', yuan: 17620000000 }]
  const idx = new Map([['2026-11-16', 3602.57]])
  const s = mergeSeries(all, broad, idx)
  assert.deepEqual(s[0], { date: '2026-11-13', flow_all: -149.44, flow_broad: -131.79, index: null })
  assert.deepEqual(s[1], { date: '2026-11-16', flow_all: 206.57, flow_broad: 176.2, index: 3602.57 })
})
test('mergeSeries: 全A 为主轴丢弃 yuan 为 null 的行；宽基缺某日则该日 flow_broad=null', () => {
  const all = [{ date: '2026-11-17', yuan: null }, { date: '2026-11-16', yuan: 100000000 }]
  const broad = [{ date: '2026-11-13', yuan: 5e8 }] // 与全A不重叠
  const s = mergeSeries(all, broad, new Map())
  assert.equal(s.length, 1)            // 全A null 行被丢
  assert.equal(s[0].date, '2026-11-16')
  assert.equal(s[0].flow_broad, null)  // 宽基无此日
})
test('mergeSeries: 宽基行缺省（空数组）→ flow_broad 全 null', () => {
  const s = mergeSeries([{ date: '2026-11-16', yuan: 1e8 }], [], new Map())
  assert.equal(s[0].flow_broad, null)
})

// —— 累计与 KPI ——
test('cumulative: 近 n 个之和', () => {
  assert.equal(cumulative([1, 2, 3, 4], 3), 9)
  assert.equal(cumulative([1, 2], 5), 3)
})
test('kpiOf: 昨日=末值，cum60=近60之和', () => {
  const s = [{ flow_all: 10 }, { flow_all: -5 }, { flow_all: 206.57 }]
  const k = kpiOf(s, 'flow_all')
  assert.equal(k.yesterday, 206.57)
  assert.equal(k.cum60, 211.57)
})
test('kpiOf: 全 null（宽基未接入）→ 昨日 0、cum60 0', () => {
  const s = [{ flow_broad: null }, { flow_broad: null }]
  const k = kpiOf(s, 'flow_broad')
  assert.equal(k.yesterday, 0)
  assert.equal(k.cum60, 0)
})

// —— fetch 层注入 fetchImpl ——
const ok = data => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) })
test('fetchFlowHistory: 默认取全A，命中 10jqka gateway', async () => {
  let seen = ''
  const fetchImpl = async (url) => { seen = url; return ok(gw(['1777996800'], [12167617980.43])) }
  const r = await fetchFlowHistory({ startDate: '2024-01-01', endDate: '2026-11-17', fetchImpl })
  assert.match(seen, /fund\.10jqka\.com\.cn.+48%3A883957.+a_etf_total_net_buy_flow_amount.+DAY_1/)
  assert.equal(r.length, 1)
  assert.equal(r[0].yuan, 12167617980.43)
})
test('fetchFlowHistory: 传 FLOW_INDEX_BROAD 时 URL 用宽基指标名', async () => {
  let seen = ''
  const fetchImpl = async (url) => { seen = url; return ok(gw(['1777996800'], [1e8])) }
  await fetchFlowHistory({ startDate: '2024-01-01', endDate: '2026-11-17', index: FLOW_INDEX_BROAD, fetchImpl })
  assert.match(seen, /48%3A883957\/broad_etf_total_net_buy_flow_amount\/DAY_1/)
})
test('fetchIndexHistory: 命中 sina 日K，返回 date→close Map；失败兜底空 Map', async () => {
  const good = async () => ok([{ day: '2026-11-16', close: '3602.57' }])
  assert.equal((await fetchIndexHistory({ fetchImpl: good })).get('2026-11-16'), 3602.57)
  const bad = async () => { throw new Error('sina 限频') }
  assert.equal((await fetchIndexHistory({ fetchImpl: bad })).size, 0)
})
