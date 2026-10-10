import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { review } from '../features/pulse/fixtures'
import Pulse from './Pulse'

vi.mock('../services/api', () => ({
  fetchMarketDataByType: vi.fn(async () => []),
  fetchSectorCategories: vi.fn(async () => []),
  fetchUSSectorCategories: vi.fn(async () => []),
}))
vi.mock('../components/pulse/HeatmapSection', () => ({ default: () => null }))
vi.mock('../components/pulse/SectorSection', () => ({ SectorSection: () => null }))
vi.mock('../components/pulse/NewsSourceSection', () => ({ NewsSourceSection: () => null }))

beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 }))) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear() })

describe('经济脉搏：每日复盘本地增删与云同步入口', () => {
  it('不再连接 GitHub Gist，并清理旧版遗留的 token', async () => {
    localStorage.setItem('pulse_gist_token', 'ghp_old'); localStorage.setItem('pulse_gist_id', 'abc')
    render(<Pulse />)
    await waitFor(() => expect(localStorage.getItem('pulse_gist_token')).toBeNull())
    expect(localStorage.getItem('pulse_gist_id')).toBeNull()
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(c => String(c[0]).includes('api.github.com'))).toBe(false)
  })

  it('删除一天复盘会写入墓碑；取消确认则不删除', async () => {
    localStorage.setItem('pulse_daily_reviews', JSON.stringify([review('2026-09-30'), review('2026-09-29')]))
    render(<Pulse />)
    expect(screen.queryByRole('button', { name: /删除/ })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '每日分析' }))
    const buttons = await screen.findAllByRole('button', { name: /删除/ })
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    fireEvent.click(buttons[0])
    expect(JSON.parse(localStorage.getItem('pulse_daily_reviews')!)).toHaveLength(2)
    expect(localStorage.getItem('pulse_review_tombstones')).toBeNull()
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    fireEvent.click(screen.getAllByRole('button', { name: /删除/ })[0])
    expect(JSON.parse(localStorage.getItem('pulse_daily_reviews')!).map((r: { date: string }) => r.date)).toEqual(['2026-09-29'])
    expect(JSON.parse(localStorage.getItem('pulse_review_tombstones')!)).toMatchObject([{ date: '2026-09-30', deleted: true }])
    fireEvent.click(screen.getByRole('tab', { name: '市场热力图' }))
    expect(screen.queryByRole('button', { name: /删除/ })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '每日分析' }))
    expect(screen.getAllByRole('button', { name: /删除/ })).toHaveLength(1)
  })

  it('未配置时没有「同步」按钮，保存配置前会确认目标域名且 token 太短被拒绝', async () => {
    render(<Pulse />)
    fireEvent.click(screen.getByRole('tab', { name: '每日分析' }))
    await screen.findByRole('button', { name: /云端设置/ })
    expect(screen.queryByRole('button', { name: /同步$/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /云端设置/ }))
    fireEvent.change(screen.getByPlaceholderText(/pulse-sync/), { target: { value: 'https://site.example.com/api/pulse-sync' } })
    fireEvent.change(screen.getByPlaceholderText('粘贴 token'), { target: { value: 'short' } })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    const confirmSpy = vi.spyOn(window, 'confirm')
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(localStorage.getItem('pulse_sync_config')).toBeNull()
  })
})
