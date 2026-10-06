import { describe, expect, it } from 'vitest'
import { FIELDS, capTotal, cardWarnings, daysSince, emptyCard, filledCount } from './themeCard'

const today = new Date(2026, 9, 6)

describe('主题研究卡', () => {
  it('字段和书 31.12 一一对应，共 11 项', () => {
    expect(FIELDS).toHaveLength(11)
    expect(new Set(FIELDS.map(f => f.key)).size).toBe(11)
  })

  it('新卡提示缺证伪条件、仓位上限和复核日期', () => {
    const w = cardWarnings(emptyCard('a', '固态电池'), today)
    expect(w).toHaveLength(3)
  })

  it('填全后没有提醒', () => {
    const c = { ...emptyCard('a', 'x'), cap: '5', reviewed: '2026-09-01', values: { falsify: '连续两年良率不达标' } }
    expect(cardWarnings(c, today)).toEqual([])
  })

  it('超过 365 天未复核要提醒，刚好 365 天不提醒', () => {
    const base = { ...emptyCard('a', 'x'), cap: '5', values: { falsify: 'y' } }
    expect(cardWarnings({ ...base, reviewed: '2025-10-06' }, today)).toEqual([])
    expect(cardWarnings({ ...base, reviewed: '2025-10-05' }, today)[0]).toContain('超过一年')
  })

  it('复核日期在未来、仓位超 100 或日期乱写都要提醒', () => {
    const base = { ...emptyCard('a', 'x'), values: { falsify: 'y' } }
    expect(cardWarnings({ ...base, cap: '5', reviewed: '2027-01-01' }, today)[0]).toContain('未来')
    expect(cardWarnings({ ...base, cap: '120', reviewed: '2026-01-01' }, today)[0]).toContain('100')
    expect(cardWarnings({ ...base, cap: '5', reviewed: 'abc' }, today)[0]).toContain('格式')
    expect(daysSince('abc', today)).toBeNull()
  })

  it('统计已填项和仓位合计，忽略空白和非数字', () => {
    const a = { ...emptyCard('a', 'x'), cap: '5', values: { stage: ' ', cost: 'ok' } }
    const b = { ...emptyCard('b', 'y'), cap: 'abc' }
    const c = { ...emptyCard('c', 'z'), cap: '3.5' }
    expect(filledCount(a)).toBe(1)
    expect(capTotal([a, b, c])).toBe(8.5)
  })
})
