export type Period = {
  asOf: string; complete: boolean; count: number; close: number; ma: string; ma5: number | null; ma10: number | null; ma20: number | null
  macd: string; dif: number | null; dea: number | null; limitedMacdHistory: boolean; previousHistogram: number | null; previousRsi: number | null; rsi: number | null; rsiState: string
}

export const tone = (state: string) => ['多头', '偏多', '金叉', '偏强'].includes(state) ? 'up'
  : ['空头', '偏空', '死叉', '偏弱'].includes(state) ? 'down'
    : ['超买', '超卖'].includes(state) ? 'extreme' : 'neutral'

export function macdDescription(state: Period): string {
  if (state.dif === null || state.dea === null) return '历史不足，暂不判断'
  const axis = state.dif > 0 && state.dea > 0 ? '零轴上' : state.dif < 0 && state.dea < 0 ? '零轴下' : '零轴附近'
  if (state.macd === '金叉' || state.macd === '死叉') return `${axis}，本期${state.macd}`
  const histogram = 2 * (state.dif - state.dea)
  if (histogram === 0) return `${axis}，动能持平`
  const side = histogram > 0 ? '正柱' : '负柱'
  const movement = state.previousHistogram === null ? '' : Math.abs(histogram) > Math.abs(state.previousHistogram) ? '扩大'
    : Math.abs(histogram) < Math.abs(state.previousHistogram) ? '收窄' : '持平'
  return `${axis}，${side}${movement}`
}
export function rsiDescription(state: Period): string {
  if (state.rsi === null) return '历史不足，暂不判断'
  const level = state.rsi >= 45 && state.rsi <= 55 ? '中轴附近' : state.rsiState
  const change = state.previousRsi === null ? '' : state.rsi - state.previousRsi > .1 ? '，有所回升' : state.rsi - state.previousRsi < -.1 ? '，仍在回落' : '，变化不大'
  return `${state.rsi.toFixed(1)} ${level}${change}`
}
