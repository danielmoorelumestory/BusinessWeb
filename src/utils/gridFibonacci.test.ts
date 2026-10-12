import { describe, expect, it } from 'vitest'
import { autoFib, fibFromDates, fibLines, normalizeFib, normalizeFibSets, normalizeView, parseFib, type Candle } from '../../notes-site/src/lib/grid-trading'

const price = (fib: ReturnType<typeof parseFib>['fib'], ratio: number) => fibLines(fib!).find(line => line.ratio === ratio)!.price
const input = (startPrice: string, endPrice: string, extra = {}) => ({ startPrice, endPrice, ext: [1.272, 1.382, 1.618], ...extra })

describe('斐波那契计算', () => {
  it('上涨波段：回撤与延长位', () => {
    const { fib } = parseFib(input('10', '20'))
    expect(price(fib, 0.618)).toBeCloseTo(13.82, 6)
    expect(price(fib, 0.5)).toBeCloseTo(15, 6)
    expect(price(fib, 1.272)).toBeCloseTo(22.72, 6)
    expect(price(fib, 1.618)).toBeCloseTo(26.18, 6)
  })

  it('下跌波段：同一公式，延长线在终点之下', () => {
    const { fib } = parseFib(input('20', '10'))
    expect(price(fib, 0.618)).toBeCloseTo(16.18, 6)
    expect(price(fib, 1.272)).toBeCloseTo(7.28, 6)
  })

  it('延长线可单独关闭，回撤位始终保留；价格非正的延长位丢弃', () => {
    const { fib } = parseFib(input('10', '20', { ext: [1.272, 1.618] }))
    const lines = fibLines(fib!)
    expect(lines.filter(line => line.kind === 'retr')).toHaveLength(5)
    expect(lines.filter(line => line.kind === 'ext').map(line => line.ratio)).toEqual([1.272, 1.618])
    expect(fibLines(parseFib(input('20', '5')).fib!).every(line => line.price > 0)).toBe(true)
  })

  it('无效输入给出错误', () => {
    expect(parseFib(input('10', '10')).error).toMatch(/不能相同/)
    expect(parseFib(input('0', '10')).error).toMatch(/大于 0/)
    expect(parseFib(input('10', '')).error).toMatch(/同时填写/)
    expect(parseFib(input('10', '20', { startDate: '2026/1/1' })).error).toMatch(/日期格式/)
    expect(parseFib(input('', '')).fib).toBeUndefined()
  })

  it('云端数据容错：旧记录无字段、结构不对都按未设置', () => {
    expect(normalizeFib(undefined)).toBeUndefined()
    expect(normalizeFib({ start: { price: 10 }, end: { price: 10 } })).toBeUndefined()
    expect(normalizeFib({ start: { price: 10, date: '2026-01-02' }, end: { price: 20 }, ext: [1.618, 9] })).toEqual({ start: { price: 10, date: '2026-01-02' }, end: { price: 20 }, ext: [1.618] })
    expect(normalizeView({ levels: false, fib: 'x' })).toEqual({ levels: false })
    expect(normalizeView({})).toBeUndefined()
  })
})

// 构造 n 根日线：最低价 low、最高价 high 取自指定位置，其余是价格为 base 的平盘；日期只需互不相同。
const bars = (n: number, base: number, spikes: Record<number, { high?: number; low?: number }> = {}): Candle[] =>
  Array.from({ length: n }, (_, i) => ({ date: `d${String(i).padStart(3, '0')}`, open: base, close: base, high: spikes[i]?.high ?? base, low: spikes[i]?.low ?? base }))

describe('自动设置', () => {
  it('30 日内振幅够大就选 30 日窗口，先低后高为上涨波段', () => {
    const candles = bars(300, 10, { 275: { low: 9 }, 290: { high: 11 } })
    const fib = autoFib(candles)!
    expect(fib.lookback).toBe(30)
    expect(fib.start.price).toBe(9)
    expect(fib.end.price).toBe(11)
    expect(fib.start.date).toBe(candles[275].date)
  })

  it('先高后低为下跌波段', () => {
    const fib = autoFib(bars(300, 10, { 275: { high: 11 }, 290: { low: 9 } }))!
    expect(fib.start.price).toBe(11)
    expect(fib.end.price).toBe(9)
  })

  it('短窗口振幅不足时扩大到 90 日', () => {
    const fib = autoFib(bars(300, 10, { 205: { low: 9 }, 250: { high: 10.5 } }))!
    // 30/60 日窗口内是平盘（无法形成高低点），90 日窗口振幅 > 10%：高点需够高
    expect(fib.lookback).toBeGreaterThanOrEqual(90)
  })

  it('所有窗口都不足 10% 时取振幅最大的', () => {
    const fib = autoFib(bars(300, 10, { 100: { low: 9.7 }, 150: { high: 10.1 }, 280: { low: 9.95 }, 290: { high: 10.02 } }))!
    expect(fib.lookback).toBe(250)
  })

  it('数据不足时返回 undefined 或用全部数据', () => {
    expect(autoFib([])).toBeUndefined()
    expect(autoFib(bars(1, 10))).toBeUndefined()
    expect(autoFib(bars(10, 10, { 2: { low: 8 }, 7: { high: 12 } }))!.lookback).toBe(10)
  })
})

