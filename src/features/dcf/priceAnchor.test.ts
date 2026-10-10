import { describe, expect, it } from 'vitest'
import { priceAnchorAge } from './priceAnchor'

const today = new Date(2026, 9, 9) // 2026-10-09

describe('priceAnchorAge', () => {
  it('取出价格日期并算已过天数', () => {
    expect(priceAnchorAge('11.57 元（2026-09-30 收盘）；近 12 个月区间 10.05–11.92 元', today))
      .toEqual({ date: '2026-09-30', days: 9, stale: true })
  })

  it('7 天以内不算过期，第 8 天起算', () => {
    expect(priceAnchorAge('$10（2026-10-02 收盘）', today)?.stale).toBe(false)
    expect(priceAnchorAge('$10（2026-10-01 收盘）', today)?.stale).toBe(true)
  })

  it('当天价格为 0 天；未来日期不出现负数', () => {
    expect(priceAnchorAge('$10（2026-10-09 收盘）', today)?.days).toBe(0)
    expect(priceAnchorAge('$10（2026-10-12 收盘）', today)?.days).toBe(0)
  })

  it('没有日期或没有文本时返回 null，不编造', () => {
    expect(priceAnchorAge('11.57 元', today)).toBeNull()
    expect(priceAnchorAge(undefined, today)).toBeNull()
  })
})
