import { describe, expect, it } from 'vitest'
import { INDUSTRY_GROUPS, TOTAL_ETF_COUNT, internalNoteSlug } from './industryEtf'
import { findNote, NOTES } from './notes'

describe('行业 ETF 数据', () => {
  it('7 个行业组共 59 只，各组 count 与条目数一致', () => {
    expect(INDUSTRY_GROUPS).toHaveLength(7)
    expect(TOTAL_ETF_COUNT).toBe(59)
    for (const g of INDUSTRY_GROUPS) expect(g.count, g.name).toBe(g.items.length)
  })

  it('每只 ETF 都有代码、名称、市场；同一组内代码不重复', () => {
    for (const g of INDUSTRY_GROUPS) {
      const keys = g.items.map(i => `${i.code}-${i.market}`)
      expect(new Set(keys).size, g.name).toBe(keys.length)
      for (const i of g.items) {
        expect(i.code, g.name).toBeTruthy()
        expect(i.name, g.name).toBeTruthy()
        expect(i.market, g.name).toBeTruthy()
      }
    }
  })

  it('站内参考链接（notes/<slug>）指向真实存在的笔记', () => {
    const refs = INDUSTRY_GROUPS.flatMap(g => g.items).filter(i => i.referenceUrl)
    expect(refs).toHaveLength(59)
    for (const i of refs) {
      const slug = internalNoteSlug(i.referenceUrl)
      expect(slug, i.referenceUrl).not.toBeNull()
      expect(findNote(slug!), i.referenceUrl).toBeDefined()
    }
  })

  it('59 只 ETF 都能打开自己的独立分析笔记', () => {
    for (const item of INDUSTRY_GROUPS.flatMap(group => group.items)) {
      const own = NOTES.find(note => note.slug.startsWith(`${item.code}-`))
      expect(own, item.code).toBeDefined()
    }
  })

  it('internalNoteSlug 只认 notes/<slug>', () => {
    expect(internalNoteSlug('notes/abc-1')).toBe('abc-1')
    expect(internalNoteSlug('notes/abc/')).toBe('abc')
    expect(internalNoteSlug('https://x.test/notes/abc')).toBeNull()
    expect(internalNoteSlug(undefined)).toBeNull()
  })
})
