// The same close-based rules apply independently to daily, weekly and monthly bars.
export function technicalState(bars, complete = true) {
  if (!bars.length) return null
  const closes = bars.map(bar => Number(bar[2]))
  if (closes.some(close => !Number.isFinite(close) || close <= 0)) throw new Error('Invalid close')
  const count = closes.length
  const close = closes[count - 1]
  const average = n => count >= n ? closes.slice(-n).reduce((a, b) => a + b, 0) / n : null
  const ma5 = average(5), ma10 = average(10), ma20 = average(20)
  const ma = ma20 === null ? '不足' : close > ma5 && ma5 > ma10 && ma10 > ma20 ? '多头' : close < ma5 && ma5 < ma10 && ma10 < ma20 ? '空头' : '震荡'
  let ema12 = closes[0], ema26 = closes[0], dea = 0, dif = 0, previousGap = 0
  let gain = 0, loss = 0, previousHistogram = 0, previousRsi = null
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      previousHistogram = 2 * (dif - dea)
      previousRsi = i < 15 ? null : gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
    }
    previousGap = dif - dea
    if (i > 0) {
      ema12 += 2 / 13 * (closes[i] - ema12)
      ema26 += 2 / 27 * (closes[i] - ema26)
      const change = closes[i] - closes[i - 1]
      if (i <= 14) { gain += Math.max(change, 0) / 14; loss += Math.max(-change, 0) / 14 }
      else { gain = (gain * 13 + Math.max(change, 0)) / 14; loss = (loss * 13 + Math.max(-change, 0)) / 14 }
    }
    dif = ema12 - ema26
    dea += .2 * (dif - dea)
  }
  const gap = dif - dea
  const macd = count < 26 ? '不足' : gap > 0 ? (previousGap <= 0 ? '金叉' : '偏多') : gap < 0 ? (previousGap >= 0 ? '死叉' : '偏空') : '中性'
  const rsi = count < 15 ? null : gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  return { asOf: bars[count - 1][0], complete, count, close, ma, ma5, ma10, ma20, macd, dif: count < 26 ? null : dif, dea: count < 26 ? null : dea, histogram: count < 26 ? null : 2 * gap, limitedMacdHistory: count >= 26 && count < 60, previousHistogram: count < 27 ? null : previousHistogram, previousRsi, rsi,
    rsiState: rsi === null ? '不足' : rsi >= 70 ? '超买' : rsi <= 30 ? '超卖' : rsi > 50 ? '偏强' : rsi < 50 ? '偏弱' : '中性' }
}

export function aggregateBars(bars, period) {
  const groups = new Map()
  for (const bar of bars) {
    const date = new Date(`${bar[0]}T00:00:00Z`)
    // Group a calendar week by its Monday, including shortened holiday weeks.
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
    const key = period === 'month' ? bar[0].slice(0, 7) : date.toISOString().slice(0, 10)
    const existing = groups.get(key)
    if (!existing) groups.set(key, [...bar.slice(0, 6)])
    else {
      existing[0] = bar[0]; existing[2] = bar[2]
      existing[3] = String(Math.max(Number(existing[3]), Number(bar[3])))
      existing[4] = String(Math.min(Number(existing[4]), Number(bar[4])))
      existing[5] = String(Number(existing[5]) + Number(bar[5]))
    }
  }
  return [...groups.values()]
}
