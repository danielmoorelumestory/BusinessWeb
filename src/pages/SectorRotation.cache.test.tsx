import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SectorRotation from './SectorRotation'
import { saveSectorView } from '../services/sectorCache'
import { shanghaiDate } from '../services/limitUp'
beforeEach(() => { sessionStorage.clear(); vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function seed() {
  saveSectorView({ day: shanghaiDate(), selectedDates: ['2026-09-30', '2026-09-29'], sectorDataByDate: {
    '2026-09-30': [{ name: '机器人', code: '1', changePercent: 2, rank: 1, date: '2026-09-30' }],
    '2026-09-29': [{ name: '机器人', code: '1', changePercent: 1, rank: 1, date: '2026-09-29' }],
  }, plateRawDataByDate: { '2026-09-30': [{ secu_name: '机器人', stock_list: [] }], '2026-09-29': [{ secu_name: '机器人', stock_list: [] }] }, filterType: 'concept', topN: 10, sortBy: 'change' })
}
it('切回即显示快照，不触发数据或类型映射请求', async () => {
  seed()
  const fetcher = vi.fn().mockRejectedValue(new Error('must not request')); vi.stubGlobal('fetch', fetcher)
  const first = render(<SectorRotation />)
  await act(async () => {})
  expect(screen.queryByText('正在加载板块数据...')).toBeNull()
  expect(screen.getAllByText('机器人').length).toBeGreaterThan(0)
  expect(fetcher).not.toHaveBeenCalled()
  first.unmount()
  render(<SectorRotation />)
  await act(async () => {})
  expect(fetcher).not.toHaveBeenCalled()
})
it('每30秒只更新最新日期，刷新失败保留历史和快照，卸载停止请求', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-30T02:00:00Z')); seed()
  const fetcher = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetcher)
  const view = render(<SectorRotation />)
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toContain('date=20260930')
  expect(screen.getAllByText('机器人').length).toBeGreaterThan(0)
  expect(screen.getByText(/刷新失败/)).toBeTruthy()
  view.unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('跨入新的交易日后只获取最新一天，旧日期继续保留', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T02:00:00Z')); seed()
  const fetcher = vi.fn(async () => Response.json({ code: 200, data: { plate_stock: [{ secu_name: '机器人', secu_code: '1', change: 0.02, stock_list: [] }] } })); vi.stubGlobal('fetch', fetcher)
  const view = render(<SectorRotation />)
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toContain('date=20261008')
  expect(screen.getAllByText('机器人').length).toBeGreaterThan(1)
  view.unmount()
})
