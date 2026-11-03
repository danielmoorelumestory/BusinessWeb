import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mergeSnapshots, snapshotSchema } from './data'
import { dailySnapshot } from './fixtures'

describe('public/data/daily-analysis.json', () => {
  const body = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/daily-analysis.json'), 'utf8'))

  it('每个归档快照都符合页面读取的格式，日期唯一且不超过 60 个', () => {
    expect(body.schemaVersion).toBe(1)
    expect(body.snapshots.length).toBeLessThanOrEqual(60)
    for (const snapshot of body.snapshots) expect(() => snapshotSchema.parse(snapshot), snapshot.dataDate).not.toThrow()
    const dates = body.snapshots.map((snapshot: { dataDate: string }) => snapshot.dataDate)
    expect(new Set(dates).size).toBe(dates.length)
  })

  it('标为 ready 的榜单来源一定有 5 只股票，没有数据的来源不标 ready', () => {
    for (const snapshot of body.snapshots) {
      for (const [id, key] of [['amountRank', 'amount'], ['turnoverRank', 'turnover']] as const) {
        const source = snapshot.sources.find((row: { id: string }) => row.id === id)
        if (source?.status === 'ready') expect(snapshot.rankings[key], `${snapshot.dataDate} ${id}`).toHaveLength(5)
        if (!snapshot.rankings[key].length) expect(source?.status, `${snapshot.dataDate} ${id}`).not.toBe('ready')
      }
    }
  })
})

describe('mergeSnapshots 打板溢价', () => {
  const withPremium = (fetchedAt: string, premiumOpen: number | null) => {
    const snapshot = dailySnapshot()
    return { ...snapshot, fetchedAt, metrics: { ...snapshot.metrics, premiumOpen, premiumClose: premiumOpen } }
  }

  it('归档后来回补的溢价能补进采集时间相同的浏览器旧快照', () => {
    const [row] = mergeSnapshots([dailySnapshot()], [withPremium(dailySnapshot().fetchedAt, 1.5)])
    expect(row.metrics).toMatchObject({ premiumOpen: 1.5, premiumClose: 1.5 })
  })

  it('较新的快照没有溢价时保留已有值，有值时用新值', () => {
    const old = withPremium('2026-10-12T08:00:00.000Z', 1.5)
    expect(mergeSnapshots([old], [withPremium('2026-10-12T09:00:00.000Z', null)])[0].metrics.premiumOpen).toBe(1.5)
    expect(mergeSnapshots([old], [withPremium('2026-10-12T09:00:00.000Z', 2)])[0].metrics.premiumOpen).toBe(2)
  })
})
