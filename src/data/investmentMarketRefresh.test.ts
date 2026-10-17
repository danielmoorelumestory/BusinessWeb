import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import refresh from './investmentMarketRefresh.json'
import metrics from './bondFundMetrics.json'
import { INDUSTRY_GROUPS } from './industryEtf'
import { BROAD_ETFS } from './broadEtf'
import { STRATEGY_ASSET_ETF_GROUPS } from './strategyAssetEtf'
import { extractEtfJudgment, latestInvestmentNote } from '../utils/etfJudgment'

const archive = JSON.parse(readFileSync(resolve('public', refresh.archivePath.slice(1)), 'utf8'))

describe('10月16日行情更新', () => {
  it('清单80个标的全部有对应的最新报告和可复算行情证据', () => {
    const items = [...INDUSTRY_GROUPS.flatMap(g => g.items), ...BROAD_ETFS, ...STRATEGY_ASSET_ETF_GROUPS.flatMap(g => g.items)]
    expect(archive.records).toHaveLength(80)
    expect(archive.records.map((r: { code: string }) => r.code).sort()).toEqual(items.map(i => i.code).sort())
    for (const item of items) {
      const record = archive.records.find((r: { code: string }) => r.code === item.code)
      const note = latestInvestmentNote(item.code)!
      const markdown = readFileSync(resolve('public/notes', `${note.slug}.md`), 'utf8')
      expect(note.date).toBe(refresh.updatedOn)
      expect(extractEtfJudgment(markdown, note.date)).toBe(`${record.asOf} ${record.series ? '净值' : '收盘'}｜${record.summary}`)
      expect(markdown).toContain(refresh.archivePath)
    }
  })

  it('ETF均线及周五完整周有实际日K支持；货币ETF不套股票趋势', () => {
    for (const record of archive.records.filter((r: { series?: unknown }) => !r.series)) {
      const bars = record.last270Bars as string[][]
      expect(bars.at(-1)![0]).toBe('2026-10-16')
      expect(Number(bars.at(-1)![2])).toBe(record.close)
      expect(record.completedWeeklyClose.date).toBe('2026-10-16')
      expect(record.weekComplete).toBe(true)
      const closes20 = bars.slice(-20).map(b => Number(b[2]))
      expect(record.ma['20']).toBeCloseTo(closes20.reduce((a, b) => a + b, 0) / 20, 10)
      if (record.appendedQuote) {
        expect(record.quoteDate).toBe('2026-10-16')
      }
    }
    const money = archive.records.find((r: { code: string }) => r.code === '511880')
    expect(money.stockTrendApplicable).toBe(false)
    expect(money.short).toBeNull()
    expect(money.summary).toContain('股票式趋势判断不适用')
  })

  it('债基使用已披露净值和分红再投资，窗口端点与展示指标一致', () => {
    for (const record of archive.records.filter((r: { series?: unknown }) => r.series)) {
      const metric = metrics[record.code as keyof typeof metrics]
      expect(record.series.at(-1).date).toBe(record.asOf)
      expect(refresh.fundNavDates).toContain(record.asOf)
      expect(metric.asOf).toBe(record.asOf)
      const three = record.metrics3y ?? record.availableWindow
      expect(metric.returnPct).toBeCloseTo(three.returnPct, 10)
      expect(metric.maxDrawdownPct).toBeLessThanOrEqual(record.availableWindow.maxDrawdownPct)
      const base = record.series.find((row: { date: string }) => row.date === three.start)
      expect((record.series.at(-1).wealth / base.wealth - 1) * 100).toBeCloseTo(three.returnPct, 10)
    }
    const penghua = archive.records.find((r: { code: string }) => r.code === '000143')
    expect(penghua.asOf).toBe('2026-10-15')
    expect(penghua.currentNav).toBeGreaterThan(0)
  })
})
