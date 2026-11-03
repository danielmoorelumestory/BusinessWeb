import { expect, it } from 'vitest'
import { aggregateBars, technicalState, type TechnicalBar } from '../../scripts/etf-technical.mjs'
import { arrangementWithMa20, describeDailyMaEvents } from './etfMaDescription'
import { describeDailyMacdEvents } from './etfDailyMacdDescription'
import { describeDailyRsiEvents } from './etfDailyRsiDescription'
import { setReviewCandles, renderReviewAnalysis } from '../../notes-site/src/lib/review-analysis'

it('三周期使用相同显示格式，各自按日、周、月K线计算指标及颜色', () => {
  const candles = Array.from({ length: 1800 }, (_, i) => {
    const close = 10 + i * .002 + Math.sin(i / 17) + Math.cos(i / 79)
    return { date: new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10), close, open: close, high: close, low: close }
  })
  expect(setReviewCandles('600004', candles)).toBe(true)
  const day: TechnicalBar[] = candles.map(candle => [candle.date, candle.open, candle.close, candle.high, candle.low, 0])
  const series = { day, week: aggregateBars(day, 'week'), month: aggregateBars(day, 'month') }
  const descriptions = []
  for (const period of ['day', 'week', 'month'] as const) {
    const bars = series[period], closes = bars.map(bar => Number(bar[2]))
    const ma = describeDailyMaEvents(bars.map(bar => ({ date: String(bar[0]), close: Number(bar[2]) })))
    const macd = describeDailyMacdEvents(closes, { day: '日', week: '周', month: '月' }[period] as '日' | '周' | '月'), rsi = describeDailyRsiEvents(closes, { day: '日', week: '周', month: '月' }[period] as '日' | '周' | '月')
    const state = technicalState(bars)!
    const html = renderReviewAnalysis('600004', period, '/notes/', true)
    // 周线的顺序段额外包含 MA20
    const maSegments = period === 'week' ? [arrangementWithMa20(state.close, state.ma5!, state.ma10!, state.ma20!), ...ma.segments.slice(1)] : ma.segments
    expect(html).toContain(`<div class="ma-segments">${maSegments.map(segment => `<strong class="signal-${segment.signal}">${segment.text.replace(/>/g, '&gt;')}</strong>`).join('')}</div>`)
    expect(html).toContain(`<div class="macd-segments">${macd.segments!.map(segment => `<strong class="signal-${segment.signal}">${segment.text.replace(/>/g, '&gt;')}</strong>`).join('')}</div>`)
    expect(html).toContain(`<div class="rsi-segments">${rsi.segments!.map(segment => `<strong class="signal-${segment.signal}">${segment.text.replace(/>/g, '&gt;')}</strong>`).join('')}</div>`)
    descriptions.push(ma.description)
  }
  expect(renderReviewAnalysis('600004', 'week', '/notes/', true)).toMatch(/MA20/)
  expect(renderReviewAnalysis('600004', 'day', '/notes/', true)).not.toMatch(/MA20/)
  expect(new Set(descriptions).size).toBeGreaterThan(1)
})
