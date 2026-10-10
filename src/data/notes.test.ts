import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOTES, allNoteTags, findNote } from './notes'

const publicFile = (path: string) => resolve(__dirname, '../../public', path)

describe('NOTES 索引', () => {
  it('slug 唯一且只含小写字母、数字、连字符', () => {
    const slugs = NOTES.map(n => n.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
  })

  it('日期有效，且按日期倒序登记', () => {
    for (const n of NOTES) {
      expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${n.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(n.date)
    }
    const dates = NOTES.map(n => n.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('每篇都有标题、摘要、标签，并且对应的 Markdown 文件存在、没有残留 front matter', () => {
    for (const n of NOTES) {
      expect(n.title.length, n.slug).toBeGreaterThan(0)
      expect(n.summary.length, n.slug).toBeGreaterThan(0)
      expect(n.tags.length, n.slug).toBeGreaterThan(0)
      const file = publicFile(`notes/${n.slug}.md`)
      expect(existsSync(file), n.slug).toBe(true)
      expect(readFileSync(file, 'utf8').startsWith('---'), n.slug).toBe(false)
    }
  })

  it('report 指向的完整报告存在，且在 public/research/ 下', () => {
    for (const n of NOTES.filter(n => n.report)) {
      expect(n.report).toMatch(/^research\/[\w.-]+\.html$/)
      expect(existsSync(publicFile(n.report!)), n.slug).toBe(true)
    }
    expect(NOTES.filter(n => n.report).map(n => n.slug)).toEqual(['etf-grid-trading-master-plan'])
  })

  it('findNote 与 allNoteTags', () => {
    expect(findNote('swine-poultry-research')?.date).toBe('2026-09-15')
    expect(findNote('nope')).toBeUndefined()
    expect(findNote(undefined)).toBeUndefined()
    expect(allNoteTags()[0]).toEqual({ tag: '行业研究', count: 2 })
    expect(allNoteTags().every(t => t.count >= 1)).toBe(true)
  })
})
