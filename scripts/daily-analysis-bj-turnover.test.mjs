import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBeijingTurnover, mergeBeijing } from './daily-analysis-bj-turnover.mjs'

const row = (symbol, turnover) => ({ symbol, name: symbol, price: 10, amount: 1, turnover, change: 0 })

test('北交所个股并入后按换手率重新取前五，没有北交所数据的日期保持不变', () => {
  const computed = { '2026-10-12': { turnover: [row('sz1', 50), row('sz2', 40), row('sz3', 30), row('sz4', 20), row('sz5', 10)], amount: [] }, '2026-10-09': { turnover: [row('sz1', 9)], amount: [] } }
  const merged = mergeBeijing(computed, { '2026-10-12': [row('bj1', 70)] })
  assert.deepEqual(merged['2026-10-12'].turnover.map(r => r.symbol), ['bj1', 'sz1', 'sz2', 'sz3', 'sz4'])
  assert.deepEqual(merged['2026-10-09'].turnover.map(r => r.symbol), ['sz1'])
})

test('用最新交易日的成交量与换手率反推流通股本，再算历史换手率；日期不是最新交易日的报价不采用', async () => {
  const fields = Array.from({ length: 40 }, () => '')
  Object.assign(fields, { 1: '宇特光电', 6: '90856', 30: '20261012153530', 38: '70.90' })
  const stale = fields.slice(); stale[30] = '20261009150000'
  const pages = { 1: [{ symbol: 'bj920157', name: '宇特光电' }, { symbol: 'bj920000', name: '陈旧' }], 2: [{ symbol: 'sh600000', name: 'x' }] }
  const fetchImpl = async url => {
    const u = String(url)
    if (u.includes('getHQNodeData')) return new Response(JSON.stringify(pages[new URL(u).searchParams.get('page')] ?? []))
    if (u.includes('qt.gtimg.cn')) return new Response(`v_bj920157="${fields.join('~')}";v_bj920000="${stale.join('~')}";`)
    return new Response(JSON.stringify([{ day: '2026-10-09', close: '75.55', volume: '12202063' }, { day: '2026-10-12', close: '71.10', volume: '9085600' }]))
  }
  const computed = { '2026-10-12': { turnover: [], amount: [] }, '2026-10-09': { turnover: [], amount: [] } }
  const { merged } = await buildBeijingTurnover({ fetchImpl, computed, latestDate: '2026-10-12' })
  assert.deepEqual(merged['2026-10-12'].turnover.map(r => [r.symbol, r.turnover]), [['bj920157', 70.9]])
  assert.equal(merged['2026-10-12'].turnover[0].change, -5.89)
  assert.equal(merged['2026-10-09'].turnover.length, 0) // 第 0 根没有前收，无法算涨跌幅
})
