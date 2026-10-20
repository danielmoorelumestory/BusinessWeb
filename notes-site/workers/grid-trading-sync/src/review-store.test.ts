// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import worker, { trackedCodes } from './index'
import { ensureReviewTable, readTechnicalSnapshots, refreshTechnicalSnapshot, saveTechnicalSnapshot } from './review-store'

let sqlite: DatabaseSync
let db: any
const candles = Array.from({ length: 80 }, (_, i) => ({ date: new Date(Date.UTC(2026, 7, i + 1)).toISOString().slice(0, 10), open: 10, close: 10 + Math.sin(i / 4), high: 12, low: 8 }))
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T08:00:00Z'))
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('notes-site/workers/grid-trading-sync/schema.sql', 'utf8'))
  db = { async batch(statements: any[]) { return Promise.all(statements.map(statement => statement.run())) }, prepare(sql: string) {
    let params: any[] = []
    return { bind(...values: any[]) { params = values; return this }, async run() { const result = sqlite.prepare(sql).run(...params); return { meta: { changes: Number(result.changes) } } }, async all() { return { results: sqlite.prepare(sql).all(...params) } }, async first() { return sqlite.prepare(sql).get(...params) ?? null } }
  } }
})
it('云端拒绝用较新的旧分组快照抹掉新观察池，并归档覆盖前的完整版本', async () => {
  const headers = { authorization: 'Bearer recovery-test-owner-1234', 'content-type': 'application/json' }
  const id = 'meta:etf-review-v1'
  const rich = { id, kind: 'etf-review-meta', savedAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-20T09:00:00Z', workspaceUpdatedAt: '2026-10-20T09:00:00Z', groups: [{ id: 'custom', name: '指标性ETF', order: 0 }], watchlist: [{ code: '588800', name: '科创100', addedAt: '2026-10-20T09:00:00Z' }], memberships: { '588800': ['custom'] }, notes: {} }
  const stale = { ...rich, updatedAt: '2026-10-20T10:00:00Z', workspaceUpdatedAt: '2026-10-18T00:00:00Z', groups: [], watchlist: [], memberships: {} }
  const put = async (meta: any) => worker.fetch(new Request('https://test/', { method: 'PUT', headers, body: JSON.stringify({ records: [meta] }) }), { DB: db }, {} as any)
  expect((await put(rich)).status).toBe(200)
  expect((await put(stale)).status).toBe(200)
  const read = await worker.fetch(new Request('https://test/', { headers }), { DB: db }, {} as any)
  const body = await read.json() as any
  expect(body.records[0].watchlist).toEqual(rich.watchlist)
  expect(body.records[0].groups).toEqual(rich.groups)
  expect(body.records[0].memberships).toEqual(rich.memberships)
  const backups = await worker.fetch(new Request('https://test/review/backups', { headers }), { DB: db }, {} as any)
  expect((await backups.json() as any).backups[0].meta).toEqual(rich)
  const other = await worker.fetch(new Request('https://test/review/backups', { headers: { authorization: 'Bearer another-user-test-1234' } }), { DB: db }, {} as any)
  expect((await other.json() as any).backups).toEqual([])
})
afterEach(() => { sqlite.close(); vi.useRealTimers(); vi.unstubAllGlobals() })
it('指标入库后重读复用，不再拉行情', async () => {
  const load = vi.fn(async () => candles)
  const first = await refreshTechnicalSnapshot(db, '588800', load)
  expect(first.refreshed).toBe(true)
  const second = await refreshTechnicalSnapshot(db, '588800', load)
  expect(second.refreshed).toBe(false)
  expect(second.snapshot).toEqual(first.snapshot)
  expect(load).toHaveBeenCalledTimes(1)
  expect((await readTechnicalSnapshots(db, ['588800']))['588800']).toEqual(first.snapshot)
})
it('并发请求仅抓取一次；失败释放租约且保留旧指标', async () => {
  await ensureReviewTable(db)
  let finish: (value: typeof candles) => void = () => {}
  const load = vi.fn(() => new Promise<typeof candles>(resolve => { finish = resolve }))
  const first = refreshTechnicalSnapshot(db, '588800', load)
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
  const second = await refreshTechnicalSnapshot(db, '588800', load)
  expect(second.pending).toBe(true)
  finish(candles); await first
  const old = (await readTechnicalSnapshots(db, ['588800']))['588800']
  vi.setSystemTime(new Date('2026-10-21T08:00:00Z'))
  await expect(refreshTechnicalSnapshot(db, '588800', async () => { throw new Error('源站失败') })).rejects.toThrow('源站失败')
  expect((await readTechnicalSnapshots(db, ['588800']))['588800']).toEqual(old)
  expect(sqlite.prepare('SELECT refreshing_until FROM review_technical WHERE code=?').get('588800')?.refreshing_until).toBe(0)
})
it('定时任务同时跟踪网格记录及手动观察池，并排除墓碑和其他密钥记录', async () => {
  const insert = sqlite.prepare('INSERT INTO records VALUES (?,?,?,?)')
  insert.run('a', 'grid1', JSON.stringify({ row: { code: '588800' } }), 1)
  insert.run('a', 'meta', JSON.stringify({ kind: 'etf-review-meta', watchlist: [{ code: '159687' }, { code: '588800' }] }), 1)
  insert.run('a', 'deleted', JSON.stringify({ deleted: true, row: { code: '600001' } }), 1)
  insert.run('b', 'grid2', JSON.stringify({ row: { code: '600002' } }), 1)
  expect((await trackedCodes({ DB: db }, 'a')).sort()).toEqual(['159687', '588800'])
  expect((await trackedCodes({ DB: db })).sort()).toEqual(['159687', '588800', '600002'])
})
it('GET只读数据库；新鲜POST不抓行情；鉴权和非法代码请求被拒绝', async () => {
  await saveTechnicalSnapshot(db, '588800', candles)
  const fetcher = vi.fn(() => { throw new Error('不应请求行情') }); vi.stubGlobal('fetch', fetcher)
  const headers = { authorization: 'Bearer test-review-store-token' }
  const response = await worker.fetch(new Request('https://test/review/technical?codes=588800', { headers }), { DB: db }, {} as any)
  expect(response.status).toBe(200)
  const body = await response.json() as any
  expect(body.stale).toEqual([])
  expect(body.records['588800'].record.events.week).toBeDefined()
  const post = await worker.fetch(new Request('https://test/review/technical?code=588800', { method: 'POST', headers }), { DB: db }, {} as any)
  expect(post.status).toBe(200)
  expect(fetcher).not.toHaveBeenCalled()
  expect((await worker.fetch(new Request('https://test/review/technical?codes=588800'), { DB: db }, {} as any)).status).toBe(401)
  expect((await worker.fetch(new Request('https://test/review/technical?codes=invalid', { headers }), { DB: db }, {} as any)).status).toBe(400)
})
it('缺失标的经后台回填原始K线及复权偏移后计算入库，后续请求完全复用数据库', async () => {
  const fetcher = vi.fn(async (url: string) => {
    const adjusted = url.endsWith(',qfq')
    const rows = candles.map(candle => [candle.date, String(candle.open - (adjusted ? .5 : 0)), String(candle.close - (adjusted ? .5 : 0)), String(candle.high - (adjusted ? .5 : 0)), String(candle.low - (adjusted ? .5 : 0)), '100'])
    return { ok: true, json: async () => ({ data: { sh588800: { [adjusted ? 'qfqday' : 'day']: rows } } }) }
  })
  vi.stubGlobal('fetch', fetcher)
  const headers = { authorization: 'Bearer test-review-store-token' }
  const request = () => new Request('https://test/review/technical?code=588800', { method: 'POST', headers })
  const first = await worker.fetch(request(), { DB: db }, {} as any)
  expect(first.status).toBe(200)
  const data = await first.json() as any
  expect(data.refreshed).toBe(true)
  expect(data.snapshot.record.day.close).toBeCloseTo(candles[candles.length - 1].close - .5)
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM daily_bars WHERE code=?').get('588800')?.n).toBe(80)
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM daily_offsets WHERE code=?').get('588800')?.n).toBe(80)
  expect(fetcher).toHaveBeenCalledTimes(2)
  const second = await worker.fetch(request(), { DB: db }, {} as any)
  expect((await second.json() as any).refreshed).toBe(false)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('前复权序列落后一根时仍保存最新原始K线和最新三周期指标', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const adjusted = url.endsWith(',qfq')
    const series = adjusted ? candles.slice(0, -1) : candles
    const rows = series.map(candle => [candle.date, String(candle.open), String(candle.close), String(candle.high), String(candle.low), '100'])
    return { ok: true, json: async () => ({ data: { sh588800: { [adjusted ? 'qfqday' : 'day']: rows } } }) }
  }))
  const headers = { authorization: 'Bearer test-review-store-token' }
  const response = await worker.fetch(new Request('https://test/review/technical?code=588800', { method: 'POST', headers }), { DB: db }, {} as any)
  expect(response.status).toBe(200)
  const body = await response.json() as any
  expect(body.snapshot.record.day.asOf).toBe(candles[candles.length - 1].date)
  expect(body.snapshot.record.day.close).toBe(candles[candles.length - 1].close)
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM daily_offsets WHERE code=?').get('588800')?.n).toBe(80)
})
