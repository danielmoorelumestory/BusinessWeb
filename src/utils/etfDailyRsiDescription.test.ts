import { describe, expect, it } from 'vitest'
import { describeRsiCross, describeDailyRsiEvents, buildRsiSegments, wilderRsiSeries } from './etfDailyRsiDescription'
import { technicalState } from '../../scripts/etf-technical.mjs'
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
  it('日线渲染三段（RSI6/RSI24/50 顺序、RSI6 箭头、交叉距今），周线历史不足时保持原提示', () => {
    const closes = Array.from({ length: 90 }, (_, i) => 10 + Math.sin(i / 3))
    const candles = closes.map((close, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), close, open: close, high: close, low: close }))
    setReviewCandles('600003', candles)
    const event = describeDailyRsiEvents(closes)
    const html = renderReviewAnalysis('600003', 'day', '/notes/', true)
    expect(html).toContain(`<div class="rsi-segments">${event.segments!.map(segment => `<strong class="signal-${segment.signal}">${segment.text.replace(/>/g, '&gt;')}</strong>`).join('')}</div>`)
    expect(renderReviewAnalysis('600003', 'week', '/notes/', true)).toContain('RSI6/24历史不足')
  })
})

describe('RSI 三段：顺序、RSI6 箭头、交叉距今、超买超卖', () => {
  const at = (...pairs: [number, number][]) => pairs.map(([fast, slow]) => ({ fast, slow }))
  it.each([
    [[60, 55], 'RSI6 > RSI24 > 50', 'up'], [[55, 45], 'RSI6 > 50 > RSI24', 'up'], [[45, 40], '50 > RSI6 > RSI24', 'up'],
    [[55, 60], 'RSI24 > RSI6 > 50', 'down'], [[45, 55], 'RSI24 > 50 > RSI6', 'down'], [[40, 45], '50 > RSI24 > RSI6', 'down'],
  ] as const)('顺序 %j → %s', ([fast, slow], text, signal) => {
    expect(buildRsiSegments(at([fast, slow]), '日')[0]).toEqual({ text, signal })
  })
  it('RSI6 箭头只看快线，变化不超过 0.1 为灰', () => {
    expect(buildRsiSegments(at([50, 55], [52, 55]), '日')[1]).toEqual({ text: 'RSI6↑', signal: 'up' })
    expect(buildRsiSegments(at([52, 55], [50, 55]), '日')[1]).toEqual({ text: 'RSI6↓', signal: 'down' })
    expect(buildRsiSegments(at([50, 55], [50.05, 55]), '日')[1]).toEqual({ text: 'RSI6→', signal: 'neutral' })
  })
  it('交叉距今随周期单位，当根交叉写「当日/当周」，无交叉为灰', () => {
    const points = at([40, 50], [55, 50], [58, 52], [60, 55])
    expect(buildRsiSegments(points, '日')[2]).toEqual({ text: '金叉2日', signal: 'up' })
    expect(buildRsiSegments(points, '周')[2].text).toBe('金叉2周')
    expect(buildRsiSegments(at([40, 50], [55, 50]), '月')[2].text).toBe('金叉当月')
    expect(buildRsiSegments(at([60, 50], [62, 52]), '日')[2]).toEqual({ text: '未见交叉', signal: 'neutral' })
  })
  it('RSI6 ≥ 70 追加超买、≤ 30 追加超卖（极端色），其余不追加', () => {
    expect(buildRsiSegments(at([72, 60]), '日').at(-1)).toEqual({ text: '超买', signal: 'extreme' })
    expect(buildRsiSegments(at([28, 40]), '日').at(-1)).toEqual({ text: '超卖', signal: 'extreme' })
    expect(buildRsiSegments(at([50, 55]), '日')).toHaveLength(3)
  })
  it('RSI6 与 RSI24 相等、历史不足', () => {
    expect(buildRsiSegments(at([50, 50]), '日')[0]).toEqual({ text: 'RSI6 = RSI24', signal: 'neutral' })
    expect(buildRsiSegments([{ fast: null, slow: null }], '日')).toEqual([{ text: 'RSI6/24历史不足', signal: 'neutral' }])
  })
})
