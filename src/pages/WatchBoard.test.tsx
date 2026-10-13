import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WatchBoard from './WatchBoard'
import { moodOf } from '../features/watch/sentiment'
import { stageFromSnapshot, type MacroSnapshot } from '../features/macro/indicators'
import type { DailySnapshot } from '../features/daily-analysis/types'

const mocks = vi.hoisted(() => ({ market: vi.fn(), daily: vi.fn() }))
vi.mock('../services/api', () => ({ fetchMarketDataByType: mocks.market }))
vi.mock('../features/daily-analysis/data', () => ({ loadDailySnapshots: () => [], loadDailyAnalysis: mocks.daily }))

const series = (value: number, date = '2026-10-08') => ({ unit: '', latest: { date, value }, history: [] })
const macro = {
  generatedAt: '2026-10-08', source: 'test',
  series: { sahm: series(0.1), claims: series(220), hy: series(300), vix: series(15), dd: series(-3), kre: series(-5), tenYear: series(4.2), dxy: series(102.4), gold: series(4143), wti: series(92.3) },
}
const snapshot: DailySnapshot = {
  schemaVersion: 1, dataDate: '2026-10-12', fetchedAt: '2026-10-12T08:00:00Z', session: 'closed',
  metrics: { ztCount: 46, ztOpen: 25, ztSealRate: 64.8, dtCount: 19, dtOpen: null, dtSealRate: null, volume: 15378.31, upCount: 3100, downCount: 2000, lbCount: 18, maxBoard: 10, lbRate: null },
  indices: [], upStocks: [], ladder: [], rankings: { amount: [], turnover: [] },
  flows: { inflow: [{ name: '金融行业', amount: 32.49 }, { name: '传媒娱乐', amount: 27.27 }], outflow: [{ name: '化工行业', amount: -53.9 }] },
  sources: [],
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => macro }) as unknown as Response))
  mocks.market.mockImplementation(async (type: string) => ({
    us: [{ symbol: '^GSPC', name: '标普500', price: 6500, change: 30, changePercent: 0.5 }, { symbol: '^VIX', name: 'VIX恐慌', price: 15, change: -1, changePercent: -6.2 }],
    cn: [{ symbol: 'sh000001', name: '上证指数', price: 3800, change: -20, changePercent: -0.52 }],
  } as Record<string, unknown[]>)[type] ?? [])
  mocks.daily.mockResolvedValue({ snapshots: [snapshot], liveError: null })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('观察盘', () => {
  it('一页显示宏观阶段、全球市场、A股情绪三块，各自链接到细节页', async () => {
    render(<MemoryRouter><WatchBoard /></MemoryRouter>)
    const macroBlock = await screen.findByRole('region', { name: '宏观阶段' })
    const expected = stageFromSnapshot(macro as unknown as MacroSnapshot).stage.name
    await waitFor(() => expect(within(macroBlock).getByText(expected)).toBeTruthy())
    expect(within(macroBlock).getByText('10 年美债')).toBeTruthy()
    expect(within(macroBlock).getByRole('link', { name: /宏观温度/ }).getAttribute('href')).toBe('/monitor')

    const markets = screen.getByRole('region', { name: '全球市场' })
    await waitFor(() => expect(within(markets).getByText('标普500')).toBeTruthy())
    expect(within(markets).getByText('+0.50%').className).toContain('is-green') // 美股绿涨
    expect(within(markets).getByText('-0.52%').className).toContain('is-green') // A股绿跌
    expect(within(markets).getByRole('link', { name: /热力图与走势/ }).getAttribute('href')).toBe('/pulse')

    const ashare = screen.getByRole('region', { name: 'A股情绪' })
    await waitFor(() => expect(within(ashare).getByText('交易日 2026-10-12')).toBeTruthy())
    expect(within(ashare).getByText('中性')).toBeTruthy()
    expect(within(ashare).getByText('金融行业')).toBeTruthy()
    expect(within(ashare).getByText('1.54 万亿')).toBeTruthy()
    for (const [name, href] of [[/每日复盘/, '/daily-analysis'], [/板块轮动/, '/sector-rotation'], [/涨停板块/, '/limit-up-analysis']] as const) {
      expect(within(ashare).getByRole('link', { name }).getAttribute('href')).toBe(href)
    }
  })

  it('刷新重新拉取行情与复盘', async () => {
    render(<MemoryRouter><WatchBoard /></MemoryRouter>)
    const button = await screen.findByRole('button', { name: '刷新' })
    const calls = mocks.market.mock.calls.length
    fireEvent.click(button)
    await waitFor(() => expect(mocks.market.mock.calls.length).toBeGreaterThan(calls))
    expect(mocks.daily).toHaveBeenCalledTimes(2)
  })

  it('行情接口失败时各块分别提示，不影响其他块', async () => {
    mocks.market.mockRejectedValue(new Error('down'))
    render(<MemoryRouter><WatchBoard /></MemoryRouter>)
    const markets = screen.getByRole('region', { name: '全球市场' })
    await waitFor(() => expect(within(markets).getAllByText(/暂未取得/).length).toBeGreaterThan(0))
    expect(await screen.findByText('金融行业')).toBeTruthy()
  })

  it('行情失败时：A股退回复盘快照的指数，其他组用上次成功的缓存并标出时间', async () => {
    localStorage.setItem('watch-quotes', JSON.stringify({ us: { at: '09:30', rows: [{ symbol: '^GSPC', name: '标普500', price: 6400, changePercent: 1.2 }] } }))
    mocks.market.mockRejectedValue(new Error('down'))
    mocks.daily.mockResolvedValue({ snapshots: [{ ...snapshot, indices: [{ symbol: 'sh000001', code: '000001', name: '上证指数', date: '2026-10-12', price: 3797.24, change: -0.43 }] }], liveError: null })
    render(<MemoryRouter><WatchBoard /></MemoryRouter>)
    const markets = screen.getByRole('region', { name: '全球市场' })
    await waitFor(() => expect(within(markets).getByText('上证指数')).toBeTruthy())
    expect(within(markets).getByText(/复盘快照 10-12/)).toBeTruthy()
    expect(within(markets).getByText('+1.20%')).toBeTruthy()
    expect(within(markets).getByText(/缓存 09:30/)).toBeTruthy()
  })
})

