import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DailyAnalysis from './DailyAnalysis'
import { dailySnapshot } from '../features/daily-analysis/fixtures'

vi.mock('../components/pulse/HeatmapSection', () => ({ default: () => null }))
vi.mock('../services/api', () => ({ fetchMarketDataByType: async () => [], fetchSectorCategories: async () => [], fetchUSSectorCategories: async () => [] }))

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })
const mount = () => render(<MemoryRouter><DailyAnalysis /></MemoryRouter>)
function respond(snapshot = dailySnapshot()) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('/api/daily-analysis') ? snapshot : { schemaVersion: 1, snapshots: [] }))))
}

describe('新版每日分析', () => {
  it('进入页面自动展示市场数据并链接旧版，不改写手工复盘', async () => {
    const original = JSON.stringify([{ date: '2026-09-30', ztCount: 99 }])
    localStorage.setItem('pulse_daily_reviews', original)
    respond(); mount()
    expect(await screen.findByText('2026-10-12', { selector: 'time' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /录入今日/ })).toBeNull()
    expect(within(screen.getByRole('region', { name: '涨跌停与连板' })).getByText('69')).toBeTruthy()
    expect(within(screen.getAllByRole('region', { name: '成交金额前五' })[0]).getByText('中际旭创')).toBeTruthy()
    expect(localStorage.getItem('pulse_daily_reviews')).toBe(original)
  })

  it('刷新失败保留上次行情并显示失败状态，缺失值不显示为零', async () => {
    respond(); mount()
    await screen.findByText('2026-10-12', { selector: 'time' })
    await waitFor(() => expect(screen.getByRole('button', { name: /刷新数据/ }).hasAttribute('disabled')).toBe(false))
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    fireEvent.click(screen.getByRole('button', { name: /刷新数据/ }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('2026-10-12', { selector: 'time' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '涨跌停与连板' })).getByText('69')).toBeTruthy()
    const rate = screen.getByText('跌停封板率').closest('div')!
    expect(rate.textContent).toContain('—')
  })

  it('可以查看自动归档的历史交易日，历史选择不会被后台刷新跳走', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('/api/daily-analysis') ? dailySnapshot() : { schemaVersion: 1, snapshots: [dailySnapshot('2026-10-09')] }))))
    mount()
    await screen.findByRole('option', { name: /2026-10-09/ })
    fireEvent.change(screen.getByRole('combobox', { name: '查看交易日' }), { target: { value: '2026-10-09' } })
    expect(screen.getByText('2026-10-09', { selector: 'time' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /刷新数据/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /刷新数据/ }).hasAttribute('disabled')).toBe(false))
    expect(screen.getByText('2026-10-09', { selector: 'time' })).toBeTruthy()
  })

  it('全无数据时显示可重试状态，不呈现一整页假零值', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    mount()
    expect(await screen.findByText('暂未取得复盘数据')).toBeTruthy()
    expect(screen.getByRole('button', { name: /刷新数据/ })).toBeTruthy()
    expect(screen.queryByRole('region', { name: '涨跌停与连板' })).toBeNull()
  })

  it('超时后恢复刷新按钮，不会永久停留在加载状态', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })))
    mount()
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: /刷新数据/ }).hasAttribute('disabled')).toBe(false)
  })

  it('实时接口超时时仍加载已成功下载的静态历史快照', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((url: string, options: RequestInit) => {
      if (!String(url).includes('/api/daily-analysis')) return Promise.resolve(new Response(JSON.stringify({ schemaVersion: 1, snapshots: [dailySnapshot('2026-10-09')] })))
      return new Promise((_resolve, reject) => options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
    }))
    mount()
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(screen.getByText('2026-10-09', { selector: 'time' })).toBeTruthy()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: /刷新数据/ }).hasAttribute('disabled')).toBe(false)
  })

  it('部分行情源失败时保留同日已取得的完整数据，并提示失败', async () => {
    respond(); mount()
    await screen.findByText('2026-10-12', { selector: 'time' })
    await waitFor(() => expect(screen.getByRole('button', { name: /刷新数据/ }).hasAttribute('disabled')).toBe(false))
    const partial = dailySnapshot()
    partial.fetchedAt = '2026-10-12T09:30:00.000Z'
    partial.metrics.ztCount = null
    partial.upStocks = []; partial.ladder = []
    partial.sources.find(source => source.id === 'limitUp')!.status = 'unavailable'
    partial.sources.find(source => source.id === 'turnoverRank')!.status = 'ready'
    respond(partial)
    fireEvent.click(screen.getByRole('button', { name: /刷新数据/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /刷新数据/ }).hasAttribute('disabled')).toBe(false))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '涨跌停与连板' })).getByText('69')).toBeTruthy()
  })

  it('开盘前的上一交易日快照不会阻止开盘后的自动刷新', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T01:14:00.000Z'))
    const previous = dailySnapshot('2026-10-09'); previous.session = 'previous'
    respond(previous); mount()
    await act(() => vi.advanceTimersByTimeAsync(0))
    const initial = vi.mocked(fetch).mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(120000))
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(initial)
  })
})
