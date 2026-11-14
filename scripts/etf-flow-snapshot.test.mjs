import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSnapshot } from './etf-flow-snapshot.mjs'

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} 不接近 ${b}`)

function tmpRoot(prevShares) {
  const root = mkdtempSync(join(tmpdir(), 'etf-flow-'))
  mkdirSync(join(root, 'public/data'), { recursive: true })
  mkdirSync(join(root, 'data-raw/etf-flow'), { recursive: true })
  if (prevShares) {
    writeFileSync(
      join(root, 'data-raw/etf-flow/shares-latest.json'),
      JSON.stringify({ date: '2026-11-13', shares: prevShares }),
    )
  }
  return root
}
const readOut = root => JSON.parse(readFileSync(join(root, 'public/data/etf-flow.json'), 'utf8'))
const readBaseline = root => JSON.parse(readFileSync(join(root, 'data-raw/etf-flow/shares-latest.json'), 'utf8'))

// 注入：510300 宽基、512480 非宽基
const universeFn = async () => ({ list: [
  { code: '510300', name: '300ETF', market: 'sh', price: 2, scale: 1 },
  { code: '512480', name: '半导体', market: 'sh', price: 3, scale: 1 },
] })
const lastCloseFn = async () => 3650

test('正常日：产出序列追加一天、KPI 正确、写前值', async () => {
  const root = tmpRoot({ '510300': 1e9, '512480': 1e9 })
  const r = await runSnapshot({
    today: '2026-11-14', root, universeFn, lastCloseFn,
    fetchSharesFn: async () => ({ sse: { '510300': 1.1e9, '512480': 1.05e9 }, szse: {} }),
  })
  assert.equal(r.written, true)
  const out = readOut(root)
  const last = out.series.at(-1)
  assert.equal(last.date, '2026-11-14')
  near(last.flow_all, 3.5)      // (0.1e9*2 + 0.05e9*3)/1e8 = 3.5 亿元
  near(last.flow_broad, 2)      // 0.1e9*2/1e8 = 2 亿元
  assert.equal(last.index, 3650)
  near(out.kpi.all.yesterday, 3.5)
  near(out.kpi.broad.yesterday, 2)
  assert.equal(readBaseline(root).date, '2026-11-14')
  assert.equal(readBaseline(root).shares['510300'], 1.1e9)
})

test('沪市份额为空：跳过不写、不毒化前值', async () => {
  const root = tmpRoot({ '510300': 1e9 })
  const r = await runSnapshot({
    today: '2026-11-14', root, universeFn, lastCloseFn,
    fetchSharesFn: async () => ({ sse: {}, szse: { '159919': 5e8 } }),
  })
  assert.equal(r.written, false)
  assert.match(r.reason, /沪市/)
  assert.equal(existsSync(join(root, 'public/data/etf-flow.json')), false)
  assert.equal(readBaseline(root).date, '2026-11-13') // 前值未被覆盖
})

test('首次运行无前值：产出当天(合计0)并建立基准', async () => {
  const root = tmpRoot(null)
  const r = await runSnapshot({
    today: '2026-11-14', root, universeFn, lastCloseFn,
    fetchSharesFn: async () => ({ sse: { '510300': 1e9, '512480': 1e9 }, szse: {} }),
  })
  assert.equal(r.written, true)
  const last = readOut(root).series.at(-1)
  assert.equal(last.flow_all, 0)
  assert.equal(last.flow_broad, 0)
  assert.equal(readBaseline(root).date, '2026-11-14') // 基准已建立
})

test('同日重跑幂等：series 不重复追加', async () => {
  const root = tmpRoot({ '510300': 1e9, '512480': 1e9 })
  const run = () => runSnapshot({
    today: '2026-11-14', root, universeFn, lastCloseFn,
    fetchSharesFn: async () => ({ sse: { '510300': 1.1e9, '512480': 1.05e9 }, szse: {} }),
  })
  await run()
  await run()
  assert.equal(readOut(root).series.filter(s => s.date === '2026-11-14').length, 1)
})
