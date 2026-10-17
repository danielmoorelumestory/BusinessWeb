import { describe, expect, it } from 'vitest'
import { describeMa } from './etfMaDescription'

describe('均线状态描述', () => {
  it('同时说明三线排列与价格位置', () => {
    expect(describeMa({ close: 8, ma5: 9, ma10: 10, ma20: 11 })).toBe('低于全部均线，空头排列')
    expect(describeMa({ close: 12, ma5: 11, ma10: 10, ma20: 9 })).toBe('站上全部均线，多头排列')
    expect(describeMa({ close: 12, ma5: 10, ma10: 11, ma20: 9 })).toBe('站上全部均线，均线交错')
  })
  it('部分站上时标明各条均线，不把静态位置说成已经收复', () => {
    expect(describeMa({ close: 9.5, ma5: 9, ma10: 10, ma20: 11 })).toBe('空头排列；高于MA5，低于MA10/20')
    expect(describeMa({ close: 10, ma5: 11, ma10: 9, ma20: 12 })).toBe('均线交错；高于MA10，低于MA5/20')
  })
  it('贴线与历史不足不会误报站上或跌破', () => {
    expect(describeMa({ close: 10, ma5: 10, ma10: 10, ma20: 10 })).toBe('贴近全部均线，三线重合')
    expect(describeMa({ close: 10, ma5: 10, ma10: 9, ma20: 8 })).toBe('多头排列；高于MA10/20，贴近MA5')
    expect(describeMa({ close: 10, ma5: 10, ma10: null, ma20: null })).toBe('历史不足，暂不判断')
  })
})
