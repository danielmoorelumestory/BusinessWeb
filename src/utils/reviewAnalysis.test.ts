import { describe, expect, it } from 'vitest'
import { renderReviewAnalysis, REVIEW_ANALYSIS_AS_OF, needsReviewAnalysis, canRefreshReviewAnalysis, setReviewCandles } from '../../notes-site/src/lib/review-analysis'
import { describeMa } from './etfMaDescription'
import { macdDescription, rsiDescription } from './etfTechnicalDescription'
import snapshot from '../data/etfTechnical.json'

describe('复盘列表的日周月判断', () => {
  it('三周期和ETF清单共用同一份数据和描述，保留报告链接', () => {
    const record = snapshot.records['159593']
    for (const period of ['day', 'week', 'month'] as const) {
      const html = renderReviewAnalysis('159593', period, '/notes/')
      expect(html).toContain(`data-analysis="${period}"`)
      expect(html).toContain(describeMa(record[period]))
      expect(html).toContain(macdDescription(record[period]))
      expect(html).toContain(rsiDescription(record[period]))
      expect(html).toContain('/notes/159593-csi-a50-broad-etf-analysis/')
      expect(html).toContain(REVIEW_ANALYSIS_AS_OF)
    }
    expect(renderReviewAnalysis('159593', 'month', '/notes/')).toContain('未收盘暂态')
    expect(renderReviewAnalysis('159593', 'month', '/notes/')).toContain('MACD样本较短')
  })
  it('未知代码、非适用品种不会冒用短中期结论', () => {
    expect(renderReviewAnalysis('999999', 'day', '/notes/')).toContain('>—</td>')
    expect(renderReviewAnalysis('511880', 'week', '/notes/')).toContain('不适用')
    expect(renderReviewAnalysis('000015', 'month', '/notes/')).toContain('不适用')
    expect(renderReviewAnalysis(' 159593 ', 'day', '/notes/')).toContain('低于全部均线')
  })
  it('清单外标的可用实际日线补算，不混用其他标的快照', () => {
    expect(needsReviewAnalysis('600989')).toBe(true)
    const candles = Array.from({ length: 80 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), open: 2+i*.01, close: 2+i*.01, high: 2+i*.01, low: 2+i*.01 }))
    expect(setReviewCandles('600989', candles)).toBe(true)
    expect(needsReviewAnalysis('600989')).toBe(false)
    const day = renderReviewAnalysis('600989', 'day', '/notes/')
    expect(day).toContain('站上全部均线，多头排列')
    expect(day).toContain('100.0 超买')
    expect(day).toContain('2026-03-21')
    const eventDay = renderReviewAnalysis('600989', 'day', '/notes/', true)
    expect(eventDay).toContain('MA5上10上、M5回升10回升')
    expect(eventDay).not.toContain('站上全部均线')
    expect(eventDay).not.toContain('100.0 超买')
    expect(eventDay).toContain('超买，变化不大')
    expect(renderReviewAnalysis('600989', 'week', '/notes/', true)).toContain('RSI6/24历史不足')
    expect(renderReviewAnalysis('600989', 'month', '/notes/')).toContain('历史不足')
    expect(renderReviewAnalysis('600989', 'month', '/notes/')).toContain('未收盘暂态')
    expect(setReviewCandles('600001', [])).toBe(false)
  })
  it('链接前缀中的特殊字符经过转义', () => {
    const html=renderReviewAnalysis('159593','day','/notes/" onmouseover="bad')
    expect(html).toContain('&quot;')
    expect(html).not.toContain(' onmouseover="bad')
  })
  it('已有快照可以刷新，较旧行情不能覆盖较新状态，非适用品种不补算', () => {
    expect(canRefreshReviewAnalysis('159865')).toBe(true)
    expect(canRefreshReviewAnalysis('513180')).toBe(true)
    expect(canRefreshReviewAnalysis('511880')).toBe(false)
    const candles = Array.from({ length: 80 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, i + 1)).toISOString().slice(0, 10), open: 2+i*.01, close: 2+i*.01, high: 2+i*.01, low: 2+i*.01 }))
    const original = renderReviewAnalysis('159865', 'day', '/notes/')
    expect(setReviewCandles('159865', candles.map(candle => ({ ...candle, date: candle.date.replace('2026', '2025') })))).toBe(false)
    expect(renderReviewAnalysis('159865', 'day', '/notes/')).toBe(original)
    expect(setReviewCandles('159865', candles)).toBe(true)
    for (const period of ['day', 'week', 'month'] as const) {
      expect(renderReviewAnalysis('159865', period, '/notes/')).toContain('2026-12-19')
    }
    expect(setReviewCandles('511880', candles)).toBe(false)
    expect(renderReviewAnalysis('511880', 'day', '/notes/')).toContain('不适用')
  })
})
