import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parseSseShares, parseSzseShares, computeDailyFlow,
  aggregateFlow, cumulative, makeIsBroad, fetchShares,
} from './etf-flow.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fx = name => JSON.parse(readFileSync(join(here, '__fixtures__/etf-flow', name), 'utf8'))
const sseFixture = fx('sse-shares.json')
const szseFixture = fx('szse-shares.json')
const near = (a, b, tol = 1000) => assert.ok(Math.abs(a - b) < tol, `${a} 不接近 ${b}`)

// —— 解析份额 ——
test('parseSseShares 万份转份', () => {
  near(parseSseShares(sseFixture)['510300'], 45817687700)
})
test('parseSzseShares 剥HTML、去逗号、转份，仅ETF', () => {
  near(parseSzseShares(szseFixture)['159919'], 13565016600)
})
test('parseSseShares 空/0/缺失份额行被丢弃（字段改名不致全零 map）', () => {
  const r = parseSseShares({ result: [
    { SEC_CODE: '510300', TOT_VOL: '' },      // 字段改名/空 → 丢弃
    { SEC_CODE: '510500', TOT_VOL: '0' },     // 0 份 → 丢弃
    { SEC_CODE: '159901', TOT_VOL: '100' },   // 正常
  ] })
  assert.equal(r['510300'], undefined)
  assert.equal(r['510500'], undefined)
  assert.equal(r['159901'], 100 * 10000)
})
test('parseSzseShares 空/0 dqgm 行被丢弃', () => {
  const r = parseSzseShares([{ data: [
    { sys_key: '<u>159919</u>', jjlb: 'ETF', dqgm: '' },
    { sys_key: '<u>159915</u>', jjlb: 'ETF', dqgm: '100' },
  ] }])
  assert.equal(r['159919'], undefined)
  assert.equal(r['159915'], 100 * 10000)
})
test('parseSseShares 空响应得空对象', () => {
  assert.deepEqual(parseSseShares({}), {})
  assert.deepEqual(parseSseShares({ result: [] }), {})
})
test('parseSzseShares 空响应得空对象', () => {
  assert.deepEqual(parseSzseShares([]), {})
  assert.deepEqual(parseSzseShares([{ data: [] }]), {})
})

// —— 净流入计算与跳过 ——
test('正常净流入 = 份额差 × 市价', () => {
  assert.equal(computeDailyFlow(110, 100, 2), 20)
  assert.equal(computeDailyFlow(90, 100, 2), -20)
})
test('无前值跳过', () => { assert.equal(computeDailyFlow(110, null, 2), null) })
test('前值为 0 跳过', () => { assert.equal(computeDailyFlow(110, 0, 2), null) })
test('市价缺失/<=0 跳过', () => {
  assert.equal(computeDailyFlow(110, 100, null), null)
  assert.equal(computeDailyFlow(110, 100, 0), null)
})
test('折算边界：0.49 计入、0.51 剔除（涨跌皆然）', () => {
  assert.notEqual(computeDailyFlow(149, 100, 2), null)
  assert.equal(computeDailyFlow(151, 100, 2), null)
  assert.equal(computeDailyFlow(49, 100, 2), null)
})

// —— 聚合与累计 ——
test('aggregateFlow 分全A/宽基，忽略 null', () => {
  const isBroad = makeIsBroad(['510300'])
  const r = aggregateFlow({ '510300': 100, '512480': 30, '513180': null }, isBroad)
  assert.equal(r.all, 130)
  assert.equal(r.broad, 100)
})
test('cumulative 取近 n 个值之和', () => {
  assert.equal(cumulative([1, 2, 3, 4], 3), 9)
  assert.equal(cumulative([1, 2], 5), 3)
})

// —— fetchShares 注入 fetchImpl ——
const ok = data => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data), headers: { getSetCookie: () => [] } })
test('fetchShares 沪失败不影响深：sse={}，szse 有值', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('query.sse.com.cn')) throw new Error('沪市限频')
    if (url.includes('szse.cn') && !url.includes('ShowReport')) return ok({})
    return ok(szseFixture)
  }
  const { sse, szse } = await fetchShares({ date: '2026-11-12', fetchImpl })
  assert.equal(Object.keys(sse).length, 0)
  assert.ok(szse['159919'] > 0)
})
test('fetchShares 深失败不影响沪：szse={}，sse 有值', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('query.sse.com.cn')) return ok(sseFixture)
    throw new Error('深市超时')
  }
  const { sse, szse } = await fetchShares({ date: '2026-11-12', fetchImpl })
  assert.ok(sse['510300'] > 0)
  assert.equal(Object.keys(szse).length, 0)
})
