import { expect, it } from 'vitest'
import { mergeQuote, type Quote } from '../../notes-site/src/lib/grid-trading'
import { setReviewCandles, renderReviewAnalysis } from '../../notes-site/src/lib/review-analysis'

it('最新报价补齐落后一天的日线，日周月同步重算，盘中均保留暂态标识', () => {
  const candles = Array.from({ length: 60 }, (_, i) => ({ date: new Date(Date.UTC(2026, 5, i + 1)).toISOString().slice(0, 10), close: 10, open: 10, high: 10, low: 10 }))
  const quote: Quote = { code: '600005', name: '标的', date: '2026-07-31', price: 11, high: 11.5, low: 9.9, open: 10 }
  const merged = mergeQuote(candles, quote)
  expect(merged).toHaveLength(61)
  expect(merged[60]).toMatchObject({ date: quote.date, close: 11 })
  expect(setReviewCandles(quote.code, merged, false)).toBe(true)
  for (const period of ['day', 'week', 'month'] as const) {
    const html = renderReviewAnalysis(quote.code, period, '/notes/', true)
    expect(html).toContain('数据基准 2026-07-31')
    expect(html).toContain('未收盘暂态')
  }
  expect(renderReviewAnalysis(quote.code, 'day', '/notes/', true)).toContain('MA5上10上')
  expect(setReviewCandles(quote.code, merged, true)).toBe(true)
  for (const period of ['day', 'week', 'month'] as const) expect(renderReviewAnalysis(quote.code, period, '/notes/', true)).not.toContain('未收盘暂态')
  const updated = mergeQuote(merged, { ...quote, price: 12, high: 12 })
  expect(updated).toHaveLength(61)
  expect(updated[60].close).toBe(12)
})
