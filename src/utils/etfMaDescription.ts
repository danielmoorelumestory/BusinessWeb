type MaPosition = { close: number; ma5: number | null; ma10: number | null; ma20: number | null }

/** 描述股价相对 MA5/10 的位置与均线自身方向，颜色由股价相对 MA10 决定。 */
export function describeDailyMaEvents(bars: { date: string; close: number }[]): { description: string; signal: 'up' | 'down' | 'neutral' } {
  if (bars.length < 11) return { description: '历史不足，暂不判断', signal: 'neutral' }
  const average = (period: number) => bars.slice(-period).reduce((sum, bar) => sum + bar.close, 0) / period
  const close = bars[bars.length - 1].close
  const sign = (value: number) => Math.abs(value) <= 1e-10 ? 0 : value > 0 ? 1 : -1
  const gap5 = sign(close - average(5)), gap10 = sign(close - average(10))
  const position = (gap: number) => gap > 0 ? '上' : gap < 0 ? '下' : '平'
  const direction = (change: number) => sign(change) > 0 ? '回升' : sign(change) < 0 ? '回落' : '走平'
  // 均线本日变化 =（本日收盘价 − 移出窗口的收盘价）÷ 周期。
  const m5 = direction((close - bars[bars.length - 6].close) / 5)
  const m10 = direction((close - bars[bars.length - 11].close) / 10)
  return {
    description: `MA5${position(gap5)}10${position(gap10)}、M5${m5}10${m10}`,
    signal: gap10 > 0 ? 'up' : gap10 < 0 ? 'down' : 'neutral',
  }
}

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
