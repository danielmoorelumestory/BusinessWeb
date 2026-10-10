import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import companies from './companies.json'
import { FOCUS, SOURCES, VALUATIONS, evaluate } from './research'
import { MCP, amount, cashAssessment, mcpCompany, primaryListing } from './mcpResearch'
import coreReview from './coreReview.json'

describe('固态电池研究证据完整性', () => {
  it('竞选覆盖原分类与补充主体，公开调用记录可追溯到本次响应且不把空返回算作报价', () => {
    expect(coreReview.outcomes).toHaveLength(companies.length + coreReview.supplementalCompanies)
    expect(new Set(coreReview.outcomes.map(r => r.id)).size).toBe(coreReview.outcomes.length)
    const manifest = JSON.parse(readFileSync(`public/${coreReview.manifest}`, 'utf8'))
    expect(manifest.calls).toHaveLength(coreReview.requests)
    expect(readFileSync(`public/${coreReview.report}`, 'utf8')).toContain('本报告仅供研究参考')
    const prefix = coreReview.manifest.slice(0, coreReview.manifest.lastIndexOf('/') + 1)
    for (const call of manifest.calls) {
      const raw = JSON.parse(readFileSync(`public/${prefix}${call.file}`, 'utf8'))
      expect(raw.arguments).toEqual(call.arguments)
      expect(raw.retrievedAt).toBe(call.retrievedAt)
    }
    for (const outcome of coreReview.outcomes) expect(MCP.companies.some(c => c.id === outcome.id)).toBe(true)
    expect(primaryListing(mcpCompany('纳科诺尔'))).toBeUndefined()
  })
  it('观察池公司全部可追溯到原产业树，去重且不把未核上市主体配上股票代码', () => {
    const tree = readFileSync('public/industry/solid-state.json', 'utf8')
    expect(new Set(companies.map(c => c.name)).size).toBe(companies.length)
    for (const c of companies) {
      expect(tree).toContain(c.name)
      expect(c.path).toBeTruthy()
    }
    for (const name of ['卫蓝新能源', '清陶能源', '辉能科技', '智己汽车', '三星']) {
      expect(companies.find(c => c.name === name)?.code).toBe('')
    }
  })
  it('每张重点研究卡都有证据、反证、估值边界、验证条件和可用来源', () => {
    const sourceIds = new Set<string>(SOURCES.map(s => s.id))
    expect(new Set(FOCUS.map(c => c.id)).size).toBe(FOCUS.length)
    for (const c of FOCUS) {
      expect(c.sources.length).toBeGreaterThan(0)
      c.sources.forEach(id => expect(sourceIds.has(id)).toBe(true))
      for (const field of ['evidence', 'drivers', 'bull', 'bear', 'valuation', 'verify'] as const) expect(c[field].length).toBeGreaterThan(20)
    }
  })
  it('原始 MCP 证据可回溯，跨上市地去重，空资料不充当行情', () => {
    const treeNames = new Set(MCP.companies.filter(c => c.origin === '原产业树').map(c => c.name))
    companies.forEach(c => expect(treeNames.has(c.name)).toBe(true))
    expect(primaryListing(mcpCompany('贝特瑞'))).toBeUndefined()
    expect(primaryListing(mcpCompany('三星'))).toBeUndefined()
    expect(mcpCompany('长远锂科')?.displayName).toContain('五矿新能')
    for (const c of MCP.companies) for (const l of c.listings) {
      const raw = JSON.parse(readFileSync(`public/${l.source}`, 'utf8'))
      expect(raw.arguments.symbol).toBe(l.symbol)
      expect(raw.retrievedAt).toBeTruthy()
      if (l.available) {
        expect(l.marketTime).toBeTruthy()
        expect(l.currency).toBeTruthy()
        expect(l.price).toBeGreaterThan(0)
        expect(raw.data.longName).toBe(l.providerName)
      } else expect(l.price).toBeNull()
    }
  })
  it('标准化 H1 与公告控制值一致，负现金流和零收入不会丢失', () => {
    expect(mcpCompany('先导智能')?.financials?.revenue).toBeCloseTo(8189022992.98, 2)
    expect(mcpCompany('当升科技')?.financials?.cfo).toBeCloseTo(85954959.44, 2)
    expect(mcpCompany('QuantumScape')?.financials?.revenue).toBe(0)
    expect(mcpCompany('QuantumScape')?.financials?.currency).toBe('USD')
    expect(mcpCompany('国轩高科')?.financials?.fcf).toBeLessThan(0)
    expect(cashAssessment(mcpCompany('国轩高科'))).toContain('扩产消耗现金')
    expect(amount(null)).toBe('[MISSING]')
    expect(amount(0)).toBe('0 亿')
    for (const c of MCP.companies) {
      const f = c.financials
      if (f?.cfo != null && f.capex != null && f.fcf != null) expect(f.fcf).toBeCloseTo(f.cfo - f.capex, 2)
      f?.sources.forEach(path => expect(readFileSync(`public/${path}`, 'utf8')).toContain(f.sourceKind === 'filing' ? '未经审计' : 'quarterly'))
    }
  })
  it('三情景概率合计为 1、情景价递增，盈亏比仅在 Bear<P<Base 时给出，且不虚报 2:1', () => {
    for (const v of VALUATIONS) {
      expect(v.prob.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
      const r = evaluate(v)
      expect(r.prices[0]).toBeLessThan(r.prices[2])
      if (r.valid) expect(r.ratio).toBeCloseTo((r.prices[1] - v.price) / (v.price - r.prices[0]))
      else expect(r.ratio).toBeNull()
      expect(r.ratio === null || r.ratio < 2).toBe(true)
    }
  })
})
