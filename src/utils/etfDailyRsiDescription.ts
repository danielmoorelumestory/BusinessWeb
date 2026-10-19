export type RsiCrossDescription = { description: string; signal: 'up' | 'down' | 'neutral' }

/** Wilder 平滑；前 period 个涨跌取平均，此后递推。 */
export function wilderRsiSeries(closes: number[], period: number): (number | null)[] {
  let gain = 0, loss = 0
  return closes.map((close, i) => {
    if (i === 0) return null
    const change = close - closes[i - 1]
    if (i <= period) {
      gain += Math.max(change, 0) / period
      loss += Math.max(-change, 0) / period
    } else {
      gain = (gain * (period - 1) + Math.max(change, 0)) / period
      loss = (loss * (period - 1) + Math.max(-change, 0)) / period
    }
    return i < period ? null : gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  })
}

export function describeRsiCross(points: { fast: number | null; slow: number | null }[]): RsiCrossDescription {
  let previousGap: number | undefined
  let latest: '金叉' | '死叉' | undefined
  let currentGap: number | undefined
  for (const { fast, slow } of points) {
    if (fast === null || slow === null) continue
    const gap = Math.abs(fast - slow) < 1e-10 ? 0 : fast - slow
    if (previousGap !== undefined && ((gap > 0 && previousGap <= 0) || (gap < 0 && previousGap >= 0))) latest = gap > 0 ? '金叉' : '死叉'
    if (gap !== 0 || previousGap === undefined) previousGap = gap
    currentGap = gap
  }
  if (currentGap === undefined) return { description: 'RSI6/24历史不足', signal: 'neutral' }
  if (latest) return { description: `RSI6/24${latest}`, signal: latest === '金叉' ? 'up' : 'down' }
  return { description: currentGap > 0 ? 'RSI6高于RSI24' : currentGap < 0 ? 'RSI6低于RSI24' : 'RSI6/24重合', signal: currentGap > 0 ? 'up' : currentGap < 0 ? 'down' : 'neutral' }
}

export function describeDailyRsiEvents(closes: number[]): RsiCrossDescription {
  const fast = wilderRsiSeries(closes, 6), slow = wilderRsiSeries(closes, 24)
  return describeRsiCross(fast.map((value, i) => ({ fast: value, slow: slow[i] })))
}
