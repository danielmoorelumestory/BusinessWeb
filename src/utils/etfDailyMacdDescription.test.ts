import { describe, expect, it } from 'vitest'
import { describeMacdHistory, describeDailyMacdEvents, type MacdPoint } from './etfDailyMacdDescription'
import { setReviewCandles, renderReviewAnalysis } from '../../notes-site/src/lib/review-analysis'

const history = (prior: MacdPoint, ...tail: MacdPoint[]) => [...Array.from({ length: 25 }, () => prior), ...tail]

describe('日线 MACD 最近交叉和分段颜色', () => {
  it.each([
    [1, '水上金叉'], [-1, '水下金叉'],
  ])('金叉无论水位均为红色，水位取交叉当时：%s', (dea, label) => {
    const result = describeMacdHistory(history({ dif: dea - .1, dea }, { dif: dea + .1, dea }, { dif: -1.8, dea: -2 }))
    expect(result.cross).toBe(label)
    expect(result.crossSignal).toBe('up')
    expect(result.axis).toBe('零轴下')
    expect(result.axisSignal).toBe('down')
    expect(result.bars).toBe('红柱扩大')
    expect(result.barsSignal).toBe('up')
  })
  it.each([
    [1, '水上死叉'], [-1, '水下死叉'],
  ])('死叉无论水位均为绿色，水位不随当前零轴位置变化：%s', (dea, label) => {
    const result = describeMacdHistory(history({ dif: dea + .1, dea }, { dif: dea - .2, dea }, { dif: 1.9, dea: 2 }))
    expect(result.cross).toBe(label)
    expect(result.crossSignal).toBe('down')
    expect(result.axis).toBe('零轴上')
    expect(result.axisSignal).toBe('up')
    expect(result.bars).toBe('绿柱收窄')
    expect(result.barsSignal).toBe('up')
  })
  it('红柱收窄和绿柱扩大为绿色', () => {
    const red = describeMacdHistory(history({ dif: .9, dea: 1 }, { dif: 1.2, dea: 1 }, { dif: 1.1, dea: 1 }))
    expect(red).toMatchObject({ cross: '水上金叉', crossSignal: 'up', bars: '红柱收窄', barsSignal: 'down' })
    const green = describeMacdHistory(history({ dif: 1.1, dea: 1 }, { dif: .9, dea: 1 }, { dif: .8, dea: 1 }))
    expect(green).toMatchObject({ cross: '水上死叉', crossSignal: 'down', bars: '绿柱扩大', barsSignal: 'down' })
  })
  it('新交叉替换旧交叉，持平和历史不足不捏造变化', () => {
    const latest = describeMacdHistory(history({ dif: .9, dea: 1 }, { dif: 1.1, dea: 1 }, { dif: -.9, dea: -1 }, { dif: -1.2, dea: -1 }))
    expect(latest.cross).toBe('水下死叉')
    expect(describeDailyMacdEvents(Array(30).fill(10))).toMatchObject({ cross: '未见交叉', bars: '零柱', barsSignal: 'neutral' })
    expect(describeDailyMacdEvents([10, 11]).cross).toBe('历史不足')
  })
  it('日线渲染分开着色，周线使用相同格式', () => {
    const closes = [...Array(40).fill(10), ...Array.from({ length: 30 }, (_, i) => 10 + i * .1), 12, 11, 10]
    const candles = closes.map((close, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), open: close, high: close, low: close, close }))
    expect(setReviewCandles('600002', candles)).toBe(true)
    const html = renderReviewAnalysis('600002', 'day', '/notes/', true)
    const result = describeDailyMacdEvents(closes)
    expect(html).toContain(`<strong class="signal-${result.crossSignal}">${result.cross}</strong>、<strong class="signal-${result.axisSignal}">${result.axis}</strong>、<strong class="signal-${result.barsSignal}">${result.bars}</strong>`)
    expect(renderReviewAnalysis('600002', 'week', '/notes/', true)).toContain('RSI6/24历史不足')
  })
})
