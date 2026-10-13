import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ChinaMarketCharts from './ChinaMarketCharts'

afterEach(() => vi.unstubAllGlobals())
it('在四个图中独立切换周期，并以月数据聚合真实年线和成交额', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const query = new URL(url, 'http://localhost').searchParams
    const period = query.get('period')!, symbol = query.get('symbol')!
    return new Response(JSON.stringify({ data: { [symbol]: { [period]: [
      ['2025-12-31', '10', '12', '13', '9', '1000000', {}, '1', '10000000'],
      ['2026-01-30', '12', '11', '14', '10', '2000000', {}, '1', '20000000'],
      ['2026-02-27', '11', '15', '16', '10', '3000000', {}, '1', '30000000'],
    ] } } }))
  }))
  render(<ChinaMarketCharts />)
  const hs = screen.getByRole('region', { name: '沪深300' })
  await within(hs).findByRole('img', { name: /K线图/ })
  expect(within(hs).getByText('涨跌幅 +36.36%')).toBeTruthy()
  fireEvent.change(within(hs).getByRole('slider'), { target: { value: '1' } })
  expect(within(hs).getByText('涨跌幅 -8.33%')).toBeTruthy()
  fireEvent.change(within(hs).getByRole('slider'), { target: { value: '0' } })
  expect(within(hs).getByText('涨跌幅 —')).toBeTruthy()
  fireEvent.click(within(hs).getByRole('button', { name: '年线' }))
  await waitFor(() => expect(within(hs).getByText(/开 12.00/)).toBeTruthy())
  expect(within(hs).getByText('涨跌幅 +25.00%')).toBeTruthy()
  expect(within(hs).getByRole('button', { name: '年线' }).getAttribute('aria-pressed')).toBe('true')
  const zz = screen.getByRole('region', { name: '中证1000' })
  expect(within(zz).getByRole('button', { name: '日线' }).getAttribute('aria-pressed')).toBe('true')
  const vol = screen.getByRole('region', { name: '沪深两市成交量' })
  fireEvent.click(within(vol).getByRole('button', { name: '年' }))
  await waitFor(() => expect(within(vol).getByText(/10.00 亿股/, { selector: 'strong' })).toBeTruthy())
  const amount = screen.getByRole('region', { name: '沪深两市成交额' })
  expect(within(amount).getByRole('button', { name: '日' }).getAttribute('aria-pressed')).toBe('true')
  expect(within(amount).getByText('6,000.00 亿元', { selector: 'strong' })).toBeTruthy()
  expect(within(amount).getByRole('img', { name: '沪深两市成交额柱状图，单位亿元' })).toBeTruthy()
  fireEvent.click(within(amount).getByRole('button', { name: '年' }))
  await waitFor(() => expect(within(amount).getByText('10,000.00 亿元', { selector: 'strong' })).toBeTruthy())
  fireEvent.change(within(amount).getByRole('slider'), { target: { value: '0' } })
  expect(within(amount).getByText('2,000.00 亿元', { selector: 'strong' })).toBeTruthy()
})

it('显示最近60期时首根K线仍使用窗口外上一期的收盘价计算涨跌幅', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1_200_000)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const query = new URL(url, 'http://localhost').searchParams
    const rows = Array.from({ length: 65 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10)
      return [date, String(99 + i), String(100 + i), String(101 + i), String(98 + i), '1000000', {}, '1', '10000000']
    })
    return new Response(JSON.stringify({ data: { [query.get('symbol')!]: { day: rows } } }))
  }))
  render(<ChinaMarketCharts />)
  const hs = screen.getByRole('region', { name: '沪深300' })
  await within(hs).findByRole('img')
  fireEvent.change(within(hs).getByRole('slider'), { target: { value: '0' } })
  expect(within(hs).getByText('涨跌幅 +0.96%')).toBeTruthy()
})

it('请求失败时显示可重试的错误，不显示虚构图形', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2_400_000)
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })))
  render(<ChinaMarketCharts />)
  await screen.findAllByRole('alert')
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getAllByRole('button', { name: '重试' }).length).toBe(4)
})
