import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STRATEGY_ASSET_ETF_GROUPS } from './strategyAssetEtf'
import { INDUSTRY_GROUPS } from './industryEtf'
import { BROAD_ETFS } from './broadEtf'
import { extractEtfJudgment, latestEtfNote, latestInvestmentNote } from '../utils/etfJudgment'

describe('策略、债券、商品与货币 ETF', () => {
  it('货币代表使用A类费率与优惠期限，收益不套用股票趋势或跨日净值', () => {
    const money = STRATEGY_ASSET_ETF_GROUPS.find(g => g.id === 'money-etf')!
    expect(money.items[0].code).toBe('511880')
    expect(money.items[0]).toHaveProperty('gridApplicable', false)
    const data = JSON.parse(readFileSync(resolve('public/data/511880-money-etf-analysis-2026-10-14.json'), 'utf8'))
    expect(data.stockTrendApplicable).toBe(false)
    expect(data.fees.annualFeePct).toBeCloseTo(data.fees.managementFeePct + data.fees.custodyFeePct + data.fees.salesServiceFeePct)
    expect(data.fees.salesFeePromotionThrough).toBe('2026-12-30')
    expect(data.nav.sameDatePremiumPct).toBeNull()
    expect(data.currentSevenDayAnnualizedPct).toBeNull()
    const note = latestEtfNote('511880')!
    const judgment = extractEtfJudgment(readFileSync(resolve('public/notes', `${note.slug}.md`), 'utf8'), note.date)!
    expect(judgment).toContain('股票式趋势判断不适用')
    expect(judgment).not.toContain('上升趋势')
  })
  it('跨组不重复，港股红利移入策略，黄金现货和黄金股分别保留', () => {
    expect(STRATEGY_ASSET_ETF_GROUPS.map(g => g.items.length)).toEqual([2, 1, 1, 6])
    const industry = INDUSTRY_GROUPS.flatMap(g => g.items)
    const selected = STRATEGY_ASSET_ETF_GROUPS.flatMap(g => g.items)
    const codes = [...industry, ...selected, ...BROAD_ETFS].map(i => i.code)
    expect(codes).toHaveLength(78)
    expect(new Set(codes).size).toBe(codes.length)
    expect(industry.some(i => i.code === '513630')).toBe(false)
    expect(selected.map(i => i.code)).toEqual(['512890', '513630', '518880', '511880', '000015', '006337', '161716', '110017', '019372', '010011'])
    const fundMetrics = JSON.parse(readFileSync(resolve('src/data/bondFundMetrics.json'), 'utf8'))
    const types = STRATEGY_ASSET_ETF_GROUPS.find(g => g.id === 'bond-funds')!.items.map(item => fundMetrics[item.code].bondType)
    for (const type of ['普通纯债', '一级债基', '二级债基']) expect(types.filter(value => value === type)).toHaveLength(2)
    expect(industry.some(i => i.code === '517520')).toBe(true)
  })

  it('各代表都有独立报告，备注可提取实际数据日期且净值不跨日计算溢价', () => {
    for (const item of STRATEGY_ASSET_ETF_GROUPS.flatMap(g => g.items)) {
      const note = latestInvestmentNote(item.code)!
      expect(note, item.code).toBeDefined()
      const text = readFileSync(resolve('public/notes', `${note.slug}.md`), 'utf8')
      const isFund = note.slug.endsWith('-bond-fund-analysis')
      const date = item.code === '513630' || isFund ? '2026-10-13' : '2026-10-14'
      expect(extractEtfJudgment(text, note.date), item.code).toMatch(new RegExp(`^${date} ${isFund ? '净值' : '收盘'}｜`))
    }
    const archive = JSON.parse(readFileSync(resolve('public/data/strategy-asset-etf-reports-2026-10-14.json'), 'utf8'))
    expect(archive.records).toHaveLength(4)
    for (const record of archive.records) {
      expect(record.trend.asOf).toBe('2026-10-14')
      expect(record.nav.asOf).toBe('2026-10-13')
      expect(record.nav.sameDatePremiumPct).toBeNull()
    }
  })
})
