import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSnapshot } from './etf-flow-snapshot.mjs'

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} 不接近 ${b}`)

function tmpRoot() {
  const root = mkdtempSync(join(tmpdir(), 'etf-flow-'))
  mkdirSync(join(root, 'public/data'), { recursive: true })
  return root
}
const readOut = root => JSON.parse(readFileSync(join(root, 'public/data/etf-flow.json'), 'utf8'))

// 注入：资金历史（元）+ 指数 Map
const flowFn = async () => ([
  { date: '2026-11-13', yuan: -14943813840 },
  { date: '2026-11-16', yuan: 20657277210 },
])
const indexFn = async () => new Map([['2026-11-16', 3602.57]])

test('正常：产出序列（转亿）、叠加指数、KPI 正确、sample=false', async () => {
  const root = tmpRoot()
  const r = await runSnapshot({ today: '2026-11-17', root, flowFn, indexFn })
  assert.equal(r.written, true)
  const out = readOut(root)
  assert.equal(out.sample, false)
  assert.equal(out.series.length, 2)
  const last = out.series.at(-1)
  assert.deepEqual(last, { date: '2026-11-16', flow_all: 206.57, flow_broad: null, index: 3602.57 })
  near(out.kpi.all.yesterday, 206.57)
  near(out.kpi.all.cum60, 206.57 - 149.44)
})

test('宽基未接入：flow_broad 全 null、kpi.broad 为 0', async () => {
  const root = tmpRoot()
  await runSnapshot({ today: '2026-11-17', root, flowFn, indexFn })
  const out = readOut(root)
  assert.ok(out.series.every(s => s.flow_broad === null))
  assert.equal(out.kpi.broad.yesterday, 0)
  assert.equal(out.kpi.broad.cum60, 0)
})

test('资金接口失败：不写、不抛，返回原因', async () => {
  const root = tmpRoot()
  const r = await runSnapshot({ today: '2026-11-17', root, indexFn, flowFn: async () => { throw new Error('gateway 502') } })
  assert.equal(r.written, false)
  assert.match(r.reason, /资金/)
  assert.equal(existsSync(join(root, 'public/data/etf-flow.json')), false)
})

test('资金序列为空：跳过不写（如网络空响应）', async () => {
  const root = tmpRoot()
  const r = await runSnapshot({ today: '2026-11-17', root, indexFn, flowFn: async () => [] })
  assert.equal(r.written, false)
  assert.equal(existsSync(join(root, 'public/data/etf-flow.json')), false)
})

test('指数失败不阻断资金柱：仍写出、index 全 null', async () => {
  const root = tmpRoot()
  const r = await runSnapshot({ today: '2026-11-17', root, flowFn, indexFn: async () => { throw new Error('sina 限频') } })
  assert.equal(r.written, true)
  const out = readOut(root)
  assert.ok(out.series.every(s => s.index === null))
  near(out.series.at(-1).flow_all, 206.57) // 资金柱不受影响
})

test('幂等：gateway 全量重建，重跑序列不重复', async () => {
  const root = tmpRoot()
  await runSnapshot({ today: '2026-11-17', root, flowFn, indexFn })
  await runSnapshot({ today: '2026-11-17', root, flowFn, indexFn })
  assert.equal(readOut(root).series.filter(s => s.date === '2026-11-16').length, 1)
  assert.equal(readOut(root).series.length, 2)
})
