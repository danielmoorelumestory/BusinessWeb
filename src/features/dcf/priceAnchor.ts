// 公司研究的盈亏比、买入价都以「价格锚点」为基准，价格过期时这些数字就不能直接用。
// 价格日期写在指标文本里（如“11.57 元（2026-09-30 收盘）”），这里取出来并算已过天数。

/** 超过这个天数，提示价格可能已偏离，需重新取价再看盈亏比 */
export const PRICE_STALE_DAYS = 7

export interface PriceAnchorAge {
  date: string
  days: number
  stale: boolean
}

export function priceAnchorAge(priceText: string | undefined, today: Date = new Date()): PriceAnchorAge | null {
  const m = priceText?.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const date = m[0]
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(t)) return null
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.max(0, Math.round((todayUtc - t) / 86_400_000))
  return { date, days, stale: days > PRICE_STALE_DAYS }
}