describe('moodOf', () => {
  const base = snapshot.metrics
  it('按上涨家数占比分档', () => {
    expect(moodOf({ ...base, upCount: 4000, downCount: 1000, ztCount: 90 }).mood).toBe('偏热')
    expect(moodOf({ ...base, upCount: 1000, downCount: 4000 }).mood).toBe('偏冷')
    expect(moodOf(base).mood).toBe('中性')
  })
  it('缺家数时用涨停跌停对比；都缺就说数据不足', () => {
    expect(moodOf({ ...base, upCount: null, downCount: null, ztCount: 100, dtCount: 5 }).mood).toBe('偏热')
    expect(moodOf({ ...base, upCount: null, downCount: null, ztCount: 20, dtCount: 40 }).mood).toBe('偏冷')
    expect(moodOf({ ...base, upCount: null, downCount: null, ztCount: null, dtCount: null }).mood).toBe('数据不足')
  })
})

describe('观察盘：风险信号与期权情绪', () => {
  it('宏观块显示六项信号灯，并带上期权情绪摘要', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => ({ ok: true, json: async () => (String(u).includes('/api/sentiment') ? { equityPC: 0.58, spxPC: 1.15, pcDate: '2026-10-09', vix: 15.6, vix3m: 18.1, gexBn: 7.7, goldSilver: 67.7 } : macro) }) as unknown as Response))
    render(<MemoryRouter><WatchBoard /></MemoryRouter>)
    const macroBlock = await screen.findByRole('region', { name: '宏观阶段' })
    const list = await within(macroBlock).findByRole('list', { name: '六项风险信号' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(await within(macroBlock).findByText('VIX 期限')).toBeTruthy()
    expect(within(macroBlock).getByText('正常')).toBeTruthy()
  })
})
