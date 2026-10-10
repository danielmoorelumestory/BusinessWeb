import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { statsOf, pctTone, type IndexData, type IndexSnapshot } from './valuation'
import { ValuationView } from './ValuationView'

const months = (n: number, f: (i: number) => number): [string, number][] =>
  Array.from({ length: n }, (_, i) => [`${2010 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`, f(i)])
const ix = (over: Partial<IndexData> = {}): IndexData => ({
  symbol: '^NDX', name: '纳斯达克 100', group: '美股', note: '', latest: { date: '2026-10-08', value: 90 },
  monthly: months(150, i => (i === 100 ? 120 : 50 + i / 5)), fpe: [['2026-10-01', 20.7]], ...over,
})

describe('statsOf', () => {
  it('距历史高点回撤按最高月收盘算', () => {
    expect(statsOf(ix()).drawdown).toBeCloseTo((90 / 120 - 1) * 100)
  })
  it('现价超过历史最高时回撤为 0', () => {
    expect(statsOf(ix({ latest: { date: 'x', value: 130 } })).drawdown).toBe(0)
  })
  it('Forward PE 不足 24 个月时没有分位，但有区间和中位数', () => {
    const f = statsOf(ix({ fpe: months(3, i => 20 + i) })).fpe!
    expect(f.pct).toBeUndefined()
    expect([f.min, f.max, f.median, f.count]).toEqual([20, 22, 21, 3])
  })
  it('Forward PE 满 24 个月给出分位', () => {
    expect(statsOf(ix({ fpe: months(30, i => 15 + i / 2) })).fpe!.pct).toBe(100)
  })
})

describe('pctTone', () => {
  it('分位越高越贵', () => {
    expect([pctTone(undefined), pctTone(50), pctTone(85), pctTone(97)]).toEqual(['gray', 'green', 'yellow', 'red'])
  })
})

describe('ValuationView', () => {
  const data: IndexSnapshot = { generatedAt: '2026-10-08', source: '雅虎财经；手动录入', indexes: { ndx: ix(), hsi: ix({ name: '恒生指数', group: '港股', symbol: '^HSI' }) } }
  it('按市场分组显示，点指数名展开长历史图', () => {
    render(<ValuationView data={data} />)
    expect(screen.getByRole('heading', { name: '美股' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '港股' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /纳斯达克 100/ }))
    expect(screen.getByRole('img', { name: /Forward PE/ })).toBeTruthy()
  })
})

describe('成分股', () => {
  it('展开后显示成分股 PE 和相对指数的高低', () => {
    const d: IndexSnapshot = { generatedAt: 'x', source: 'y', indexes: { sox: ix({ name: '费城半导体', agg: { date: '2026-10-08', fwd: 16.5, fwdCovered: 1, fwdCount: 2, ttm: 34, medianFwd: 27, total: 2, got: 2 }, fpe: [['2026-10-01', 16.5]],
      members: [{ code: 'NVDA', name: 'NVIDIA', mcap: 5700, fwd: 14.9, ttm: 29.9 }, { code: 'INTC', name: 'Intel', mcap: 580, fwd: 52.9, ttm: null }] }) } }
    render(<ValuationView data={d} />)
    fireEvent.click(screen.getByRole('button', { name: /费城半导体/ }))
    expect(screen.getByText('NVDA')).toBeTruthy()
    expect(screen.getByText('+221%')).toBeTruthy()
    expect(screen.getByText('亏损')).toBeTruthy()
  })
})

describe('Forward PE 表', () => {
  it('列是有 PE 的指数，行按月份倒序，缺的月份留空', async () => {
    const { fpeTable } = await import('./valuation')
    const t = fpeTable({ ndx: ix({ name: 'NDX', fpe: [['2026-08-01', 20], ['2026-09-01', 22]] }), sox: ix({ name: 'SOX', fpe: [['2026-09-01', 18]] }), spx: ix({ name: 'SPX', fpe: [] }) })
    expect(t.cols.map(c => c.label)).toEqual(['NDX', 'SOX'])
    expect(t.rows.map(r => r.month)).toEqual(['2026-09', '2026-08'])
    expect(t.rows[1].values.sox).toBeUndefined()
  })
})

describe('Forward PE 走势图', () => {
  it('把外部参考序列画成折线（不能用 ref 作属性名，会被 React 吞掉）', async () => {
    const { default: FpeChart } = await import('./FpeChart')
    const { container } = render(<FpeChart own={[['2026-10-01', 20.7]]} refPoints={[['2025-06-30', 27.6], ['2025-12-31', 27.4], ['2026-06-30', 25.2]]} refSource="Siblis" label="NDX Forward PE" />)
    expect(container.querySelectorAll('path.macro-spark__line').length).toBe(1)
    expect(container.querySelectorAll('circle').length).toBe(4)
  })
})

