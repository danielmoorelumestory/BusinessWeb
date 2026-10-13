import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOTES } from '../data/notes'
import { extractEtfJudgment, latestEtfNote } from './etfJudgment'

describe('ETF文档综合判断', () => {
  it('从实际69篇报告的结论速览提取带日期的判断', () => {
    const notes = NOTES.filter(note => note.slug.endsWith('-etf-analysis'))
    let extracted = 0
    for (const note of notes) {
      const markdown = readFileSync(resolve('public/notes', `${note.slug}.md`), 'utf8')
      const result = extractEtfJudgment(markdown, note.date)
      if (result) {
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2} 收盘｜/)
        expect(result).not.toContain('**')
        extracted++
      }
    }
    expect(extracted).toBeGreaterThanOrEqual(69)
  })

  it('不回退到后续章节或摘要；支持组合判断及换行', () => {
    expect(extractEtfJudgment('## 一、结论速览\n\n暂无\n\n## 二、政策\n\n**综合判断：旧观点。**', '2026-10-13')).toBeNull()
    expect(extractEtfJudgment('## 一、结论速览\n\n**组合判断：震荡偏弱；\n等待确认。**', '2026-10-13')).toBe('2026-10-13 收盘｜震荡偏弱； 等待确认。')
  })

  it('按日期取该代码最新分析，忽略其他类型文档', () => {
    const base = { title: '', summary: '', tags: [] }
    const notes = [
      { ...base, slug: '510300-old-etf-analysis', date: '2026-10-12' },
      { ...base, slug: '510300-new-etf-analysis', date: '2026-10-14' },
      { ...base, slug: '510300-other-report', date: '2026-10-15' },
    ]
    expect(latestEtfNote('510300', notes)?.slug).toBe('510300-new-etf-analysis')
    expect(latestEtfNote('000000', notes)).toBeUndefined()
  })
})
