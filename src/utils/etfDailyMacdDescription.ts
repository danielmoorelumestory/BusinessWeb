export type MacdPoint = { dif: number; dea: number }
type Signal = 'up' | 'down' | 'neutral'
export type MacdSegment = { text: string; signal: Signal }
export type PeriodUnit = '日' | '周' | '月'
export type DailyMacdDescription = { cross: string; crossSignal: Signal; axis: string; axisSignal: Signal; bars: string; barsSignal: Signal; segments?: MacdSegment[] }

const EPS = 1e-10

/** DIF、DEA、零轴从大到小的顺序（如「DIF > DEA > 0」）；颜色只看 DIF 与 DEA：DIF 大红、DEA 大绿、相等灰。 */
export function macdOrder(dif: number, dea: number): MacdSegment {
  if (Math.abs(dif - dea) <= EPS) return { text: 'DIF = DEA', signal: 'neutral' }
  const text = [['DIF', dif], ['DEA', dea], ['0', 0]].sort((a, b) => (b[1] as number) - (a[1] as number)).map(item => item[0]).join(' > ')
  return { text, signal: dif > dea ? 'up' : 'down' }
}

/**
 * 柱体：红/绿柱 + 长度箭头（↑ 柱变长、↓ 柱变短、→ 持平，红绿柱通用）。
 * 颜色看动能方向：红柱变长或绿柱变短为红，绿柱变长或红柱变短为绿，持平与零柱为灰。
 */
export function macdBar(histogram: number, previousHistogram: number | null): MacdSegment {
  const zero = Math.abs(histogram) <= EPS
  const change = previousHistogram === null ? 0 : Math.abs(histogram) - Math.abs(previousHistogram)
  const dir = change > EPS ? 1 : change < -EPS ? -1 : 0
  const signal: Signal = zero || !dir ? 'neutral' : (histogram > 0) === (dir > 0) ? 'up' : 'down'
  return { text: `${zero ? '零' : histogram > 0 ? '红' : '绿'}柱${dir > 0 ? '↑' : dir < 0 ? '↓' : '→'}`, signal }
}

/** 交叉水位取交叉当根日线的 DEA，后续越过零轴不改写该次交叉的位置。 */
export function describeMacdHistory(points: MacdPoint[], unit: PeriodUnit = '日'): DailyMacdDescription {
  const missing: DailyMacdDescription = { cross: '历史不足', crossSignal: 'neutral', axis: '', axisSignal: 'neutral', bars: '', barsSignal: 'neutral' }
  if (points.length < 26) return missing
  let lastCross: { golden: boolean; above: boolean; index: number } | undefined
  let previousGap = points[0].dif - points[0].dea
  for (let i = 1; i < points.length; i++) {
    const point = points[i]
    const gap = point.dif - point.dea
    if (i >= 25 && ((gap > 0 && previousGap <= 0) || (gap < 0 && previousGap >= 0))) {
      lastCross = { golden: gap > 0, above: point.dea >= 0, index: i }
    }
    if (gap !== 0) previousGap = gap
  }
  const last = points[points.length - 1], previous = points[points.length - 2]
  const histogram = 2 * (last.dif - last.dea)
  const previousHistogram = 2 * (previous.dif - previous.dea)
  const change = Math.abs(histogram) - Math.abs(previousHistogram)
  const movement = change > 1e-10 ? '扩大' : change < -1e-10 ? '收窄' : '持平'
  const red = histogram > 0
  const crossAge = lastCross ? points.length - 1 - lastCross.index : 0
  const crossSegment: MacdSegment = lastCross
    ? { text: `${lastCross.golden ? '金叉' : '死叉'}${crossAge ? crossAge + unit : '当' + unit}`, signal: lastCross.golden ? 'up' : 'down' }
    : { text: '未见交叉', signal: 'neutral' }
  return {
    segments: [macdOrder(last.dif, last.dea), macdBar(histogram, previousHistogram), crossSegment],
    cross: lastCross ? `${lastCross.above ? '水上' : '水下'}${lastCross.golden ? '金叉' : '死叉'}` : '未见交叉',
    crossSignal: lastCross ? lastCross.golden ? 'up' : 'down' : 'neutral',
    axis: last.dif > 0 && last.dea > 0 ? '零轴上' : last.dif < 0 && last.dea < 0 ? '零轴下' : '零轴附近',
    axisSignal: last.dif > 0 && last.dea > 0 ? 'up' : last.dif < 0 && last.dea < 0 ? 'down' : 'neutral',
    bars: Math.abs(histogram) <= 1e-10 ? '零柱' : `${red ? '红' : '绿'}柱${movement}`,
    barsSignal: Math.abs(histogram) <= 1e-10 || movement === '持平' ? 'neutral' : (red && movement === '扩大') || (!red && movement === '收窄') ? 'up' : 'down',
  }
}

/** 与共享 MACD 规则一致：EMA12/26，以首个收盘价初始化，DEA 为 DIF 的 EMA9。 */
export function describeDailyMacdEvents(closes: number[], unit: PeriodUnit = '日'): DailyMacdDescription {
  let ema12 = closes[0], ema26 = closes[0], dea = 0
  const points = closes.map((close, i) => {
    if (i > 0) {
      ema12 += 2 / 13 * (close - ema12)
      ema26 += 2 / 27 * (close - ema26)
    }
    const dif = ema12 - ema26
    dea += .2 * (dif - dea)
    return { dif, dea }
  })
  return describeMacdHistory(points, unit)
}
