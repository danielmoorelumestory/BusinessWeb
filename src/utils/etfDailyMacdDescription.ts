export type MacdPoint = { dif: number; dea: number }
type Signal = 'up' | 'down' | 'neutral'
export type DailyMacdDescription = { cross: string; crossSignal: Signal; axis: string; axisSignal: Signal; bars: string; barsSignal: Signal }

/** 交叉水位取交叉当根日线的 DEA，后续越过零轴不改写该次交叉的位置。 */
export function describeMacdHistory(points: MacdPoint[]): DailyMacdDescription {
  const missing: DailyMacdDescription = { cross: '历史不足', crossSignal: 'neutral', axis: '', axisSignal: 'neutral', bars: '', barsSignal: 'neutral' }
  if (points.length < 26) return missing
  let lastCross: { golden: boolean; above: boolean } | undefined
  let previousGap = points[0].dif - points[0].dea
  for (let i = 1; i < points.length; i++) {
    const point = points[i]
    const gap = point.dif - point.dea
    if (i >= 25 && ((gap > 0 && previousGap <= 0) || (gap < 0 && previousGap >= 0))) {
      lastCross = { golden: gap > 0, above: point.dea >= 0 }
    }
    if (gap !== 0) previousGap = gap
  }
  const last = points[points.length - 1], previous = points[points.length - 2]
  const histogram = 2 * (last.dif - last.dea)
  const previousHistogram = 2 * (previous.dif - previous.dea)
  const change = Math.abs(histogram) - Math.abs(previousHistogram)
  const movement = change > 1e-10 ? '扩大' : change < -1e-10 ? '收窄' : '持平'
  const red = histogram > 0
  return {
    cross: lastCross ? `${lastCross.above ? '水上' : '水下'}${lastCross.golden ? '金叉' : '死叉'}` : '未见交叉',
    crossSignal: lastCross ? lastCross.golden ? 'up' : 'down' : 'neutral',
    axis: last.dif > 0 && last.dea > 0 ? '零轴上' : last.dif < 0 && last.dea < 0 ? '零轴下' : '零轴附近',
    axisSignal: last.dif > 0 && last.dea > 0 ? 'up' : last.dif < 0 && last.dea < 0 ? 'down' : 'neutral',
    bars: Math.abs(histogram) <= 1e-10 ? '零柱' : `${red ? '红' : '绿'}柱${movement}`,
    barsSignal: Math.abs(histogram) <= 1e-10 || movement === '持平' ? 'neutral' : (red && movement === '扩大') || (!red && movement === '收窄') ? 'up' : 'down',
  }
}

/** 与共享 MACD 规则一致：EMA12/26，以首个收盘价初始化，DEA 为 DIF 的 EMA9。 */
export function describeDailyMacdEvents(closes: number[]): DailyMacdDescription {
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
  return describeMacdHistory(points)
}
