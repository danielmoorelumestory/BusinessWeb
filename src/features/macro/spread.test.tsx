import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SpreadView } from './SpreadView'
import { average, baselineReturn, buildChannel, crossings, maBacktest, movingAverage, navStats, yearlyReturns, forwardReturn, sigmaOf, touchEvents, zoneOf, type PriceRow, type SpreadRow, type SpreadSnapshot } from './spread'

const day = (i: number): string => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
const rowsOf = (spreads: number[], price = (i: number) => 100 + i): SpreadRow[] => spreads.map((s, i) => [day(i), s, price(i)])

describe('股债息差通道计算', () => {
  it('滚动均值和总体标准差只用当天及之前的数据', () => {
    const bands = buildChannel(rowsOf([1, 2, 3, 4, 5, 6]), 4, 2)
    expect(bands[0]).toBeNull()            // 不足窗口一半
    expect(bands[1]!.mid).toBeCloseTo(1.5)  // 前两个点
    expect(bands[3]!.mid).toBeCloseTo(2.5)
    expect(bands[3]!.upper).toBeCloseTo(2.5 + 2 * Math.sqrt(1.25))
    expect(bands[5]!.mid).toBeCloseTo(4.5)  // 只看最近 4 个点：3,4,5,6
    expect(bands[5]!.lower).toBeCloseTo(4.5 - 2 * Math.sqrt(1.25))
  })

  it('区间判定与偏离倍数', () => {
    const band = { mid: 5, upper: 7, lower: 3 }
    expect(zoneOf(7, band)).toBe('upper')
    expect(zoneOf(2.9, band)).toBe('lower')
    expect(zoneOf(5.5, band)).toBe('above')
    expect(zoneOf(4, band)).toBe('below')
    expect(sigmaOf(6, band, 2)).toBeCloseTo(1)
  })

  it('连续触轨合并成一次，隔得够久才算新的一次', () => {
    const spreads = Array.from({ length: 60 }, () => 5)
    ;[10, 11, 13, 45].forEach(i => { spreads[i] = 9 })
    const rows = rowsOf(spreads)
    const bands = rows.map(() => ({ mid: 5, upper: 7, lower: 3 }))
    expect(touchEvents(rows, bands, 'upper', 20)).toEqual([10, 45])
    expect(touchEvents(rows, bands, 'lower', 20)).toEqual([])
  })

  it('之后涨跌、基准和平均', () => {
    const rows = rowsOf([1, 1, 1, 1, 1], i => 100 * 1.1 ** i)
    expect(forwardReturn(rows, 0, 2)).toBeCloseTo(21)
    expect(forwardReturn(rows, 3, 2)).toBeUndefined()
    expect(baselineReturn(rows, 0, 1)).toBeCloseTo(10)
    expect(average([10, undefined, 20])).toBeCloseTo(15)
    expect(average([undefined])).toBeUndefined()
  })
})