describe('estimateFpe / mergeLive', () => {
  const prices: [string, number][] = [['2025-01-31', 100], ['2025-02-14', 110], ['2025-03-14', 121], ['2025-04-30', 121], ['2025-05-30', 121], ['2025-06-30', 150], ['2025-07-31', 160]]
  it('锚点处等于真实读数，锚点之间逐个交易日估算，锚点范围之外不外推', async () => {
    const { estimateFpe } = await import('./valuation')
    const e = estimateFpe(prices, [['2025-01-31', 20], ['2025-06-30', 25]])
    expect(e.length).toBe(6)
    expect(e[0]).toEqual(['2025-01-31', 20])
    expect(e[5]).toEqual(['2025-06-30', 25])
    expect(e[2][1]).toBeGreaterThan(20)
  })
  it('锚点不足两个时不估算', async () => {
    const { estimateFpe } = await import('./valuation')
    expect(estimateFpe(prices, [['2025-01-31', 20]])).toEqual([])
  })
  it('刷新合并：新价格覆盖旧的，已记录的月度 PE 保留并加入当月新点', async () => {
    const { mergeLive } = await import('./valuation')
    const old: IndexSnapshot = { generatedAt: 'a', source: 's', indexes: { ndx: ix({ fpe: [['2026-09-01', 21]], ref: { source: 'r', points: [['2025-06-30', 27]] } }) } }
    const fresh: IndexSnapshot = { generatedAt: 'b', source: 's', indexes: { ndx: ix({ latest: { date: '2026-10-09', value: 99 }, fpe: [['2026-10-01', 20.5]], ref: undefined }) } }
    const m = mergeLive(old, fresh).indexes.ndx
    expect(m.latest.value).toBe(99)
    expect(m.fpe.map(p => p[1])).toEqual([21, 20.5])
    expect(m.ref?.points.length).toBe(1)
  })
})

describe('Forward PE 走势图：鼠标悬停', () => {
  it('鼠标移到图上显示最近一个点的日期和数值，移出后消失', async () => {
    const { default: FpeChart } = await import('./FpeChart')
    const pts: [string, number][] = Array.from({ length: 100 }, (_, i) => [new Date(Date.UTC(2020, 0, 1 + i * 7)).toISOString().slice(0, 10), 10 + i / 10])
    const { container } = render(<FpeChart own={[]} refPoints={pts} label="X Forward PE" />)
    const svg = container.querySelector('svg')!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 190, right: 640, bottom: 190, x: 0, y: 0, toJSON() {} })
    fireEvent.pointerMove(svg, { clientX: 640 * 0.5 })
    expect(container.querySelector('line.macro-spark__cross')).toBeTruthy()
    expect(container.textContent).toMatch(/\d{4}-\d{2}-\d{2} {2}\d+\.\dx/)
    fireEvent.pointerLeave(svg)
    expect(container.querySelector('line.macro-spark__cross')).toBeNull()
  })
})

describe('没有 PE 历史的指数', () => {
  it('只显示价格图，不显示 Forward PE 走势', () => {
    const d: IndexSnapshot = { generatedAt: 'x', source: 'y', indexes: { rut: ix({ name: '罗素 2000', fpe: [] }) } }
    const { container } = render(<ValuationView data={d} />)
    fireEvent.click(screen.getByRole('button', { name: /罗素 2000/ }))
    const heads = Array.from(container.querySelectorAll('h4')).map(h => h.textContent)
    expect(heads).toContain('价格走势（月收盘）')
    expect(heads.some(h => /PE/.test(h ?? ''))).toBe(false)
  })
})

describe('展开标记', () => {
  it('收起时箭头不旋转，展开后加 is-open，再点一次恢复', () => {
    const d: IndexSnapshot = { generatedAt: 'x', source: 'y', indexes: { rut: ix({ name: '罗素 2000' }) } }
    const { container } = render(<ValuationView data={d} />)
    const btn = screen.getByRole('button', { name: /罗素 2000/ })
    const chev = () => container.querySelector('.macro-val__chev')!
    expect(chev().classList.contains('is-open')).toBe(false)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(chev().classList.contains('is-open')).toBe(true)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(btn)
    expect(chev().classList.contains('is-open')).toBe(false)
  })
})

describe('外部链接', () => {
  it('展开后显示外部查看入口，新窗口打开', () => {
    const d: IndexSnapshot = { generatedAt: 'x', source: 'y', indexes: { rsp: ix({ name: '标普 500 等权重 SPW', fpe: [], links: [{ label: '彭博 SPW', url: 'https://www.bloomberg.com/quote/SPW:IND' }] }) } }
    render(<ValuationView data={d} />)
    fireEvent.click(screen.getByRole('button', { name: /等权重/ }))
    const a = screen.getByRole('link', { name: '彭博 SPW' }) as HTMLAnchorElement
    expect(a.href).toBe('https://www.bloomberg.com/quote/SPW:IND')
    expect(a.target).toBe('_blank')
  })
})
