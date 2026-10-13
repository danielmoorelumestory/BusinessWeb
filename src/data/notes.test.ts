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
    expect(allNoteTags()).toContainEqual({ tag: '行业研究', count: 2 })
    expect(allNoteTags()).toContainEqual({ tag: 'ETF', count: 75 })
    expect(findNote('159869-game-etf-analysis')?.title).toBe('游戏ETF华夏')
    expect(findNote('512980-media-etf-analysis')?.title).toBe('传媒ETF广发')
    expect(findNote('159732-consumer-electronics-etf-analysis')?.title).toBe('消费电子ETF华夏')
    expect(findNote('516510-cloud-computing-etf-analysis')?.title).toBe('云计算ETF易方达')
    expect(findNote('159852-software-etf-analysis')?.title).toBe('软件ETF嘉实')
    expect(findNote('159819-ai-etf-analysis')?.title).toBe('人工智能ETF')
    expect(findNote('515880-communications-etf-analysis')?.title).toBe('通信ETF')
    expect(findNote('588170-star-semiconductor-etf-analysis')?.title).toBe('科创半导体ETF')
    expect(findNote('588200-star-chip-etf-analysis')?.date).toBe('2026-10-13')
    expect(findNote('588200-star-chip-etf-analysis')?.title).toBe('科创芯片ETF')
    expect(findNote('159146-electric-power-etf-analysis')?.title).toContain('完善版')
    expect(findNote('516650-nonferrous-metals-etf-analysis')?.title).toContain('完善版')
    expect(findNote('600989-baofeng-energy-analysis')?.title).toContain('审核修订版')
    expect(findNote('600096-yuntianhua-analysis')?.title).toContain('审核修订版')
    expect(findNote('601318-ping-an-analysis')?.title).toContain('审核修订版')
    expect(findNote('562500-robot-etf-analysis')?.title).toContain('完善版')
    expect(findNote('159566-energy-storage-battery-etf-analysis')?.title).toContain('完善版')
    expect(findNote('516750-building-materials-etf-analysis')?.title).toContain('完善版')
    expect(findNote('159865-livestock-etf-analysis')?.title).toContain('完善版')
    expect(findNote('159259-growth-etf-analysis')?.title).toContain('完善版')
    expect(findNote('159928-consumer-etf-analysis')?.title).toContain('完善版')
    expect(findNote('513180-hang-seng-tech-etf-analysis')?.title).toContain('完善版')
    expect(allNoteTags().every(t => t.count >= 1)).toBe(true)
  })
})
