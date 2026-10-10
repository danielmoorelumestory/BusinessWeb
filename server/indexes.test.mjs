import test from 'node:test'
import assert from 'node:assert/strict'
import { weightedPe, medianOf } from './indexes.mjs'

test('加权 PE 是调和平均：总市值 ÷ 总盈利', () => {
  const rows = [{ mcap: 100, fwd: 10 }, { mcap: 100, fwd: 20 }]
  assert.ok(Math.abs(weightedPe(rows, 'fwd').pe - 200 / 15) < 1e-9)
})
test('亏损股和缺失值不计入，覆盖率按市值算', () => {
  const rows = [{ mcap: 300, fwd: 15 }, { mcap: 100, fwd: null }, { mcap: 100, fwd: -5 }]
  const r = weightedPe(rows, 'fwd')
  assert.equal(r.pe, 15); assert.equal(r.count, 1); assert.equal(r.covered, 0.6)
})
test('没有可用 PE 返回 null；中位数忽略亏损股', () => {
  assert.equal(weightedPe([{ mcap: 1, fwd: null }], 'fwd'), null)
  assert.equal(medianOf([{ fwd: 10 }, { fwd: 30 }, { fwd: -1 }, { fwd: 20 }], 'fwd'), 20)
})

import { setRef } from './indexes.mjs'
test('导入长历史：按日期排序、丢弃无效行，并标记为手动导入', () => {
  const snap = { indexes: { hsi: { ref: { source: 'old', points: [] } } } }
  const rows = Array.from({ length: 30 }, (_, i) => [`2010-${String((i % 12) + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`.slice(0, 10), String(10 + i)])
  rows.push(['垃圾', 'x'], ['2020-01-01', '-3'])
  setRef(snap, 'hsi', rows, '某来源', 'trailing')
  const r = snap.indexes.hsi.ref
  assert.equal(r.points.length, 30); assert.equal(r.manual, true); assert.equal(r.kind, 'trailing')
  assert.ok(r.points.every((p, i, a) => !i || a[i - 1][0] <= p[0]))
})
test('导入数据不足 24 行时报错', () => {
  assert.throws(() => setRef({ indexes: { hsi: {} } }, 'hsi', [['2020-01-01', '10']], 's'), /不足 24/)
})

import { weeklyPoints } from './indexes.mjs'
test('日度 PE 按周压缩：每周留最后一个交易日', () => {
  const rows = [['2026-09-28', 10], ['2026-09-29', 11], ['2026-10-02', 12], ['2026-10-05', 13]]
  assert.deepEqual(weeklyPoints(rows), [['2026-10-02', 12], ['2026-10-05', 13]])
})
