// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, readSnapshot, writeSnapshot } from './d1Snapshot'
import { createTestD1 } from './d1TestDb'

const pulse = (n: number) => ({ schemaVersion: 1, reviews: Array.from({ length: n }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}` })) })
const historyRevisions = (db: ReturnType<typeof createTestD1>) =>
  (db.raw.prepare('SELECT revision FROM pulse_history ORDER BY id').all() as Array<{ revision: number }>).map(r => r.revision)

describe('d1Snapshot', () => {
  it('空库读取到版本 0 的初始快照', async () => {
    const db = createTestD1()
    expect(await readSnapshot(db, 'pulse')).toEqual({ revision: 0, payload: { schemaVersion: 1, reviews: [] } })
    expect(await readSnapshot(db, 'candidates')).toEqual({ revision: 0, payload: { schemaVersion: 1, items: [] } })
  })

  it('没有应用 schema 时 readSnapshot 抛错，由调用方处理', async () => {
    await expect(readSnapshot(createTestD1({ schema: false }), 'pulse')).rejects.toThrow()
  })

  it('写入后再读取，版本号加一', async () => {
    const db = createTestD1()
    expect(await writeSnapshot(db, 'candidates', 0, { schemaVersion: 1, items: [{ a: 1 }] })).toBe('ok')
    expect(await readSnapshot(db, 'candidates')).toEqual({ revision: 1, payload: { schemaVersion: 1, items: [{ a: 1 }] } })
    expect(await readSnapshot(db, 'pulse')).toMatchObject({ revision: 0 })
  })

  it('版本号不匹配返回 conflict，数据与历史都不变', async () => {
    const db = createTestD1()
    await writeSnapshot(db, 'pulse', 0, pulse(1), { keepHistory: true })
    expect(await writeSnapshot(db, 'pulse', 0, pulse(5), { keepHistory: true })).toBe('conflict')
    expect(await writeSnapshot(db, 'pulse', 7, pulse(5), { keepHistory: true })).toBe('conflict')
    expect(await readSnapshot(db, 'pulse')).toEqual({ revision: 1, payload: pulse(1) })
    expect(historyRevisions(db)).toEqual([0])
  })

  it('并发的两个写入带相同版本号时恰好一个成功', async () => {
    const db = createTestD1()
    const results = await Promise.all([writeSnapshot(db, 'candidates', 0, { v: 'a' }), writeSnapshot(db, 'candidates', 0, { v: 'b' })])
    expect(results.filter(r => r === 'ok')).toHaveLength(1)
    expect(results.filter(r => r === 'conflict')).toHaveLength(1)
    expect((await readSnapshot(db, 'candidates'))?.revision).toBe(1)
  })

  it('keepHistory 保存旧版本；不开启则不写历史', async () => {
    const db = createTestD1()
    await writeSnapshot(db, 'candidates', 0, { v: 1 })
    expect(historyRevisions(db)).toEqual([])
    await writeSnapshot(db, 'pulse', 0, pulse(1), { keepHistory: true })
    await writeSnapshot(db, 'pulse', 1, pulse(2), { keepHistory: true })
    expect(historyRevisions(db)).toEqual([0, 1])
    const saved = db.raw.prepare('SELECT payload FROM pulse_history WHERE revision = 1').get() as { payload: string }
    expect(JSON.parse(saved.payload)).toEqual(pulse(1))
  })

  it(`历史只保留最近 ${HISTORY_LIMIT} 份`, async () => {
    const db = createTestD1()
    for (let i = 0; i < 35; i++) expect(await writeSnapshot(db, 'pulse', i, pulse(1), { keepHistory: true })).toBe('ok')
    const kept = historyRevisions(db)
    expect(kept).toHaveLength(HISTORY_LIMIT)
    expect(kept[0]).toBe(5)
    expect(kept[kept.length - 1]).toBe(34)
  })

  it('schema.sql 可重复执行，不清空已有数据', async () => {
    const db = createTestD1()
    await writeSnapshot(db, 'candidates', 0, { v: 1 })
    const { readFileSync } = await import('node:fs')
    db.raw.exec(readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8'))
    expect((await readSnapshot(db, 'candidates'))?.revision).toBe(1)
  })
})
