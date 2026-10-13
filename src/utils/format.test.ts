import { describe, expect, it } from 'vitest'
import { formatPercent, formatPrice } from './format'

describe('formatPrice', () => {
  it.each([
    [1234567.89, '1,234,567.89'],
    [12, '12.00'],
    [12.5, '12.50'],
    [12.345, '12.35'],
    [999.999, '1,000.00'],
    [-1234.567, '-1,234.57'],
    [0, '0.00'],
    [-0, '-0.00'],
    [0.001, '0.00'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, '∞'],
    [Number.NEGATIVE_INFINITY, '-∞'],
  ])('formats %s with grouping and two decimal places as %s', (price, expected) => {
    expect(formatPrice(price)).toBe(expected)
  })

  it.each(['AAPL', 'ETH-USD', 'btc-usd', 'BTC-USD ', ''])(
    'retains two decimal places for symbol %j',
    symbol => {
      expect(formatPrice(1234.5, symbol)).toBe('1,234.50')
    },
  )

  it.each([
    [1234567.49, '1,234,567'],
    [1234.5, '1,235'],
    [999.5, '1,000'],
    [12, '12'],
    [-1234.5, '-1,235'],
    [0, '0'],
    [-0, '-0'],
    [0.49, '0'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, '∞'],
    [Number.NEGATIVE_INFINITY, '-∞'],
  ])('formats BTC-USD price %s without decimal places as %s', (price, expected) => {
    expect(formatPrice(price, 'BTC-USD')).toBe(expected)
  })
})

describe('formatPercent', () => {
  it.each([
    [12, '+12.00%'],
    [12.5, '+12.50%'],
    [12.345, '+12.35%'],
    [-12.345, '-12.35%'],
    [0, '+0.00%'],
    [-0, '+0.00%'],
    [0.001, '+0.00%'],
    [-0.001, '-0.00%'],
    [0.125, '+0.13%'],
    [1234.5, '+1234.50%'],
    [Number.NaN, 'NaN%'],
    [Number.POSITIVE_INFINITY, '+Infinity%'],
    [Number.NEGATIVE_INFINITY, '-Infinity%'],
  ])('formats %s with a sign and two decimal places as %s', (percent, expected) => {
    expect(formatPercent(percent)).toBe(expected)
  })
})

describe('formatPercent 符号', () => {
  it('负数不出现「+-」', () => {
    expect(formatPercent(-0.9)).toBe('-0.90%')
    expect(formatPercent(1.84)).toBe('+1.84%')
    expect(formatPercent(0)).toBe('+0.00%')
  })
})
