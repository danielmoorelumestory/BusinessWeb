import { describe, expect, it } from 'vitest'
import { aggregateCandles, combineAmount, combineVolume, parseHistory } from './chinaHistory'

describe('中国市场历史数据', () => {
  it('保留开高低收及成交手数，拒绝损坏的数据而非画出假行情', () => {
    expect(parseHistory([['2026-01-05', '10', '12', '13', '9', '200']])).toEqual([
      { date: '2026-01-05', open: 10, close: 12, high: 13, low: 9, volume: 200 },
    ])
    expect(() => parseHistory([['2026-02-30', '10', '12', '13', '9', '200']])).toThrow()
    expect(() => parseHistory([['2026-01-05', '10', '12', '11', '9', '200']])).toThrow()
    expect(() => parseHistory([['2026-01-05', '10', '12', '13', '9', '']])).toThrow()
  })
  const rows = [
    { date: '2025-12-31', open: 10, close: 12, high: 13, low: 9, volume: 100 },
    { date: '2026-01-02', open: 12, close: 11, high: 14, low: 10, volume: 200 },
    { date: '2026-01-05', open: 11, close: 15, high: 16, low: 10, volume: 300 },
  ]
  it('周线跨年按同一周聚合，取首开末收及最高最低并累加成交量', () => {
    expect(aggregateCandles(rows, 'week')[0]).toEqual({ date: '2026-01-02', open: 10, close: 11, high: 14, low: 9, volume: 300 })
    expect(aggregateCandles(rows, 'year')).toEqual([rows[0], { date: '2026-01-05', open: 12, close: 15, high: 16, low: 10, volume: 500 }])
  })
  it('沪深按周期对齐后合计，成交手数转换为亿股', () => {
    expect(combineVolume([rows[0]], [{ ...rows[0], volume: 200 }], 'day')[0].volume).toBe(0.0003)
    expect(combineVolume([{ ...rows[0], date: '2026-01-30' }], [{ ...rows[0], date: '2026-01-29', volume: 200 }], 'month')[0].volume).toBe(0.0003)
  })
  it('某市场缺失最新或中间交易日时拒绝不完整的合计', () => {
    expect(() => combineVolume(rows, [rows[0], rows[2]], 'day')).toThrow('沪深')
    expect(() => combineVolume(rows, rows.slice(0, 2), 'day')).toThrow('沪深')
  })
  it('年成交量先校验月份完整性，不能把缺月数据当作完整年', () => {
    const monthly = [
      { ...rows[0], date: '2025-01-31' },
      { ...rows[1], date: '2025-02-28' },
      { ...rows[2], date: '2025-03-31' },
    ]
    expect(() => combineVolume(monthly, [monthly[0], monthly[2]], 'year')).toThrow('沪深')
  })
  it('读取实际成交额，按万元转亿元合计，并累加成年成交额', () => {
    const sh = parseHistory([
      ['2026-01-30', '10', '12', '13', '9', '100', {}, '1.0', '2000000'],
      ['2026-02-27', '10', '12', '13', '9', '100', {}, '1.0', '3000000'],
    ])
    const sz = sh.map(r => ({ ...r, amount: r.amount! * 2 }))
    expect(combineAmount(sh, sz, 'month').map(r => r.amount)).toEqual([600, 900])
    expect(combineAmount(sh, sz, 'year')[0].amount).toBe(1500)
    expect(combineAmount([sh[0]], [sz[0]], 'day')[0].amount).toBe(600)
  })
  it('成交额缺失、无效或月份未对齐时拒绝展示不完整的合计', () => {
    expect(() => combineAmount(rows, rows, 'day')).toThrow('成交额数据不完整')
    for (const amount of ['bad', '-1', 'Infinity']) {
      expect(() => parseHistory([['2026-01-05', '10', '12', '13', '9', '200', {}, '1', amount]])).toThrow('成交额')
    }
    const monthly = rows.map((r, i) => ({ ...r, date: `2026-0${i + 1}-20`, amount: 10000 }))
    expect(() => combineAmount(monthly, [monthly[0], monthly[2]], 'year')).toThrow('成交额日期未对齐')
    const incomplete = aggregateCandles([{ ...rows[0], amount: 10000 }, rows[1]], 'week')
    expect(incomplete[0].amount).toBeUndefined()
  })
})
