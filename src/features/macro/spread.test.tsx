import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SpreadView } from './SpreadView'
import { average, baselineReturn, buildChannel, forwardReturn, sigmaOf, touchEvents, zoneOf, type SpreadRow, type SpreadSnapshot } from './spread'

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
    expect(screen.getByRole('button', { name: '5 年' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('数据太少时给出提示', () => {
    render(<SpreadView data={{ ...data, window: 750, rows: data.rows.slice(0, 5) }} />)
    expect(screen.getByRole('alert').textContent).toContain('数据不足')
  })
})
