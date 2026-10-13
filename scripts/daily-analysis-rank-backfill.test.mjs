import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyRankBackfill } from './daily-analysis-rank-backfill.mjs'

const pick = (symbol, amount) => ({ symbol, name: `股${symbol}`, price: 10, amount, turnover: 1.5, change: -1.234 })
const five = prefix => ['a', 'b', 'c', 'd', 'e'].map((x, i) => pick(`sh60000${i}${prefix}`.slice(0, 8), 100 - i))
const snap = (date, rankings, status = 'unavailable') => ({
  dataDate: date, rankings,
  sources: [{ id: 'amountRank', label: 'x', url: 'https://finance.sina.com.cn/', date: null, status, note: '' }, { id: 'turnoverRank', label: 'y', url: 'https://finance.sina.com.cn/', date: null, status, note: '' }],
})
const real = rows => rows.map(row => ({ symbol: row.symbol, code: row.symbol.slice(2), name: row.name, date: '2026-10-12', price: 10, change: 0, amount: row.amount, turnover: 1 }))

test('真实榜单核对一致后，只给没有榜单的日期写入，并标注来源与核对结果', () => {
  const top = five('')
  const { snapshots, report } = applyRankBackfill(
    [snap('2026-10-12', { amount: real(top), turnover: [] }, 'ready'), snap('2026-10-09', { amount: [], turnover: [] })],
    { '2026-10-12': { amount: top, turnover: [] }, '2026-10-09': { amount: top, turnover: [] } })
  assert.deepEqual(report.amount.written, ['2026-10-09'])
  assert.equal(snapshots[1].rankings.amount.length, 5)
  assert.equal(snapshots[1].rankings.amount[0].change, -1.23)
  assert.equal(snapshots[1].sources[0].status, 'ready')
  assert.match(snapshots[1].sources[0].note, /核对/)
  assert.equal(snapshots[0].rankings.amount[0].price, 10)
})

test('写入榜单的快照采集时间更新，使其能替换浏览器里已缓存的旧快照', async () => {
  const { canReplaceSnapshot } = await import('../src/features/daily-analysis/quality.mjs')
  const top = five('')
  const old = { ...snap('2026-10-09', { amount: [], turnover: [] }), fetchedAt: '2026-10-12T10:00:00.000Z' }
  const ref = { ...snap('2026-10-12', { amount: real(top), turnover: [] }, 'ready'), fetchedAt: '2026-10-12T10:00:00.000Z' }
  const { snapshots } = applyRankBackfill([ref, old], { '2026-10-12': { amount: top, turnover: [] }, '2026-10-09': { amount: top, turnover: [] } }, { now: new Date('2026-10-13T00:00:00Z') })
  const updated = snapshots.find(row => row.dataDate === '2026-10-09')
  assert.equal(updated.fetchedAt, '2026-10-13T00:00:00.000Z')
  assert.equal(snapshots.find(row => row.dataDate === '2026-10-12').fetchedAt, '2026-10-12T10:00:00.000Z')
  assert.equal(canReplaceSnapshot(old, updated), true)
})

test('与真实榜单不一致的类型整体不写入', () => {
  const top = five('')
  const wrong = [...top].reverse()
  const { snapshots, report } = applyRankBackfill(
    [snap('2026-10-12', { amount: real(top), turnover: [] }, 'ready'), snap('2026-10-09', { amount: [], turnover: [] })],
    { '2026-10-12': { amount: wrong, turnover: [] }, '2026-10-09': { amount: top, turnover: [] } })
  assert.deepEqual(report.amount.written, [])
  assert.match(report.amount.reason, /不一致/)
  assert.deepEqual(snapshots[1].rankings.amount, [])
})

test('没有任何可核对的真实榜单时不写入', () => {
  const top = five('')
  const { report } = applyRankBackfill([snap('2026-10-09', { amount: [], turnover: [] })], { '2026-10-09': { amount: top, turnover: top } })
  assert.match(report.amount.reason, /没有可核对/)
})
