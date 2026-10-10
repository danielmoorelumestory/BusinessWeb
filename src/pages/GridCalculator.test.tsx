import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import InvestHub from './InvestHub'
import GridCalculator from './GridCalculator'

const mocks = vi.hoisted(() => ({
  getCandles: vi.fn(),
  fetchQuotes: vi.fn(),
  mergeQuote: vi.fn((candles: unknown[]) => candles),
  marketToday: vi.fn(() => '2026-09-30'),
  saveRecord: vi.fn(),
}))

vi.mock('../features/grid-trading/marketData', () => ({
  getCandles: mocks.getCandles,
  fetchQuotes: mocks.fetchQuotes,
  mergeQuote: mocks.mergeQuote,
  marketToday: mocks.marketToday,
}))
vi.mock('../features/grid-trading/repository', () => ({
  saveRecord: mocks.saveRecord,
}))

describe('grid trading calculator entry', () => {
  it('keeps a grid trading entry reachable from the 投资 hub', () => {
    render(<MemoryRouter><InvestHub /></MemoryRouter>)

    const link = screen.getAllByRole('link', { name: /网格交易/ })[0]
    expect(link.getAttribute('href')).toBe('/grid-trading')
  })

  it('validates inputs before requesting market data', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GridCalculator /></MemoryRouter>)
    await user.type(screen.getByLabelText('证券代码'), 'abc')
    await user.click(screen.getByRole('button', { name: '运行回测' }))

    expect(await screen.findByText(/六位数字/)).toBeTruthy()
    expect(mocks.getCandles).not.toHaveBeenCalled()
  })

  it('runs a simulation, shows its result and saves a complete record', async () => {
    const user = userEvent.setup()
    mocks.getCandles.mockResolvedValue({
      candles: [{ date: '2026-09-29', close: 3.5, high: 3.6, low: 3.4 }],
      fetchedOn: '2026-09-30', from: '2026-09-01', source: '腾讯前复权日线',
    })
    mocks.fetchQuotes.mockResolvedValue(new Map())
    mocks.saveRecord.mockClear()
    render(<MemoryRouter><GridCalculator /></MemoryRouter>)

    await user.type(screen.getByLabelText('证券代码'), '510300')
    await user.type(screen.getByLabelText('标的名称'), '沪深300ETF')
    await user.type(screen.getByLabelText('建仓日期'), '2026-09-01')
    await user.type(screen.getByLabelText('建仓价格'), '3.5')
    await user.type(screen.getByLabelText('建仓金额'), '10000')
    await user.type(screen.getByLabelText('每格金额'), '1000')
    await user.type(screen.getByLabelText('网格步长'), '0.1')
    await user.click(screen.getByRole('button', { name: '运行回测' }))

    expect(await screen.findByText('回测结果')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '保存记录' }))
    await waitFor(() => expect(mocks.saveRecord).toHaveBeenCalledTimes(1))
    expect(mocks.saveRecord.mock.calls[0][0]).toMatchObject({
      row: { code: '510300', name: '沪深300ETF', initialAmount: 10_000 },
      result: { current: 3.5 },
      endDate: '',
    })
  })

  it('shows a useful message when public market data is unavailable', async () => {
    const user = userEvent.setup()
    mocks.getCandles.mockRejectedValue(new Error('行情请求失败，请检查网络或浏览器跨域设置'))
    render(<MemoryRouter><GridCalculator /></MemoryRouter>)
    await user.type(screen.getByLabelText('证券代码'), '510300')
    await user.type(screen.getByLabelText('建仓日期'), '2026-09-01')
    await user.type(screen.getByLabelText('建仓价格'), '3.5')
    await user.type(screen.getByLabelText('建仓金额'), '10000')
    await user.type(screen.getByLabelText('每格金额'), '1000')
    await user.type(screen.getByLabelText('网格步长'), '0.1')
    await user.click(screen.getByRole('button', { name: '运行回测' }))

    expect(await screen.findByText(/行情请求失败/)).toBeTruthy()
  })
})
