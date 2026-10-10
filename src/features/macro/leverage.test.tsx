// @ts-ignore 测试在 Node 中运行
import { readFileSync } from 'node:fs'
// @ts-ignore
import { resolve } from 'node:path'
import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
// @ts-ignore 纯 JS 模块
import { gdpTtm, parseFinraMargin, ratioToGdp } from '../../../server/macro.mjs'
import Monitor from '../../pages/Monitor'
import { INDICATORS, percentileOf, toneOf, type MacroSnapshot } from './indicators'
import { CN_INDICATORS, type CnKey } from './china'
import type { HkKey } from './hk'
import { freshnessOf } from './MacroViews'

const us = JSON.parse(readFileSync(resolve('public/data/macro-us.json'), 'utf8')) as MacroSnapshot
const cn = JSON.parse(readFileSync(resolve('public/data/macro-cn.json'), 'utf8')) as MacroSnapshot<CnKey>
const hk = JSON.parse(readFileSync(resolve('public/data/macro-hk.json'), 'utf8')) as MacroSnapshot<HkKey>
const byUrl = (url: string) => (String(url).includes('macro-hk') ? hk : String(url).includes('macro-cn') ? cn : us)
beforeAll(() => {
  vi.stubGlobal('scrollTo', () => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => byUrl(url) }) as Response))
})
afterEach(() => cleanup())
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><Monitor /></MemoryRouter>)

describe('杠杆数据整理', () => {
  it('FINRA 早年缺列的行按列号读取，不丢数据', () => {
    const xml = '<row r="2"><c r="A2" t="inlineStr"><is><t>2026-08</t></is></c><c r="B2"><v>1000</v></c><c r="C2"><v>200</v></c><c r="D2"><v>100</v></c></row>'
      + '<row r="3"><c r="A3" t="inlineStr"><is><t>1997-01</t></is></c><c r="B3"><v>500</v></c><c r="C3"><v>300</v></c></row>'
      + '<row r="4"><c r="A4" t="inlineStr"><is><t>Year-Month</t></is></c></row>'
    expect(parseFinraMargin(xml)).toEqual([{ date: '1997-01-01', debit: 500, cash: 300, margin: 0 }, { date: '2026-08-01', debit: 1000, cash: 200, margin: 100 }])
  })

  it('GDP 滚动一年 = 本期累计 + 上年全年 − 上年同期累计', () => {
    const row = (d: string, v: number) => ({ REPORT_DATE: `${d} 00:00:00`, DOMESTICL_PRODUCT_BASE: v })
    const ttm = gdpTtm([row('2025-06-01', 600), row('2025-12-01', 1300), row('2026-06-01', 700)])
    expect(ttm).toEqual([['2025-12-01', 1300], ['2026-06-01', 1400]])
  })

  it('占 GDP 比例：每月取不晚于该月的最新一期 GDP', () => {
    expect(ratioToGdp([['2026-01-01', 10], ['2026-05-01', 30]], [['2025-10-01', 1000], ['2026-04-01', 1500]])).toEqual([['2026-01-01', 1], ['2026-05-01', 2]])
  })
})

describe('拥挤度打灯：按历史分位', () => {
  const long: [string, number][] = Array.from({ length: 100 }, (_, i) => [`2000-${i}`, i + 1])
  const lev = INDICATORS.find(i => i.key === 'marginGdp')!
  const cash = INDICATORS.find(i => i.key === 'cashDebt')!
  it('杠杆越高越拥挤，现金越低越拥挤；历史不足时不打分', () => {
    expect(percentileOf(long, 50)).toBe(50)
    expect([toneOf(lev, 50, long), toneOf(lev, 85, long), toneOf(lev, 97, long)]).toEqual(['green', 'yellow', 'red'])
    expect([toneOf(cash, 50, long), toneOf(cash, 15, long), toneOf(cash, 3, long)]).toEqual(['green', 'yellow', 'red'])
    expect(toneOf(lev, 97, long.slice(0, 10))).toBe('gray')
  })
})

describe('新旧数据标记', () => {
  const d = us.series.vix
  it('没刷新过是快照；刷新后按 live 区分实时与沿用旧值', () => {
    expect(freshnessOf(us, d).kind).toBe('snap')
    const refreshed = { ...us, fetchedAt: '2026-10-07T08:30:00.000Z' }
    expect(freshnessOf(refreshed, { ...d, live: true })).toMatchObject({ kind: 'live', text: '实时 08:30 UTC' })
    expect(freshnessOf(refreshed, { ...d, live: false }).kind).toBe('old')
    expect(freshnessOf(refreshed, d).kind).toBe('old')
  })

  it('页面：刷新后拉到的项标「实时」，没拉到的标「沿用旧值」，顶部给出计数', async () => {
    const fresh = { ...us, fetchedAt: '2026-10-07T08:30:00.000Z', series: { vix: { ...us.series.vix, live: true }, gdp: { ...us.series.gdp, live: false } } }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => (String(url).includes('/api/macro') ? { us: fresh, cn: { ...cn, series: {} }, warnings: ['gdp：超时'] } : byUrl(url)) }) as Response))
    renderAt('/monitor?tab=us')
    expect((await screen.findAllByText(/^快照 /)).length).toBe(INDICATORS.length)
    fireEvent.click(screen.getByRole('button', { name: '刷新最新数据' }))
    expect((await screen.findAllByText(/^实时 08:30/)).length).toBe(1)
    expect(screen.getAllByText(/^沿用旧值/).length).toBe(INDICATORS.length - 1)
    expect(screen.getByText(/1 项实时，\d+ 项沿用旧值/)).toBeTruthy()
  })
})

