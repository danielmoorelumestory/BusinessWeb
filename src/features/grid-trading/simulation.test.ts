import { describe, expect, it } from 'vitest'
import { adjustmentsOf, calculateGrid } from './simulation'
import type { Candle, GridParams, SavedRecord } from './types'

const row: GridParams = {
  name: '沪深300ETF',
  code: '510300',
  date: '2026-01-05',
  initialPrice: 10,
  initialAmount: 1_000,
  step: 1,
  rebound: 0.1,
  pullback: 0.1,
  gridAmount: 100,
}

const candle = (date: string, close: number, high: number, low: number): Candle => ({ date, close, high, low })

describe('calculateGrid', () => {
  it('uses the actual opening amount as the PnL benchmark after an opening override', () => {
    const adjusted = calculateGrid(row, [{ date: row.date, close: row.initialPrice, high: row.initialPrice, low: row.initialPrice }], { amount: { [row.date]: 2000 } })
    expect(adjusted.pnl).toBe(-5)
    expect(adjusted.series[0].pnl).toBe(-5)
  })
  it('does not use the opening candle range to trigger a grid trade', () => {
    const result = calculateGrid(row, [candle('2026-01-05', 10, 15, 5)])

    expect(result.trades).toHaveLength(1)
    expect(result.trades[0].side).toBe('建仓')
  })

  it('buys at last trade minus step plus rebound', () => {
    const result = calculateGrid(row, [
      candle('2026-01-05', 10, 15, 5),
      candle('2026-01-06', 9, 10, 9),
    ])

    expect(result.trades[1].side).toBe('买入')
    expect(result.trades[1].price).toBe(9.1)
  })

  it('prefers the buy trigger when one daily candle touches both sides', () => {
    const result = calculateGrid(row, [
      candle('2026-01-05', 10, 15, 5),
      candle('2026-01-06', 10, 11, 9),
    ])

    expect(result.trades).toHaveLength(2)
    expect(result.trades[1].side).toBe('买入')
  })

  it('allows grid buys to make cash flow negative without a cash budget', () => {
    const result = calculateGrid(
      { ...row, gridAmount: 50_000 },
      [candle('2026-01-05', 10, 10, 10), candle('2026-01-06', 9, 9, 9)],
    )

    expect(result.trades[1].side).toBe('买入')
    expect(result.value - result.position! * result.current).toBeLessThan(0)
  })

  it('caps sell quantity at available holdings', () => {
    const result = calculateGrid(
      { ...row, gridAmount: 50_000 },
      [
        candle('2026-01-05', 10, 10, 10),
        candle('2026-01-06', 11, 11, 10),
      ],
      { shares: { '2026-01-06': 50_000 } },
    )

    const openingQuantity = result.trades[0].quantity ?? result.trades[0].amount / result.trades[0].price
    const sell = result.trades.find(trade => trade.side === '卖出')
    expect(sell).toBeDefined()
    expect(sell!.quantity).toBeLessThanOrEqual(openingQuantity)
  })

  it('returns the same result for identical inputs', () => {
    const candles = [candle('2026-01-05', 10, 10, 10), candle('2026-01-06', 9, 9, 9)]

    expect(calculateGrid(row, candles)).toEqual(calculateGrid(row, candles))
  })

  it('behaves exactly as before when no floor or budget is set', () => {
    const candles = [
      candle('2026-01-05', 10, 10, 10),
      candle('2026-01-06', 9, 9, 9),
      candle('2026-01-07', 8, 8, 8),
    ]

    const result = calculateGrid(row, candles)
    expect(result.trades.map(trade => trade.side)).toEqual(['建仓', '买入', '买入'])
    expect(result.floorHitDate).toBeUndefined()
    expect(result.budgetExceeded).toBeUndefined()
    expect(result.warnings).toBeUndefined()
  })

  it('stops buying once the grid buy price falls below the floor and records the date', () => {
    const result = calculateGrid({ ...row, floorPrice: 9 }, [
      candle('2026-01-05', 10, 10, 10),
      candle('2026-01-06', 9, 9, 9),
      candle('2026-01-07', 8, 8, 8),
      candle('2026-01-08', 7, 7, 7),
    ])

    expect(result.trades.map(trade => trade.side)).toEqual(['建仓', '买入'])
    expect(result.trades[1].price).toBe(9.1)
    expect(result.floorHitDate).toBe('2026-01-07')
  })

  it('still triggers sells after the floor stopped buying, so holdings can unwind', () => {
    const result = calculateGrid({ ...row, floorPrice: 9 }, [
      candle('2026-01-05', 10, 10, 10),
      candle('2026-01-06', 9, 9, 9),
      candle('2026-01-07', 8, 8, 8),
      candle('2026-01-08', 10.2, 10.2, 8.2),
    ])

    expect(result.floorHitDate).toBe('2026-01-07')
    const sell = result.trades.find(trade => trade.side === '卖出')
    expect(sell).toBeDefined()
    expect(sell!.date).toBe('2026-01-08')
    expect(sell!.price).toBe(10)
  })

  it('never resumes buying after the floor is hit, even if the trigger price recovers above it', () => {
    const candles = [
      candle('2026-01-05', 10, 10, 10),
      candle('2026-01-06', 9, 9, 9),
      candle('2026-01-07', 8, 8, 8),
      candle('2026-01-08', 10.2, 10.2, 8.2),
      candle('2026-01-09', 9, 9, 9),
    ]
    const result = calculateGrid({ ...row, floorPrice: 9 }, candles)

    // 01-08 卖出后锚点回到 10，买入触发价 9.1 已高于下沿 9，但破网后不再恢复买入
    expect(result.trades.map(trade => trade.side)).toEqual(['建仓', '买入', '卖出'])
    expect(result.trades.filter(trade => trade.side === '买入')).toHaveLength(1)
  })

  it('flags budgetExceeded when maxCapital exceeds the budget without changing trades', () => {
    const candles = [
      candle('2026-01-05', 10, 10, 10),
      candle('2026-01-06', 9, 9, 9),
      candle('2026-01-07', 8, 8, 8),
    ]

    const withBudget = calculateGrid({ ...row, budget: 1_050 }, candles)
    const withoutBudget = calculateGrid(row, candles)
    expect(withBudget.maxCapital).toBe(1_200)
    expect(withBudget.budgetExceeded).toBe(true)
    expect(withBudget.trades).toEqual(withoutBudget.trades)
  })

  it('does not flag budgetExceeded when maxCapital stays within the budget', () => {
    const result = calculateGrid({ ...row, budget: 2_000 }, [
      candle('2026-01-05', 10, 10, 10),
      candle('2026-01-06', 9, 9, 9),
    ])

    expect(result.budgetExceeded).toBeUndefined()
  })

  it('rejects invalid optional floor and budget values', () => {
    const candles = [candle('2026-01-05', 10, 10, 10)]

    expect(() => calculateGrid({ ...row, floorPrice: 0 }, candles)).toThrow('floorPrice 参数无效')
    expect(() => calculateGrid({ ...row, floorPrice: Number.NaN }, candles)).toThrow('floorPrice 参数无效')
    expect(() => calculateGrid({ ...row, budget: -100 }, candles)).toThrow('budget 参数无效')
  })

  it('overlays manual trades and removed grid fills without mutating generated trade rows', () => {
    const candles = [
      candle('2026-01-05', 10, 10, 10),
      candle('2026-01-06', 9, 9, 9),
    ]
    const base = calculateGrid(row, candles)
    const adjusted = calculateGrid(row, candles, {
      removed: ['2026-01-06'],
      manual: [{ id: 'manual-1', date: '2026-01-06', side: '买入', price: 9.2, shares: 10 }],
    })

    expect(base.trades.some(trade => trade.date === '2026-01-06' && trade.side === '买入')).toBe(true)
    expect(adjusted.trades.filter(trade => trade.date === '2026-01-06').map(trade => trade.side)).toEqual(['买入'])
    expect(adjusted.trades.find(trade => trade.manual)?.price).toBe(9.2)
    expect(base.trades).toHaveLength(2)
    expect(adjusted.position).not.toBe(base.position)
  })
})

