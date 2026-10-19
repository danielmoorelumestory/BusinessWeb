import { describe, expect, it } from 'vitest'
import { describeDailyMaEvents } from './etfMaDescription'

const bars = (closes: number[]) => closes.map((close, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), close }))

describe('日线 MA 位置和均线方向', () => {
  it('股价位于两条均线上方显示红色', () => {
    expect(describeDailyMaEvents(bars([...Array(20).fill(10), 11]))).toEqual({ description: 'MA5上10上、M5回升10回升', signal: 'up' })
  })
  it('股价位于两条均线下方显示绿色', () => {
    expect(describeDailyMaEvents(bars([...Array(20).fill(10), 11, 8]))).toEqual({ description: 'MA5下10下、M5回落10回落', signal: 'down' })
  })
  it('股价低于MA5但高于MA10仍显示红色', () => {
    expect(describeDailyMaEvents(bars([...Array(20).fill(10), 11, 10.15, 10.16]))).toEqual({ description: 'MA5下10上、M5回升10回升', signal: 'up' })
  })
  it('股价高于MA5但低于MA10仍显示绿色', () => {
    expect(describeDailyMaEvents(bars([...Array(20).fill(10), 9, 9.85, 9.84]))).toEqual({ description: 'MA5上10下、M5回落10回落', signal: 'down' })
  })
  it('两条均线可反向运行', () => {
    expect(describeDailyMaEvents(bars([...Array(20).fill(10), 20, 11, 11, 11, 11, 11])).description).toBe('MA5平10下、M5回落10回升')
    expect(describeDailyMaEvents(bars([...Array(20).fill(10), 1, 9, 9, 9, 9, 9])).description).toBe('MA5平10上、M5回升10回落')
  })
  it('平盘中性，历史不足明确提示', () => {
    expect(describeDailyMaEvents(bars(Array(20).fill(10)))).toEqual({ description: 'MA5平10平、M5走平10走平', signal: 'neutral' })
    expect(describeDailyMaEvents(bars(Array(10).fill(10))).description).toContain('历史不足')
  })
})
