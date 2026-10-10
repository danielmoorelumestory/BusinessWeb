import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { INDICATORS, type SeriesData } from './indicators'
import { CN_INDICATORS } from './china'
import CrisisReference from './CrisisReference'

afterEach(cleanup)
const data = (long?: [string, number][]): SeriesData => ({
  unit: '%', latest: { date: '2026-08-01', value: 4.5 }, history: [], long,
})

describe('危机参考读数', () => {
  it('按指定月份取真实历史读数，缺月不拿相邻月份冒充，零值仍显示', () => {
    render(<CrisisReference ind={INDICATORS.find(i => i.key === 'marginGdp')!} d={data([
      ['2000-03-01', 3], ['2007-09-01', 9], ['2020-03-01', 0],
    ])} />)
    const table = screen.getByRole('table')
    const bubble = within(table).getByRole('row', { name: /互联网泡沫.*2000-03/ })
    expect(bubble.textContent).toContain('3.00%')
    const missing = within(table).getByRole('row', { name: /金融危机.*2007-10/ })
    expect(missing.textContent).toContain('暂无该月数据')
    expect(missing.textContent).not.toContain('9.00%')
    expect(within(table).getByRole('row', { name: /疫情冲击.*2020-03/ }).textContent).toContain('0.00%')
    expect(screen.getByRole('link', { name: 'FINRA 保证金统计' }).getAttribute('href')).toContain('finra.org')
  })

  it('A 股使用月末观测且与美国同名 GDP 指标分开', () => {
    render(<CrisisReference ind={CN_INDICATORS.find(i => i.key === 'marginGdp')!} d={data([
      ['2015-06-30', 3.01], ['2016-01-29', 1.29],
    ])} />)
    expect(screen.getByRole('row', { name: /2015 年去杠杆.*2015-06/ }).textContent).toContain('3.01%')
    expect(screen.getByRole('row', { name: /2016 年熔断.*2016-01/ }).textContent).toContain('1.29%')
    expect(screen.queryByText('互联网泡沫')).toBeNull()
  })

  it('无长历史仍显示缺失状态，非杠杆指标不显示参考表', () => {
    const { rerender } = render(<CrisisReference ind={INDICATORS.find(i => i.key === 'cashDebt')!} d={data()} />)
    expect(screen.getAllByText('暂无该月数据').length).toBeGreaterThan(0)
    rerender(<CrisisReference ind={INDICATORS.find(i => i.key === 'vix')!} d={data()} />)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('长历史从 1997 年开始时仍可从档案对照黑色星期一，现金与债务用同月数值', () => {
    const { rerender } = render(<CrisisReference ind={INDICATORS.find(i => i.key === 'cashDebt')!} d={data([
      ['1997-10-01', 59.7], ['1998-09-01', 71.9],
    ])} />)
    expect(screen.getByRole('row', { name: /黑色星期一.*1987-09/ }).textContent).toContain('45.7%')
    expect(screen.getByRole('row', { name: /黑色星期一.*1987-10\s/ }).textContent).toContain('70.2%')
    expect(screen.getByRole('row', { name: /1973–1974 年熊市.*1973-01/ }).textContent).toContain('28.8%')
    expect(screen.getByRole('row', { name: /1973–1974 年熊市.*1974-10/ }).textContent).toContain('45.3%')
    expect(screen.getByRole('row', { name: /亚洲金融危机.*1997-10/ }).textContent).toContain('59.7%')
    expect(screen.getByRole('row', { name: /LTCM.*1998-09/ }).textContent).toContain('71.9%')
    rerender(<CrisisReference ind={INDICATORS.find(i => i.key === 'marginGdp')!} d={data()} />)
    const before = screen.getByRole('row', { name: /黑色星期一.*1987-09/ })
    expect(before.textContent).toContain('0.90%')
    expect(before.textContent).toContain('441.70 亿美元')
    expect(before.textContent).toContain('4.88 万亿美元')
    expect(within(before).getByRole('link').getAttribute('href')).toContain('frb_061988.pdf#page=68')
    expect(screen.getByRole('row', { name: /黑色星期一.*1987-10\s/ }).textContent).toContain('0.76%')
    expect(screen.getByRole('row', { name: /1973–1974 年熊市.*1973-01/ }).textContent).toContain('0.58%')
    expect(screen.getByRole('row', { name: /1973–1974 年熊市.*1974-10/ }).textContent).toContain('0.26%')
  })

  it('1929 年显示可核实的经纪商借款金额，不冒充客户现金或保证金债务比例', () => {
    render(<CrisisReference ind={INDICATORS.find(i => i.key === 'cashDebt')!} d={data([
      ['1929-09-01', 99],
    ])} />)
    const before = screen.getByRole('row', { name: /1929 年大崩盘.*1929-09/ })
    expect(before.textContent).toContain('85.49 亿美元')
    expect(before.textContent).toContain('无可比比例')
    expect(before.textContent).not.toContain('99.0%')
    expect(screen.getByRole('row', { name: /1929 年大崩盘.*1929-10/ }).textContent).toContain('61.09 亿美元')
    expect(screen.getByText(/经纪商自身的抵押借款/)).toBeTruthy()
  })
})
