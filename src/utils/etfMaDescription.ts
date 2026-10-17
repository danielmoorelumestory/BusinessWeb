type MaPosition = { close: number; ma5: number | null; ma10: number | null; ma20: number | null }

/** Describe observed positions, without implying a crossover that has not been checked. */
export function describeMa({ close, ma5, ma10, ma20 }: MaPosition): string {
  if (ma5 === null || ma10 === null || ma20 === null) return '历史不足，暂不判断'
  const lines = [[5, ma5], [10, ma10], [20, ma20]] as const
  const above = lines.filter(([, value]) => close - value > 1e-10).map(([period]) => period)
  const below = lines.filter(([, value]) => value - close > 1e-10).map(([period]) => period)
  const near = lines.filter(([, value]) => Math.abs(value - close) <= 1e-10).map(([period]) => period)
  const alignment = ma5 > ma10 && ma10 > ma20 ? '多头排列' : ma5 < ma10 && ma10 < ma20 ? '空头排列'
    : Math.max(ma5, ma10, ma20) - Math.min(ma5, ma10, ma20) <= 1e-10 ? '三线重合' : '均线交错'
  if (above.length === 3) return `站上全部均线，${alignment}`
  if (below.length === 3) return `低于全部均线，${alignment}`
  if (near.length === 3) return '贴近全部均线，三线重合'
  const position = [above.length && `高于MA${above.join('/')}`, below.length && `低于MA${below.join('/')}`, near.length && `贴近MA${near.join('/')}`].filter(Boolean).join('，')
  return `${alignment}；${position}`
}
