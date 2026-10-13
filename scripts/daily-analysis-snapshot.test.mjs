import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { updateDailyArchive } from './daily-analysis-snapshot.mjs'

const now = new Date('2026-10-12T08:00:00Z')
const snapshot = (date, extra = {}) => ({ schemaVersion: 1, dataDate: date, fetchedAt: `${date}T08:00:00.000Z`, session: 'closed', sources: [{ id: 'limitUp', status: 'ready' }], upStocks: [{ code: '000001' }], ...extra })

test('收盘快照按真实交易日保存，重复运行不增加重复日期', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'daily-archive-'))
  const file = join(dir, 'daily-analysis.json')
  try {
    await writeFile(file, JSON.stringify({ schemaVersion: 1, snapshots: [snapshot('2026-10-09')] }))
    let previous
    const build = async options => { previous = options.history; return snapshot('2026-10-12') }
    assert.equal((await updateDailyArchive({ file, now, build })).saved, true)
    await updateDailyArchive({ file, now, build })
    const body = JSON.parse(await readFile(file, 'utf8'))
    assert.deepEqual(body.snapshots.map(row => row.dataDate), ['2026-10-12', '2026-10-09'])
    assert.equal(previous.length, 2)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('休市旧日期和盘中数据不伪装为当日收盘快照', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'daily-archive-'))
  const file = join(dir, 'daily-analysis.json')
  try {
    for (const data of [snapshot('2026-10-09'), snapshot('2026-10-12', { session: 'intraday' })]) {
      assert.equal((await updateDailyArchive({ file, now, build: async () => data })).saved, false)
    }
    await assert.rejects(readFile(file), { code: 'ENOENT' })
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('当天较完整的归档不会被后续失败的数据源覆盖', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'daily-archive-'))
  const file = join(dir, 'daily-analysis.json')
  try {
    await writeFile(file, JSON.stringify({ schemaVersion: 1, snapshots: [snapshot('2026-10-12')] }))
    const result = await updateDailyArchive({ file, now, build: async () => snapshot('2026-10-12', { sources: [{ id: 'limitUp', status: 'unavailable' }], upStocks: [] }) })
    assert.equal(result.saved, false)
    const body = JSON.parse(await readFile(file, 'utf8'))
    assert.equal(body.snapshots[0].upStocks.length, 1)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('其他来源恢复也不能覆盖已经取得的涨停股池', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'daily-archive-'))
  const file = join(dir, 'daily-analysis.json')
  try {
    const previous = snapshot('2026-10-12', { sources: [{ id: 'limitUp', status: 'ready' }, { id: 'amountRank', status: 'unavailable' }, { id: 'turnoverRank', status: 'unavailable' }] })
    await writeFile(file, JSON.stringify({ schemaVersion: 1, snapshots: [previous] }))
    const next = snapshot('2026-10-12', { fetchedAt: '2026-10-12T09:10:00.000Z', sources: [{ id: 'limitUp', status: 'unavailable' }, { id: 'amountRank', status: 'ready' }, { id: 'turnoverRank', status: 'ready' }], upStocks: [] })
    assert.equal((await updateDailyArchive({ file, now, build: async () => next })).saved, false)
    assert.equal(JSON.parse(await readFile(file, 'utf8')).snapshots[0].upStocks.length, 1)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
