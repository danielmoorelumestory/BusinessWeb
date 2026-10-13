// @ts-ignore 测试在 Node 中运行
import { readFileSync } from 'node:fs'
// @ts-ignore
import { resolve } from 'node:path'
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import NationalTeam from '../../pages/NationalTeam'
import { changeRate, formatChange, formatShares, formatYuan, shortPeriod } from './format'
import type { NtMeta, StockRow } from './types'

const read = <T,>(file: string): T => JSON.parse(readFileSync(resolve('public/data/national-team', file), 'utf8')) as T
const meta = read<NtMeta>('meta.json')
const stocks = read<StockRow[]>('stocks.json')

beforeAll(() => {
  vi.stubGlobal('scrollTo', () => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const file = String(url).split('/data/national-team/')[1]
    return { ok: true, json: async () => read(file) } as Response
  }))
})
afterEach(() => cleanup())
const renderAt = (path = '/invest/national-team') => render(<MemoryRouter initialEntries={[path]}><NationalTeam /></MemoryRouter>)

describe('格式化', () => {
  it('金额、股数、变化率', () => {
    expect(formatYuan(5.6e12)).toBe('5.60 万亿')
    expect(formatYuan(2.5e10)).toBe('250 亿')
    expect(formatYuan(3.4e8)).toBe('3.4 亿')
    expect(formatYuan(null)).toBe('—')
    expect(formatShares(2.5e8)).toBe('2.50 亿股')
    expect(formatChange(changeRate(120, 100))).toBe('+20.0%')
    expect(formatChange(changeRate(80, 100))).toBe('-20.0%')
    expect(formatChange(changeRate(5, null))).toBe('—')
    expect(shortPeriod('2026-06-30')).toBe('26H1')
  })
})

describe('已发布数据自洽', () => {
  it('个股数与总市值与 meta 一致，机构组都在定义里', () => {
    expect(stocks.length).toBe(meta.numStocks)
    const sum = stocks.reduce((a, s) => a + s.mv, 0)
    expect(Math.abs(sum - meta.totalMv) / meta.totalMv).toBeLessThan(0.0001)
    const defs = new Set(meta.groupDefs.map(g => g.id))
    for (const s of stocks) for (const g of s.groups) expect(defs.has(g), s.c).toBe(true)
  })

  it('不含已知误伤的持有人（中证金融类产品、同名私募等）', () => {
    const bad = /中证金融|证金私客|国新宏盛|徐国新|致衍梧桐树|博海汇金|嘉实中证/
    for (const s of stocks) for (const h of s.holders) expect(bad.test(h.h), `${s.c} ${h.h}`).toBe(false)
  })

  it('个股市值等于各持有人市值之和', () => {
    for (const s of stocks.slice(0, 200)) {
      const sum = s.holders.reduce((a, h) => a + h.mv, 0)
      expect(Math.abs(sum - s.mv), s.c).toBeLessThanOrEqual(2)
    }
  })

  it('报告期升序且最新期是 meta.reportDate', () => {
    expect([...meta.periods].sort()).toEqual(meta.periods)
    expect(meta.periods[meta.periods.length - 1]).toBe(meta.reportDate)
  })
})

describe('国家队持仓页面', () => {
  it('默认总览：报告期、关键数字、机构与行业榜', async () => {
    renderAt()
    expect(await screen.findByText(meta.reportDate)).toBeTruthy()
    const stats = await screen.findByRole('region', { name: '关键数字' })
    expect(within(stats).getByText('持仓个股')).toBeTruthy()
    expect(within(stats).getByText(`${meta.numStocks} 只`)).toBeTruthy()
    expect(await screen.findByRole('heading', { name: /按机构/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /按行业/ })).toBeTruthy()
  })

  it('个股页：搜索、按机构筛选、展开详情看到完整十大流通股东', async () => {
    const target = stocks[0]
    renderAt('/invest/national-team?tab=stocks')
    const search = await screen.findByPlaceholderText('代码或名称')
    fireEvent.change(search, { target: { value: target.c } })
    // 精确输入代码时自动展开详情（从总览榜单跳过来就是这样）
    expect(await screen.findByText('完整十大流通股东')).toBeTruthy()
    await waitFor(() => expect(document.querySelectorAll('.nt-top10 li').length).toBeGreaterThan(0))
    // 再点一次收起
    fireEvent.click(screen.getByRole('button', { name: new RegExp(target.n) }))
    await waitFor(() => expect(screen.queryByText('完整十大流通股东')).toBeNull())
    // 筛选一个不存在的行业时给出空状态
    fireEvent.change(search, { target: { value: '不存在的公司名' } })
    expect(await screen.findByText('没有符合条件的个股。')).toBeTruthy()
  })

  it('按机构筛选只留下该机构持有的个股', async () => {
    const group = meta.groups[0].id
    renderAt(`/invest/national-team?tab=stocks&g=${encodeURIComponent(group)}`)
    const expected = stocks.filter(s => s.groups.includes(group)).length
    expect(await screen.findByText(`${expected} / ${stocks.length} 只`)).toBeTruthy()
  })

  it('行业页可排序；走势页有图和数据表；说明页讲清口径', async () => {
    renderAt('/invest/national-team?tab=industries')
    expect(await screen.findByRole('columnheader', { name: /行业/ })).toBeTruthy()
    cleanup()
    renderAt('/invest/national-team?tab=trend')
    expect(await screen.findByRole('img', { name: /国家队持仓总市值走势/ })).toBeTruthy()
    cleanup()
    renderAt('/invest/national-team?tab=guide')
    expect(await screen.findByText('怎么认出「国家队」')).toBeTruthy()
    expect(screen.getByText(/下限/)).toBeTruthy()
  })
})