describe('杠杆与资金页面', () => {
  it('美国、中国都有杠杆卡：带历史分位和可切换的长历史图', async () => {
    renderAt('/monitor?tab=us')
    expect((await screen.findAllByText(/处于历史 \d+% 分位/)).length).toBe(5)
    expect(screen.getByRole('table', { name: '保证金债务 ÷ GDP危机参考读数' }).textContent).toContain('3.00%')
    expect(within(screen.getByRole('table', { name: '客户现金 ÷ 保证金债务危机参考读数' })).getByRole('row', { name: /金融危机.*2009-03/ }).textContent).toContain('143.1%')
    const tab = screen.getAllByRole('button', { name: '全部' })[0]
    fireEvent.click(tab)
    expect(tab.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByRole('img', { name: /1997年至今走势/ }).length).toBe(1)
    expect(screen.getAllByRole('img', { name: /2016年至今走势/ }).length).toBe(1)
    cleanup()
    renderAt('/monitor?tab=cn')
    expect((await screen.findAllByText(/处于历史 \d+% 分位/)).length).toBe(CN_INDICATORS.filter(i => i.crowded).length)
    expect(within(screen.getByRole('table', { name: '融资余额 ÷ GDP危机参考读数' })).getByRole('row', { name: /2015 年去杠杆.*2015-06/ }).textContent).toContain('3.01%')
    expect(within(screen.getByRole('table', { name: '融资余额 ÷ 流通市值危机参考读数' })).getByRole('row', { name: /2015 年去杠杆.*2015-06/ }).textContent).toContain('4.33%')
  })
})

describe('总览摘要：点开弹框看历史曲线', () => {
  it('杠杆行弹出长历史图，普通指标弹出近两年走势，Esc 与关闭按钮都能关', async () => {
    renderAt('/monitor')
    fireEvent.click(await screen.findByRole('button', { name: /保证金债务 ÷ GDP，点击查看历史曲线/ }))
    const dialog = screen.getByRole('dialog', { name: /保证金债务 ÷ GDP历史曲线/ })
    expect(dialog.textContent).toMatch(/处于历史 \d+% 分位/)
    expect(within(dialog).getAllByRole('img', { name: /走势/ }).length).toBe(1)
    expect(within(dialog).getByRole('table', { name: '保证金债务 ÷ GDP危机参考读数' })).toBeTruthy()
    expect(within(dialog).getByRole('row', { name: /黑色星期一.*1987-09/ }).textContent).toContain('0.90%')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /VIX 波动率，点击查看/ }))
    expect(within(screen.getByRole('dialog')).getAllByRole('img', { name: /VIX 波动率近两年走势/ }).length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('中国杠杆行同样能弹出', async () => {
    renderAt('/monitor')
    fireEvent.click(await screen.findByRole('button', { name: /融资余额 ÷ GDP，点击查看历史曲线/ }))
    expect(within(screen.getByRole('dialog')).getAllByRole('img', { name: /走势/ }).length).toBe(1)
  })
})

describe('顶部参照价格', () => {
  it('总览最上方有美元、黄金、白银、原油，点开弹框，且不计入阶段打分', async () => {
    renderAt('/monitor')
    for (const name of ['美元指数', '黄金', '白银', 'WTI 原油']) expect(await screen.findByRole('button', { name: new RegExp(`^${name}，点击查看历史曲线`) })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^黄金，点击查看/ }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toMatch(/处于历史 \d+% 分位/)
    expect(within(dialog).getAllByRole('img', { name: /走势/ }).length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(/当前阶段/)).toBeTruthy()
  })
})

describe('港股与周期页面', () => {
  it('港股宏观页按模块列出各项并带新旧标记', async () => {
    renderAt('/monitor?tab=hk')
    expect(await screen.findByText('恒生指数距十年高点回撤')).toBeTruthy()
    expect(screen.getByText('港元兑美元汇率')).toBeTruthy()
    expect(screen.getAllByText(/^快照 /).length).toBe(5)
  })

  it('周期页有四张卡，康波判断带范围、理由和反证；总览有摘要卡', async () => {
    renderAt('/monitor?tab=cycles')
    expect(await screen.findByText('康波周期（约 50–60 年）')).toBeTruthy()
    expect(screen.getAllByText(/判断理由/).length).toBe(3)
    expect(screen.getAllByText(/反证与局限/).length).toBe(3)
    expect(screen.getByText(/库存周期（基钦周期/)).toBeTruthy()
    cleanup()
    renderAt('/monitor')
    expect(await screen.findByText('周期位置（大致范围）')).toBeTruthy()
  })
})
