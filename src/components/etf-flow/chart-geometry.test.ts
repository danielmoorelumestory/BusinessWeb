import { describe, it, expect } from 'vitest'
import { extent, clampWindow, fracToIndex, pointerToIndex } from './chart-geometry'

describe('chart-geometry', () => {
  it('extent 取极值，空回退 [0,1]', () => {
    expect(extent([3, -1, 5, 2])).toEqual([-1, 5])
    expect(extent([])).toEqual([0, 1])
  })

  it('clampWindow 夹到 [0,n-1] 并保证至少 minSpan 个点', () => {
    expect(clampWindow(2, 7, 10, 5)).toEqual([2, 7])
    expect(clampWindow(-3, 100, 10, 5)).toEqual([0, 9])   // 越界夹回
    expect(clampWindow(8, 9, 10, 5)).toEqual([5, 9])      // 不足5点→左扩
    expect(clampWindow(5, 5, 10, 5)).toEqual([5, 9])      // 单点→扩到5点
    expect(clampWindow(7, 3, 10, 5)).toEqual([3, 7])      // 顺序颠倒→交换
  })

  it('clampWindow 不超过序列本身长度', () => {
    expect(clampWindow(0, 0, 3, 5)).toEqual([0, 2])       // n<minSpan 时取全长
  })

  it('fracToIndex 映射到最近索引', () => {
    expect(fracToIndex(0, 100)).toBe(0)
    expect(fracToIndex(1, 100)).toBe(99)
    expect(fracToIndex(0.5, 101)).toBe(50)
    expect(fracToIndex(-0.2, 100)).toBe(0)                // 越界夹到端点
    expect(fracToIndex(1.5, 100)).toBe(99)
    expect(fracToIndex(0.5, 1)).toBe(0)                   // 单点
  })

  it('pointerToIndex 把 clientX 换算成数据索引', () => {
    const rect = { left: 0, width: 760 }                 // rect 宽=viewBox 宽，1:1
    // viewW=760, padL=50, plotW=660, n=100
    expect(pointerToIndex(50, rect, 760, 50, 660, 100)).toBe(0)     // 左端
    expect(pointerToIndex(710, rect, 760, 50, 660, 100)).toBe(99)   // 右端
    expect(pointerToIndex(380, rect, 760, 50, 660, 100)).toBe(50)   // 中间
  })

  it('pointerToIndex 处理 rect 缩放（width≠viewW）', () => {
    const rect = { left: 100, width: 380 }               // 显示宽是 viewBox 的一半，左偏 100
    // clientX=100 → sx=0；clientX=480 → sx=760
    expect(pointerToIndex(100 + 25, rect, 760, 50, 660, 100)).toBe(0)   // sx=50 → 左端
    expect(pointerToIndex(480, rect, 760, 50, 660, 100)).toBe(99)       // sx=760 → 右端夹住
  })

  it('pointerToIndex rect 宽为 0 时回退 0', () => {
    expect(pointerToIndex(100, { left: 0, width: 0 }, 760, 50, 660, 100)).toBe(0)
  })
})
