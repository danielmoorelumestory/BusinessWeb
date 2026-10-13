import { describe, expect, it } from 'vitest'
import { buildBackfill } from '../../server/daily-backfill.mjs'
import { snapshotSchema } from '../features/daily-analysis/data'

const stock = (c: string, lbc: number) => ({ c, n: `股${c}`, lbc })
const POOLS: Record<string, Record<string, unknown[]>> = {
  '20261008': { ZT: [stock('600001', 2), stock('600002', 1)], ZB: [], DT: [] },
  '20261009': { ZT: [stock('600001', 3), stock('600003', 1), stock('600004', 1)], ZB: [stock('600005', 0)], DT: [stock('600006', 0)] },
  '20261012': { ZT: [stock('600001', 4), stock('600003', 2)], ZB: [], DT: [] },
}
const cls = (date: string, height: number, lb: number) => ({ code: 200, data: { plate_stock: [{ stock_list: [{ time: `${date} 09:30:00` }] }], continuous_limit_up: [{ height, stock_list: Array.from({ length: lb }, () => ({})) }] } })
const closes = [['2026-10-08', 100], ['2026-10-09', 101], ['2026-10-12', 102.01]] as const

function fetchImpl(overrides: { cls?: Record<string, unknown>; failCls?: string } = {}): typeof fetch {
  return (async (input: string) => {
    const url = new URL(String(input))
    const json = (body: unknown) => new Response(JSON.stringify(body))
    if (url.hostname === 'web.ifzq.gtimg.cn') {
      const symbol = url.searchParams.get('param')!.split(',')[0]
      return json({ data: { [symbol]: { day: closes.map(([d, c]) => [d, c, c, c, c, 1]) } } })
    }
    if (url.hostname === 'push2ex.eastmoney.com') {
      const kind = url.pathname.slice('/getTopic'.length).replace('Pool', '')
      const rows = POOLS[url.searchParams.get('date')!]?.[kind] ?? []
      return json({ rc: 0, data: { qdate: 20261012, tc: rows.length, pool: rows } })
    }
    const date = url.searchParams.get('date')!
    if (overrides.failCls === date) return new Response('{}', { status: 502 })
    return json(overrides.cls?.[date] ?? (date === '20261009' ? cls('2026-10-09', 3, 1) : cls('2026-10-12', 4, 2)))
  }) as typeof fetch
}

describe('历史回补', () => {
  it('按日期生成通过 schema 的快照：涨停、炸板、跌停、封板率、连板、晋级率与指数涨跌', async () => {
    const { snapshots, skipped } = await buildBackfill({ fetchImpl: fetchImpl(), days: 2, now: new Date('2026-10-12T10:00:00Z') })
    expect(skipped).toEqual([])
    const day = snapshots.find(s => s.dataDate === '2026-10-09')!
    expect(snapshotSchema.parse(day)).toBeTruthy()
    expect(day.metrics).toMatchObject({ ztCount: 3, ztOpen: 1, ztSealRate: 75, dtCount: 1, lbCount: 1, maxBoard: 3, volume: null, lbRate: 50 })
    expect(day.indices.find(i => i.symbol === 'sh000001')).toMatchObject({ price: 101, change: 1 })
    expect(day.sources.find(s => s.id === 'flows')!.status).toBe('unavailable')
    expect(snapshots.find(s => s.dataDate === '2026-10-12')!.metrics.lbRate).toBeCloseTo(66.7, 1)
  })

  it('与财联社核验不一致或核验失败的日期不写入', async () => {
    const mismatch = await buildBackfill({ fetchImpl: fetchImpl({ cls: { '20261009': cls('2026-10-09', 9, 1) } }), days: 2, now: new Date() })
    expect(mismatch.snapshots.map(s => s.dataDate)).toEqual(['2026-10-12'])
    expect(mismatch.skipped[0]).toMatchObject({ date: '2026-10-09' })
    expect(mismatch.skipped[0].reason).toContain('不一致')
    const failed = await buildBackfill({ fetchImpl: fetchImpl({ failCls: '20261012' }), days: 2, now: new Date() })
    expect(failed.snapshots.map(s => s.dataDate)).toEqual(['2026-10-09'])
  })

  it('已有真实快照的日期不会重复回补', async () => {
    const first = await buildBackfill({ fetchImpl: fetchImpl(), days: 2, now: new Date() })
    const again = await buildBackfill({ fetchImpl: fetchImpl(), days: 2, now: new Date(), history: first.snapshots })
    expect(again.snapshots).toEqual([])
  })
})
