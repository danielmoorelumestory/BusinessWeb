// @ts-ignore 测试在 Node 中运行
import { readFileSync } from 'node:fs'
// @ts-ignore
import { resolve } from 'node:path'
import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Monitor from '../../pages/Monitor'
import { INDICATORS, toneOf } from './indicators'
import { computeStage } from './stages'
import type { MacroSnapshot } from './indicators'
import { CN_INDICATORS, type CnKey } from './china'

const snapshot = JSON.parse(readFileSync(resolve('public/data/macro-us.json'), 'utf8')) as MacroSnapshot
const cnSnapshot = JSON.parse(readFileSync(resolve('public/data/macro-cn.json'), 'utf8')) as MacroSnapshot<CnKey>
beforeAll(() => {
  vi.stubGlobal('scrollTo', () => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => (String(url).includes('macro-cn') ? cnSnapshot : snapshot) }) as Response))
})
afterEach(() => cleanup())
const renderAt = (path = '/monitor') => render(<MemoryRouter initialEntries={[path]}><Monitor /></MemoryRouter>)

describe('宏观指标规则', () => {
  it('越高越差与越低越差都能正确打灯，背景指标不打分', () => {
    const vix = INDICATORS.find(i => i.key === 'vix')!
    const gdp = INDICATORS.find(i => i.key === 'gdp')!
    const unrate = INDICATORS.find(i => i.key === 'unrate')!
    expect([toneOf(vix, 15), toneOf(vix, 22), toneOf(vix, 35)]).toEqual(['green', 'yellow', 'red'])
    expect([toneOf(gdp, 2.5), toneOf(gdp, 1), toneOf(gdp, -0.5)]).toEqual(['green', 'yellow', 'red'])
    expect(toneOf(unrate, 4.2)).toBe('gray')
  })

  it('阶段分数：多项红灯进入危机', () => {
    expect(computeStage({ sahm: 0.1, claims: 20, hy: 300, vix: 15, dd: 2 }).stage.name).toBe('常态')
    expect(computeStage({ sahm: 0.6, claims: 32, hy: 550, vix: 35, dd: 25 }).stage.name).toBe('危机')
  })

  it('中美快照覆盖所有指标且每项都有日期和走势', () => {
    for (const [set, snap] of [[INDICATORS, snapshot], [CN_INDICATORS, cnSnapshot]] as const) {
      for (const i of set) {
        const s = (snap.series as Record<string, MacroSnapshot['series']['gdp']>)[i.key]
        expect(s.latest.date, i.key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(s.history.length, i.key).toBeGreaterThan(4)
      }
    }
  })

  it('HY 利差 320bp 附近不再亮黄灯；KRE 计入阶段信号', () => {
    const hy = INDICATORS.find(i => i.key === 'hy')!
    expect(toneOf(hy, 324)).toBe('green')
    expect(toneOf(hy, 450)).toBe('yellow')
    expect(computeStage({ sahm: 0, claims: 20, hy: 324, vix: 16, dd: 1, kre: 4 }).score).toBe(2)
  })
})

describe('宏观温度页面', () => {
  it('默认显示温度总览：当前阶段、数据日期与使用原则', async () => {
    renderAt()
    const hero = await screen.findByRole('region', { name: '当前阶段' })
    expect(within(hero).getByRole('heading', { level: 2 }).textContent).toMatch(/常态|预警|防御|危机/)
    expect(screen.getByText(/美国数据更新于/)).toBeTruthy()
    expect(screen.getByText(/不做空、不加杠杆/)).toBeTruthy()
  })

  it('美国、中国宏观每项指标都有走势图和数据日期', async () => {
    renderAt('/monitor?tab=us')
    expect((await screen.findAllByRole('img', { name: /走势/ })).length).toBe(INDICATORS.length)
    cleanup()
    renderAt('/monitor?tab=cn')
    expect((await screen.findAllByRole('img', { name: /走势/ })).length).toBe(CN_INDICATORS.length)
    expect(screen.getByText(/中国数据更新于/)).toBeTruthy()
  })

  it('刷新最新数据：实时结果覆盖快照，没拉到的项沿用快照', async () => {
    const fresh = { ...snapshot, fetchedAt: '2026-10-05T11:00:00.000Z', series: { vix: { ...snapshot.series.vix, latest: { date: '2026-10-05', value: 33.3 } } } }
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => (String(url).includes('/api/macro') ? { us: fresh, cn: { ...cnSnapshot, series: {} }, warnings: ['gdp：超时'] } : String(url).includes('macro-cn') ? cnSnapshot : snapshot) }) as Response)
    vi.stubGlobal('fetch', fetcher)
    renderAt('/monitor?tab=us')
    await screen.findAllByRole('img', { name: /走势/ })
    fireEvent.click(screen.getByRole('button', { name: '刷新最新数据' }))
    expect(await screen.findByText(/已刷新：实时数据拉取于/)).toBeTruthy()
    expect(screen.getByText('33.3')).toBeTruthy()
    expect(screen.getAllByRole('img', { name: /走势/ }).length).toBe(INDICATORS.length)
    expect(screen.getByText(/1 项没拉到，沿用快照/)).toBeTruthy()
  })

  it('旧版内容收进存档并标注停用', () => {
    renderAt('/monitor')
    fireEvent.click(screen.getByRole('tab', { name: '旧版存档' }))
    expect(screen.getByRole('note').textContent).toMatch(/已停用/)
    expect(screen.getByRole('group', { name: '旧版栏目' })).toBeTruthy()
  })
})
