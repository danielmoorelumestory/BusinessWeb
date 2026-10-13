import { describe, expect, it } from 'vitest'
import { BROAD_ETFS, BROAD_ETF_REDUCTIONS } from './broadEtf'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractEtfJudgment, latestEtfNote } from '../utils/etfJudgment'

describe('宽基 ETF 首选', () => {
  it('10只宽基均有独立报告，列表能提取各自综合判断', () => {
    for (const item of BROAD_ETFS) {
      const note = latestEtfNote(item.code)
      expect(note, item.code).toBeDefined()
      const text = readFileSync(resolve('public/notes', `${note!.slug}.md`), 'utf8')
      expect(extractEtfJudgment(text, note!.date), item.code).toMatch(/^2026-10-13 收盘｜/)
    }
  })
  it('10类各一只，含指定加入的A50和纳指ETF，比较产品跟踪同一指数', () => {
    expect(BROAD_ETFS).toHaveLength(10)
    expect(new Set(BROAD_ETFS.map(item => item.family)).size).toBe(10)
    expect(new Set(BROAD_ETFS.map(item => item.code)).size).toBe(10)
    expect(BROAD_ETFS.map(item => item.code)).toEqual(expect.arrayContaining(['159593', '159941']))
    expect(BROAD_ETF_REDUCTIONS).toHaveLength(13)
    expect(BROAD_ETF_REDUCTIONS.every(removed => !BROAD_ETFS.some(item => item.family === removed.family))).toBe(true)
    for (const item of BROAD_ETFS) {
      expect(item.selectedAsOf).toBe('2026-10-13')
      expect(item.candidates.some(candidate => candidate.code === item.code)).toBe(true)
      for (const candidate of item.candidates) {
        expect(candidate.indexName, candidate.code).toBe(item.indexName)
        expect(candidate.annualFeePct).toBeCloseTo(candidate.managementFeePct + candidate.custodyFeePct)
        expect(candidate.aumAsOf).toBe('2026-06-30')
        expect(candidate.quoteAsOf).toBe('2026-10-13')
        expect(candidate.aumYi).toBeGreaterThan(0)
        expect(candidate.turnoverYi).toBeGreaterThan(0)
      }
    }
  })
})