describe('多组斐波那契', () => {
  const fib = { start: { price: 10 }, end: { price: 20 }, ext: [1.272] }
  it('早期单组字段按一组「斐波那契 1」读取', () => {
    expect(normalizeFibSets({ fib })).toEqual([{ id: 'fib-1', name: '斐波那契 1', fib }])
    expect(normalizeFibSets({})).toEqual([])
  })

  it('多组：丢弃无效、重复 id，补默认名称，超出 8 组截断', () => {
    const sets = normalizeFibSets({ fibs: [{ id: 'a', name: ' 上涨波段 ', fib }, { id: 'a', name: '重复', fib }, { id: 'b', name: '', fib }, { id: 'c', name: 'x', fib: { start: { price: 5 }, end: { price: 5 } } }, { name: '无 id', fib }] })
    expect(sets.map(item => item.name)).toEqual(['上涨波段', '斐波那契 2'])
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `n${i}`, fib }))
    expect(normalizeFibSets({ fibs: many })).toHaveLength(8)
  })

  it('有 fibs 字段时忽略旧的单组字段', () => {
    expect(normalizeFibSets({ fibs: [], fib })).toEqual([])
  })

  it('显示开关保留选中的组 id', () => {
    expect(normalizeView({ fibActive: 'a', fib: true })).toEqual({ fib: true, fibActive: 'a' })
  })
})

describe('按日期自动取高低点', () => {
  const day = (date: string, low: number, high: number): Candle => ({ date, open: low, close: high, low, high })
  const candles = [day('2026-01-05', 10, 12), day('2026-01-06', 14, 16), day('2026-01-07', 11, 13), day('2026-01-09', 18, 22), day('2026-01-12', 12, 14)]

  it('先低后高：起点取低点的最低价，终点取高点的最高价', () => {
    const { fib } = fibFromDates(candles, '2026-01-05', '2026-01-09')
    expect(fib!.start).toEqual({ price: 10, date: '2026-01-05' })
    expect(fib!.end).toEqual({ price: 22, date: '2026-01-09' })
  })

  it('先高后低：起点取高点的最高价，终点取低点的最低价', () => {
    const { fib } = fibFromDates(candles, '2026-01-09', '2026-01-12')
    expect(fib!.start).toEqual({ price: 22, date: '2026-01-09' })
    expect(fib!.end).toEqual({ price: 12, date: '2026-01-12' })
  })

  it('日期顺序填反也按时间先后确定起点终点', () => {
    const { fib } = fibFromDates(candles, '2026-01-09', '2026-01-05')
    expect(fib!.start.date).toBe('2026-01-05')
    expect(fib!.end.date).toBe('2026-01-09')
  })

  it('非交易日取之前最近的交易日', () => {
    const { fib } = fibFromDates(candles, '2026-01-05', '2026-01-10') // 1/10 休市 → 1/9
    expect(fib!.end.date).toBe('2026-01-09')
  })

  it('错误情形：同一天、同一交易日、早于第一根、格式错误、高低位置相同', () => {
    expect(fibFromDates(candles, '2026-01-05', '2026-01-05').error).toMatch(/同一天/)
    expect(fibFromDates(candles, '2026-01-09', '2026-01-10').error).toMatch(/同一个交易日/)
    expect(fibFromDates(candles, '2025-12-01', '2026-01-09').error).toMatch(/早于/)
    expect(fibFromDates(candles, '2026/01/05', '2026-01-09').error).toMatch(/日期格式/)
    expect(fibFromDates([day('2026-01-05', 10, 12), day('2026-01-06', 10, 12)], '2026-01-05', '2026-01-06').error).toMatch(/无法判断/)
  })
})
