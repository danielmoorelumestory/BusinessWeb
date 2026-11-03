import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { computePremium, symbolOf } from '../server/daily-premium.mjs'
import { backfillPremium } from './daily-analysis-premium-backfill.mjs'

const up = codes => codes.map(code => ({ code, name: code, boards: 1 }))
const snapshot = (dataDate, codes, metrics = {}) => ({ dataDate, upStocks: up(codes), metrics: { premiumOpen: null, premiumClose: null, ...metrics } })
const withArchive = async (snapshots, run) => {
  const dir = await mkdtemp(join(tmpdir(), 'premium-'))
  const file = join(dir, 'archive.json')
  await writeFile(file, JSON.stringify({ schemaVersion: 1, snapshots }))
  try { return await run(file, async () => JSON.parse(await readFile(file, 'utf8')).snapshots) } finally { await rm(dir, { recursive: true, force: true }) }
}

test('symbolOf 按代码前缀判断交易所', () => {
  assert.deepEqual(['600000', '688001', '000001', '300001', '430001', '830001', '920001'].map(symbolOf), ['sh600000', 'sh688001', 'sz000001', 'sz300001', 'bj430001', 'bj830001', 'bj920001'])
})

test('computePremium 取开盘与收盘相对昨收的平均涨跌幅，跳过没有成交价的股票', () => {
  const rows = [{ open: 11, close: 10.5, previousClose: 10 }, { open: 9, close: 9.5, previousClose: 10 }, { open: 10.2, close: 10, previousClose: 10 }, { open: 10, close: 10, previousClose: 10 }, { open: 0, close: 10, previousClose: 10 }]
  assert.deepEqual(computePremium(rows, 5), { open: 0.5, close: 0, sample: 4, total: 5 })
})

test('computePremium 样本不足 80% 或没有涨停股时不给数字', () => {
  const rows = [{ open: 11, close: 11, previousClose: 10 }]
  assert.equal(computePremium(rows, 2).open, null)
  assert.equal(computePremium([], 0).close, null)
})

const tradingDates = ['2026-10-08', '2026-10-09', '2026-10-12']

test('backfillPremium 用前一交易日的涨停名单计算，已有值不覆盖，缺前一日的跳过', async () => {
  const prices = { 600000: { '2026-10-12': [11.55, 12.1, 11] }, '000001': { '2026-10-12': [5.5, 5.225, 5.5] } }
  await withArchive([
    snapshot('2026-10-12', ['600000']),
    snapshot('2026-10-09', ['600000', '000001'], { premiumOpen: 9, premiumClose: 9 }),
    snapshot('2026-10-08', ['600000']),
  ], async (file, read) => {
    const result = await backfillPremium({ file, history: { tradingDates, prices } })
    assert.deepEqual(result.updated, [{ date: '2026-10-12', open: 2.5, close: 2.5, sample: 2, total: 2 }])
    assert.deepEqual(result.skipped, [{ date: '2026-10-08', reason: '归档缺前一交易日的涨停名单' }])
    const [newest, middle] = await read()
    assert.equal(newest.metrics.premiumClose, 2.5)
    assert.equal(middle.metrics.premiumOpen, 9)
  })
})

test('backfillPremium 前一交易日不在归档时不跨日计算', async () => {
  await withArchive([snapshot('2026-11-03', ['600000']), snapshot('2026-10-30', ['600000'], { premiumOpen: 1, premiumClose: 1 })], async file => {
    const result = await backfillPremium({ file, history: { tradingDates: ['2026-10-30', '2026-11-02', '2026-11-03'], prices: {} } })
    assert.deepEqual(result.updated, [])
    assert.equal(result.skipped[0].date, '2026-11-03')
  })
})

test('backfillPremium 价格缺失导致样本不足时不写入', async () => {
  await withArchive([snapshot('2026-10-12', []), snapshot('2026-10-09', ['600000', '000001'], { premiumOpen: 1, premiumClose: 1 })], async (file, read) => {
    const result = await backfillPremium({ file, history: { tradingDates, prices: {} } })
    assert.deepEqual(result.updated, [])
    assert.match(result.skipped[0].reason, /样本不足/)
    assert.equal((await read())[0].metrics.premiumOpen, null)
  })
})
