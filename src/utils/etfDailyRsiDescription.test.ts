import { describe, expect, it } from 'vitest'
import { describeRsiCross, describeDailyRsiEvents, wilderRsiSeries } from './etfDailyRsiDescription'
import { technicalState } from '../../scripts/etf-technical.mjs'
import { rsiDescription } from './etfTechnicalDescription'
import { renderReviewAnalysis, setReviewCandles } from '../../notes-site/src/lib/review-analysis'

describe('日线 RSI6/24 交叉', () => {
  it('最近金叉显示红色，最近死叉显示绿色，后续持续同侧保留状态', () => {
    const points = [{ fast: 40, slow: 50 }, { fast: 55, slow: 50 }, { fast: 60, slow: 55 }]
    expect(describeRsiCross(points)).toEqual({ description: 'RSI6/24金叉', signal: 'up' })
    expect(describeRsiCross([...points, { fast: 45, slow: 50 }, { fast: 40, slow: 45 }])).toEqual({ description: 'RSI6/24死叉', signal: 'down' })
  })
  it('相等后回到原侧不产生假交叉，没有历史交叉时只描述位置', () => {
    expect(describeRsiCross([{ fast: 60, slow: 50 }, { fast: 50, slow: 50 }, { fast: 60, slow: 50 }]).description).toBe('RSI6高于RSI24')
    expect(describeDailyRsiEvents(Array(30).fill(10)).description).toBe('RSI6/24重合')
    expect(describeDailyRsiEvents([10, 11]).description).toContain('历史不足')
    expect(describeDailyRsiEvents(Array(24).fill(10)).description).toContain('历史不足')
    expect(describeDailyRsiEvents(Array(25).fill(10)).description).toBe('RSI6/24重合')
  })
  it('Wilder 平滑与现有 RSI14 口径一致', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 10 + Math.sin(i / 3) + i * .02)
    const series = wilderRsiSeries(closes, 14)
    expect(series.slice(0, 14).every(value => value === null)).toBe(true)
    const state = technicalState(closes.map((close, i) => [String(i), close, close, close, close, 0]))!
    expect(series[59]).toBeCloseTo(state.rsi!, 10)
    expect(wilderRsiSeries(Array.from({ length: 20 }, (_, i) => i + 1), 6)[19]).toBe(100)
    expect(wilderRsiSeries(Array.from({ length: 20 }, (_, i) => 20 - i), 6)[19]).toBe(0)
  })
  it('日线保留交叉和强弱描述，只删除RSI14数值，周线使用相同格式', () => {
    const closes = Array.from({ length: 90 }, (_, i) => 10 + Math.sin(i / 3))
    const candles = closes.map((close, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), close, open: close, high: close, low: close }))
    setReviewCandles('600003', candles)
    const event = describeDailyRsiEvents(closes)
    const html = renderReviewAnalysis('600003', 'day', '/notes/', true)
    expect(html).toContain(`<strong class="signal-${event.signal}">${event.description}</strong>、`)
    const state = technicalState(candles.map(candle => [candle.date, candle.close, candle.close, candle.close, candle.close, 0]))!
    expect(html).toContain(rsiDescription(state).replace(/^\d+(?:\.\d+)?\s+/, ''))
    expect(html).not.toContain(`${state.rsi!.toFixed(1)} `)
    expect(renderReviewAnalysis('600003', 'week', '/notes/', true)).toContain('RSI6/24历史不足')
  })
})
