/** 股债息差通道：沪深300 盈利收益率减 10 年期国债收益率，配滚动均值加减 k 倍标准差。
 * 通道只用当天及之前的数据计算，不含未来数值。 */

/** [日期, 息差（百分点）, 沪深300 收盘] */
export type SpreadRow = [string, number, number]
/** 一条息差序列：name 是指数名，label 是按钮上的文字（同一指数的不同口径用它区分） */
export interface SpreadSeries { id: string; name: string; label?: string; note: string; rows: SpreadRow[] }
export interface SpreadSnapshot {
  generatedAt: string
  source: string
  /** 滚动窗口（交易日）与标准差倍数 */
  window: number
  k: number
  rows: SpreadRow[]
  /** 其他指数：同样的算法，rows 结构相同 */
  extra?: SpreadSeries[]
}

export interface Band { mid: number; upper: number; lower: number }
export type Zone = 'upper' | 'lower' | 'above' | 'below'

/** 滚动通道：窗口取最近 window 个点，不足 window 的一半时不给值；标准差用总体口径 */
export function buildChannel(rows: SpreadRow[], window: number, k: number): (Band | null)[] {
  const out: (Band | null)[] = []
  const minPeriods = Math.floor(window / 2)
  let sum = 0, sq = 0
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i][1]
    sum += v; sq += v * v
    if (i >= window) { const old = rows[i - window][1]; sum -= old; sq -= old * old }
    const n = Math.min(i + 1, window)
    if (n < minPeriods) { out.push(null); continue }
    const mid = sum / n, sd = Math.sqrt(Math.max(0, sq / n - mid * mid))
    out.push({ mid, upper: mid + k * sd, lower: mid - k * sd })
  }
  return out
}

export function zoneOf(value: number, band: Band): Zone {
  if (value >= band.upper) return 'upper'
  if (value <= band.lower) return 'lower'
  return value >= band.mid ? 'above' : 'below'
}

/** 偏离中轨多少倍标准差 */
export const sigmaOf = (value: number, band: Band, k: number): number => {
  const sd = (band.upper - band.mid) / k
  return sd > 0 ? (value - band.mid) / sd : 0
}

/** 把连续触轨的日子合并成一次，返回每次的首日下标；相隔不到 gap 个交易日算同一次 */
export function touchEvents(rows: SpreadRow[], bands: (Band | null)[], zone: 'upper' | 'lower', gap = 20): number[] {
  const out: number[] = []
  let last = -Infinity
  rows.forEach((r, i) => {
    const b = bands[i]
    if (!b || zoneOf(r[1], b) !== zone) return
    if (i - last >= gap) out.push(i)
    last = i
  })
  return out
}

export const HORIZONS = [20, 60, 120, 250] as const

/** 第 i 天之后 h 个交易日的指数涨跌（%）；到期日超出样本时为 undefined */
export const forwardReturn = (rows: SpreadRow[], i: number, h: number): number | undefined =>
  i + h < rows.length ? (rows[i + h][2] / rows[i][2] - 1) * 100 : undefined

/** 平时任意一天之后 h 个交易日的平均涨跌（%），只统计通道可用之后的样本 */
export function baselineReturn(rows: SpreadRow[], from: number, h: number): number | undefined {
  let sum = 0, n = 0
  for (let i = from; i + h < rows.length; i++) { sum += rows[i + h][2] / rows[i][2] - 1; n++ }
  return n ? (sum / n) * 100 : undefined
}

export const average = (values: (number | undefined)[]): number | undefined => {
  const v = values.filter((x): x is number => x !== undefined)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
}
