import { describe, expect, it } from 'vitest'
import {
  LAB_DIRECTIONS, LAB_SHOWCASE, VERDICT_LABEL,
  avoidedDirections, findDirection, labStats, recommendedDirections,
} from './aiLab'

describe('aiLab 数据', () => {
  it('共 14 个方向，slug 唯一', () => {
    expect(LAB_DIRECTIONS).toHaveLength(14)
    const slugs = LAB_DIRECTIONS.map(d => d.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('标记文案固定', () => {
    expect(VERDICT_LABEL).toEqual({
      strong: '强烈推荐', recommend: '推荐', try: '可以试', experiment: '实验', avoid: '不推荐',
    })
    for (const d of LAB_DIRECTIONS) expect(VERDICT_LABEL[d.verdict], d.slug).toBeTruthy()
  })

  it('推荐组按匹配度降序且不含不推荐；同分保持原顺序', () => {
    const rec = recommendedDirections()
    expect(rec).toHaveLength(11)
    expect(rec.every(d => d.verdict !== 'avoid')).toBe(true)
    for (let i = 1; i < rec.length; i++) expect(rec[i - 1].fit).toBeGreaterThanOrEqual(rec[i].fit)
    expect(rec.map(d => d.slug)).toEqual([
      'ai-skills', 'indie-dev', 'free-tools', 'digital-goods', 'blog', 'image-tools', 'mini-program', 'newsletter', 'video', 'game-guides', 'dropshipping',
    ])
  })

  it('不推荐组 3 个，全部是 avoid', () => {
    expect(avoidedDirections().map(d => d.slug)).toEqual(['outsourcing', 'content-farm', 'paid-signals'])
  })

  it('findDirection 命中与未命中', () => {
    expect(findDirection('blog')?.title).toBe('博客')
    expect(findDirection('nope')).toBeUndefined()
  })

  it('labStats 与数据一致', () => {
    expect(labStats()).toEqual({
      works: LAB_SHOWCASE.length,
      running: LAB_DIRECTIONS.filter(d => d.status === '进行中').length,
      stopped: LAB_DIRECTIONS.filter(d => d.status === '已停止').length,
    })
    expect(labStats()).toEqual({ works: 4, running: 2, stopped: 0 })
  })

  it('无货源电商带预算、期限与停止条件', () => {
    const d = findDirection('dropshipping')!
    expect(d.verdict).toBe('experiment')
    expect(d.limits).toEqual({ budget: '¥5000', deadline: '3 个月', stopWhen: '到期未盈利即停' })
  })

  it('只有已发生的事才有日志', () => {
    const withLogs = LAB_DIRECTIONS.filter(d => d.logs.length > 0).map(d => d.slug)
    expect(withLogs.sort()).toEqual(['ai-skills', 'indie-dev'])
    for (const d of LAB_DIRECTIONS) for (const l of d.logs) expect(l.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('作品橱窗 4 个站内链接', () => {
    expect(LAB_SHOWCASE.map(s => s.path)).toEqual(['/invest/ai-tools', '/valuation', '/grid-trading', '/about'])
  })
})
