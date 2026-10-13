import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { snapshotSchema } from './data'

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
