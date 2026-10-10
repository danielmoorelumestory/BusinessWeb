import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MCP } from './mcpResearch'
import { COMPANY_LENSES } from './coverage'
import { solidCompanyById, solidCompanyPath, solidCompanyReport } from './companyResearch'

describe('固态公司独立研究完整性', () => {
  it('全池与对照都有唯一可解的独立页及公司特定角色，来源文件存在', () => {
    expect(new Set(MCP.companies.map(c => c.id)).size).toBe(MCP.companies.length)
    for (const c of MCP.companies) {
      expect(COMPANY_LENSES.has(c.name), c.name).toBe(true)
      expect(solidCompanyById(c.id)).toBe(c)
      expect(solidCompanyPath(c)).toMatch(/^\/future-trends\/solid-state\//)
      const report = solidCompanyReport(c)
      expect(report.role.length).toBeGreaterThan(20)
      expect(report.sections.length).toBeGreaterThanOrEqual(10)
      expect(report.disclaimer).toBe('本报告仅供研究参考，不构成个人投资建议。')
      for (const source of report.sources.filter(s => !s.url.startsWith('http'))) expect(readFileSync(`public/${source.url}`, 'utf8').length).toBeGreaterThan(0)
    }
  })
  it('无有效报价不生成估值草稿，新增三表保留日期与负现金', () => {
    const btr = solidCompanyReport(solidCompanyById('920185-bj')!)
    expect(btr.draft).toBeNull()
    expect(btr.marketRows[0][1]).toBe('[MISSING]')
    const star = solidCompanyReport(solidCompanyById('300568-sz')!)
    expect(star.financials?.history.length).toBeGreaterThan(0)
    const gotion = solidCompanyReport(solidCompanyById('002074-sz')!)
    expect(gotion.financials?.fcf).toBeLessThan(0)
    expect(gotion.sections.flatMap(s => s.items).join('')).toContain('扩产消耗现金')
  })
})
