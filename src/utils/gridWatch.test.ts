import { beforeEach, describe, expect, it } from 'vitest'
import { RECORDS_KEY, newWatchRecord, readGridRecords, readRecords, recordByCode, watchIdOf, type SavedRecord } from '../../notes-site/src/lib/grid-trading'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } },
  })
})
const gridRecord = (id: string, code: string, updatedAt: string): SavedRecord => ({ ...newWatchRecord(code, code, '2026-10-13'), id, watch: undefined, updatedAt })

describe('关注记录（没有网格的 ETF）', () => {
  it('新建的关注记录：固定 id、一年前起、没有网格数据', () => {
    const record = newWatchRecord('159566', '储能电池ETF', '2026-10-13')
    expect(record.id).toBe(watchIdOf('159566'))
    expect(record.watch).toBe(true)
    expect(record.row.date).toBe('2025-10-13')
    expect(record.result.series).toEqual([])
    expect(record.result.trades).toEqual([])
  })

  it('按代码找记录：有网格的优先，同代码取最近修改的', () => {
    store.set(RECORDS_KEY, JSON.stringify([
      newWatchRecord('159566', 'a', '2026-10-13'),
      gridRecord('old', '159566', '2026-01-01T00:00:00Z'),
      gridRecord('new', '159566', '2026-06-01T00:00:00Z'),
      gridRecord('other', '516650', '2026-09-01T00:00:00Z'),
    ]))
    expect(recordByCode('159566')?.id).toBe('new')
    expect(recordByCode('516650')?.id).toBe('other')
    expect(recordByCode('000001')).toBeUndefined()
  })

  it('只有关注记录时返回它；已保存标的列表不含关注记录', () => {
    store.set(RECORDS_KEY, JSON.stringify([newWatchRecord('159566', 'a', '2026-10-13'), gridRecord('g', '516650', '2026-09-01T00:00:00Z')]))
    expect(recordByCode('159566')?.watch).toBe(true)
    expect(readRecords()).toHaveLength(2)
    expect(readGridRecords().map(item => item.id)).toEqual(['g'])
  })
})