describe('adjustmentsOf', () => {
  it('projects saved per-date edits and manual ledger fields into simulation adjustments', () => {
    const record = {
      id: 'adjusted',
      savedAt: '2026-01-01T00:00:00.000Z',
      row,
      result: {
        range: '', current: 10, lastTradeDate: '', lastTrade: 10, nextBuy: 9, nextSell: 11,
        buyTrigger: 9, sellTrigger: 11, pnl: 0, value: 1_000, realized: 0, maxCapital: 1_000,
        buys: 0, sells: 0, trades: [], series: [],
      },
      priceOverrides: { '2026-01-06': 9.2 },
      amountOverrides: { '2026-01-06': 200 },
      sharesOverrides: { '2026-01-07': 10 },
      paramHistory: [{ until: '2026-01-05', step: 1, rebound: 0.1, pullback: 0.1 }],
      manualTrades: [{ id: 'm1', date: '2026-01-07', side: '买入' as const, price: 9, shares: 10 }],
      removedTrades: ['2026-01-08'],
    } as SavedRecord

    expect(adjustmentsOf(record)).toEqual({
      price: record.priceOverrides,
      amount: record.amountOverrides,
      shares: record.sharesOverrides,
      params: record.paramHistory,
      manual: record.manualTrades,
      removed: record.removedTrades,
    })
  })
})