describe('股债息差视图', () => {
  // 前 40 天平稳小幅波动，第 40 天息差跳高触及上轨
  const spreads = Array.from({ length: 60 }, (_, i) => 5 + (i % 2 ? 0.1 : -0.1))
  spreads[40] = 8
  const data: SpreadSnapshot = { generatedAt: '2026-11-10', source: '测试源', window: 20, k: 2, rows: rowsOf(spreads) }

  it('显示当前位置、图和历次触轨表', () => {
    render(<SpreadView data={data} />)
    expect(screen.getByLabelText('当前位置').textContent).toContain('截至 2020-02-29')
    expect(screen.getByLabelText('当前位置').textContent).toContain('上轨')
    expect(screen.getByRole('img', { name: /股债息差 2020 年至今走势/ })).toBeTruthy()
    expect(screen.getByLabelText('历次触及上轨').textContent).toContain('2020-02-10')
    expect(screen.getByLabelText('历次跌破下轨').textContent).toContain('平时任意一天')
    expect(screen.getByText(/不做预测/)).toBeTruthy()
  })

  it('切换时间范围', () => {
    render(<SpreadView data={data} />)
    const all = screen.getByRole('button', { name: '全部' })
    fireEvent.click(all)
    expect(all.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '3 年' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('数据太少时给出提示', () => {
    render(<SpreadView data={{ ...data, window: 750, rows: data.rows.slice(0, 5) }} />)
    expect(screen.getByRole('alert').textContent).toContain('数据不足')
  })
})

describe('股债息差视图：多个指数', () => {
  const spreads = Array.from({ length: 60 }, (_, i) => 5 + (i % 2 ? 0.1 : -0.1))
  const base: SpreadSnapshot = { generatedAt: '2026-11-10', source: '测试源', window: 20, k: 2, rows: rowsOf(spreads) }

  it('没有其他指数时不显示切换按钮', () => {
    render(<SpreadView data={base} />)
    expect(screen.queryByRole('group', { name: '选择指数' })).toBeNull()
  })

  it('切换到其他指数后显示该指数的名称、说明和空表提示', () => {
    render(<SpreadView data={{ ...base, extra: [{ id: 'csi1000', name: '中证1000', note: '月度数据推算', rows: rowsOf(spreads, i => 6000 + i) }] }} />)
    expect(screen.getByLabelText('当前位置').textContent).toContain('沪深300')
    fireEvent.click(screen.getByRole('button', { name: '中证1000' }))
    expect(screen.getByLabelText('当前位置').textContent).toContain('中证1000')
    expect(screen.getByText('月度数据推算')).toBeTruthy()
    expect(screen.getByLabelText('历次触及上轨').textContent).toContain('有数据以来没有出现过')
  })

  it('同一指数有两种口径时并排显示当前读数', () => {
    render(<SpreadView data={{ ...base, extra: [{ id: 'csi300-median', name: '沪深300', label: '沪深300（中位数）', note: '中位数说明', rows: rowsOf(spreads.map(v => v - 2)) }] }} />)
    const card = screen.getByLabelText('两种口径并排')
    expect(card.textContent).toContain('沪深300（市值加权）')
    expect(card.textContent).toContain('沪深300（中位数）')
    fireEvent.click(screen.getByRole('button', { name: '沪深300（中位数）' }))
    expect(screen.getByLabelText('当前位置').textContent).toContain('沪深300（中位数） 盈利收益率')
    expect(screen.getByText('中位数说明')).toBeTruthy()
  })
})

describe('200 日均线', () => {
  it('均线含当天，不足天数时不给值', () => {
    const ma = movingAverage(rowsOf([1, 1, 1, 1], i => [10, 20, 30, 40][i]), 3)
    expect(ma[1]).toBeUndefined()
    expect(ma[2]).toBeCloseTo(20)
    expect(ma[3]).toBeCloseTo(30)
  })

  it('数据够 200 天时显示趋势状态', () => {
    const spreads = Array.from({ length: 260 }, (_, i) => 5 + (i % 2 ? 0.1 : -0.1))
    render(<SpreadView data={{ generatedAt: '2026-11-10', source: '测试源', window: 20, k: 2, rows: rowsOf(spreads) }} />)
    expect(screen.getByLabelText('当前位置').textContent).toContain('在 200 日均线上方')
  })
})

describe('10 日均线穿越点', () => {
  it('从线下到线上算站上，从线上到线下算跌破，均线没值的日子不算', () => {
    const px = [10, 10, 10, 13, 14, 9, 8, 12]
    const rows = rowsOf(px.map(() => 1), i => px[i])
    const ma = movingAverage(rows, 3)
    expect(crossings(rows, ma)).toEqual({ up: [3, 7], down: [5] })
  })
})

describe('10 日线规则回测', () => {
  const px = (closes: number[], opens?: number[]): PriceRow[] => closes.map((c, i) => [day(i), opens?.[i] ?? c, c])

  it('信号日的下一天开盘成交，买入当天只算开盘到收盘，卖出当天只算昨收到开盘', () => {
    const rows = px([10, 10, 12, 13, 9, 8], [10, 10, 11, 12.5, 12, 8.5])
    const bt = maBacktest(rows, day(1), 2, 0)
    // 第 2 天收盘站上，第 3 天开盘买；第 4 天收盘跌破，第 5 天开盘卖
    expect(bt.trades).toHaveLength(1)
    expect(bt.trades[0].buy).toBe(3)
    expect(bt.trades[0].sell).toBe(5)
    expect(bt.trades[0].ret).toBeCloseTo(8.5 / 12.5 - 1, 10)
    expect(bt.nav[2]).toBe(1)
    expect(bt.nav[3]).toBeCloseTo(13 / 12.5, 10)
    expect(bt.nav[5]).toBeCloseTo(8.5 / 12.5, 10)
  })

  it('买卖各扣一次费用', () => {
    const rows = px([10, 10, 12, 13, 9, 8], [10, 10, 11, 12.5, 12, 8.5])
    const bt = maBacktest(rows, day(1), 2, 0.001)
    expect(bt.nav[5]).toBeCloseTo((8.5 / 12.5) * 0.999 * 0.999, 10)
    expect(bt.trades[0].ret).toBeCloseTo((8.5 / 12.5) * 0.999 * 0.999 - 1, 10)
  })

  it('最新一天的信号还没成交时，规则状态和实际持仓不同', () => {
    const bt = maBacktest(px([10, 10, 10, 12]), day(1), 2, 0)
    expect(bt.want).toBe(true)
    expect(bt.holding).toBe(false)
  })

  it('回撤把起点算进高点，逐年收益首尾相接', () => {
    const rows: PriceRow[] = [['2024-12-30', 10, 10], ['2024-12-31', 10, 8], ['2025-01-02', 8, 12]]
    const nav = [undefined, 0.8, 1.2]
    expect(navStats(rows, nav, 1).drawdown).toBeCloseTo(-0.2, 10)
    const ys = yearlyReturns(rows, nav, 1)
    expect(ys[0][1]).toBeCloseTo(-0.2, 10)
    expect(ys[1][1]).toBeCloseTo(0.5, 10)
  })

  it('有科创50 时可切换，显示买卖点和局限说明', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + 10 * Math.sin(i / 3))
    const data: SpreadSnapshot = { generatedAt: '2026-11-11', source: 't', window: 4, k: 2, rows: rowsOf([1, 2, 3, 4, 5, 6]), trend: [{ id: 'star50', name: '科创50', note: '说明文字', start: day(12), rows: px(closes) }] }
    render(<SpreadView data={data} />)
    fireEvent.click(screen.getByRole('button', { name: '科创50' }))
    expect(screen.getByRole('button', { name: '科创50' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('回测结果').textContent).toContain('10 日线规则')
    expect(screen.getByLabelText('最近的买卖').textContent).toContain('买入日')
    expect(document.body.textContent).toContain('说明文字')
  })
})
