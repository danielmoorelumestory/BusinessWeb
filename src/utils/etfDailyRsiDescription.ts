export type RsiSegment = { text: string; signal: 'up' | 'down' | 'neutral' | 'extreme' }
export type RsiUnit = '日' | '周' | '月'
export type RsiCrossDescription = { description: string; signal: 'up' | 'down' | 'neutral'; segments?: RsiSegment[] }

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

/**
 * 三段（超买超卖时多一段）：RSI6、RSI24、50 中轴从大到小的顺序（颜色看 RSI6 与 RSI24 谁大）、
 * RSI6 较前一根的方向箭头、最近一次 RSI6/24 交叉距今；RSI6 ≥ 70 / ≤ 30 追加「超买 / 超卖」（极端色）。
 */
export function buildRsiSegments(points: { fast: number | null; slow: number | null }[], unit: RsiUnit): RsiSegment[] {
  const valid = points.map((point, index) => ({ ...point, index })).filter((point): point is { fast: number; slow: number; index: number } => point.fast !== null && point.slow !== null)
  if (!valid.length) return [{ text: 'RSI6/24历史不足', signal: 'neutral' }]
  const gapOf = (point: { fast: number; slow: number }) => Math.abs(point.fast - point.slow) < 1e-10 ? 0 : point.fast - point.slow
  let previousGap: number | undefined, cross: { golden: boolean; index: number } | undefined
  for (const point of valid) {
    const gap = gapOf(point)
    if (previousGap !== undefined && ((gap > 0 && previousGap <= 0) || (gap < 0 && previousGap >= 0))) cross = { golden: gap > 0, index: point.index }
    if (gap !== 0 || previousGap === undefined) previousGap = gap
  }
  const last = valid[valid.length - 1], before = valid.length > 1 ? valid[valid.length - 2] : undefined
  const gap = gapOf(last)
  const order: RsiSegment = gap === 0 ? { text: 'RSI6 = RSI24', signal: 'neutral' } : {
    text: [['RSI6', last.fast], ['RSI24', last.slow], ['50', 50]].sort((a, b) => (b[1] as number) - (a[1] as number)).map(item => item[0]).join(' > '),
    signal: gap > 0 ? 'up' : 'down',
  }
  const change = before ? last.fast - before.fast : 0
  const arrow: RsiSegment = { text: `RSI6${change > .1 ? '↑' : change < -.1 ? '↓' : '→'}`, signal: change > .1 ? 'up' : change < -.1 ? 'down' : 'neutral' }
  const age = cross ? points.length - 1 - cross.index : 0
  const crossed: RsiSegment = cross
    ? { text: `${cross.golden ? '金叉' : '死叉'}${age ? age + unit : '当' + unit}`, signal: cross.golden ? 'up' : 'down' }
    : { text: '未见交叉', signal: 'neutral' }
  const extreme: RsiSegment[] = last.fast >= 70 ? [{ text: '超买', signal: 'extreme' }] : last.fast <= 30 ? [{ text: '超卖', signal: 'extreme' }] : []
  return [order, arrow, crossed, ...extreme]
}

export function describeDailyRsiEvents(closes: number[], unit: RsiUnit = '日'): RsiCrossDescription {
  const fast = wilderRsiSeries(closes, 6), slow = wilderRsiSeries(closes, 24)
  const points = fast.map((value, i) => ({ fast: value, slow: slow[i] }))
  return { ...describeRsiCross(points), segments: buildRsiSegments(points, unit) }
}
