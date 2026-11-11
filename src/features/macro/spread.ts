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
  /** 只看价格和 10 日线的指数（没有息差） */
  trend?: TrendSeries[]
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

/** 指数收盘价的 n 日简单均线（含当天）；不足 n 天时为 undefined */
export function movingAverage(rows: SpreadRow[], n: number): (number | undefined)[] {
  const out: (number | undefined)[] = []
  let sum = 0
  for (let i = 0; i < rows.length; i++) {
    sum += rows[i][2]
    if (i >= n) sum -= rows[i - n][2]
    out.push(i >= n - 1 ? sum / n : undefined)
  }
  return out
}

/** 收盘价上穿、下穿均线的日子：前一天在线上或线下（含等于），当天换到另一侧 */
export function crossings(rows: SpreadRow[], ma: (number | undefined)[]): { up: number[]; down: number[] } {
  const up: number[] = [], down: number[] = []
  for (let i = 1; i < rows.length; i++) {
    const a = ma[i - 1], b = ma[i]
    if (a === undefined || b === undefined) continue
    const before = rows[i - 1][2] > a, after = rows[i][2] > b
    if (!before && after) up.push(i)
    if (before && !after) down.push(i)
  }
  return { up, down }
}

export const signed = (v: number | undefined, d = 1): string => (v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`)
export const niceTicks = (lo: number, hi: number, n: number): number[] => {
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)))
  return out
}

export type PriceRow = [date: string, open: number, close: number]
export interface TrendSeries { id: string; name: string; label?: string; note: string; /** 回测从这一天开始（之前的数据只用来算均线） */ start: string; rows: PriceRow[] }
/** 一笔按规则的买卖：下标是成交日（信号日的下一个交易日），价格是当天开盘价；ret 已扣两次费用 */
export interface MaTrade { buy: number; sell?: number; ret?: number }
export interface MaBacktest {
  first: number
  trades: MaTrade[]
  /** 每天收盘时的净值，下标与 rows 对齐，起点之前为 undefined */
  nav: (number | undefined)[]
  hold: (number | undefined)[]
  /** 最新一天收盘后按规则应不应该持有，以及现在实际有没有持有 */
  want: boolean
  holding: boolean
}

/**
 * 10 日线规则：收盘价高于 n 日均线（含当天）记为线上。前一天收盘在线上，今天开盘就持有；否则空仓。
 * 也就是站上的下一个交易日开盘买、跌破的下一个交易日开盘卖。空仓拿现金，每次买或卖按 cost 扣费。
 * 对照是从起点那天开盘买入后一直持有，不扣费。
 */
export function maBacktest(rows: PriceRow[], start: string, n = 10, cost = 0.001): MaBacktest {
  const ma: (number | undefined)[] = []
  let sum = 0
  rows.forEach((r, i) => { sum += r[2]; if (i >= n) sum -= rows[i - n][2]; ma.push(i >= n - 1 ? sum / n : undefined) })
  const above = (i: number): boolean => ma[i] !== undefined && rows[i][2] > ma[i]!
  const first = Math.max(1, rows.findIndex(r => r[0] >= start))
  const nav: (number | undefined)[] = rows.map(() => undefined), hold: (number | undefined)[] = rows.map(() => undefined)
  const trades: MaTrade[] = []
  let v = 1, h = 1, holding = false, entry = 1
  for (let k = first; k < rows.length; k++) {
    const [, open, close] = rows[k], prevClose = rows[k - 1][2], want = above(k - 1)
    if (holding) v *= open / prevClose
    if (want !== holding) {
      if (want) { entry = v; trades.push({ buy: k }) } else { const t = trades[trades.length - 1]; t.sell = k; t.ret = (v * (1 - cost)) / entry - 1 }
      v *= 1 - cost
      holding = want
    }
    if (holding) v *= close / open
    h *= k === first ? close / open : close / prevClose
    nav[k] = v; hold[k] = h
  }
  return { first, trades, nav, hold, want: rows.length > 0 && above(rows.length - 1), holding }
}

/** 一条净值的年化收益和最大回撤（回撤按每天收盘算，起点净值 1 也算进高点） */
export function navStats(rows: PriceRow[], nav: (number | undefined)[], first: number): { total: number; annual: number; drawdown: number } {
  const last = rows.length - 1, end = nav[last] ?? 1
  const years = (Date.parse(rows[last][0]) - Date.parse(rows[first][0])) / 86400000 / 365.25
  let peak = 1, dd = 0
  for (let i = first; i <= last; i++) { const x = nav[i] ?? 1; peak = Math.max(peak, x); dd = Math.min(dd, x / peak - 1) }
  return { total: end - 1, annual: years > 0 ? (end ** (1 / years) - 1) : 0, drawdown: dd }
}

/** 按自然年拆收益：[年份, 该年收益] */
export function yearlyReturns(rows: PriceRow[], nav: (number | undefined)[], first: number): [string, number][] {
  const out: [string, number][] = []
  let base = 1
  for (let i = first; i < rows.length; i++) {
    const y = rows[i][0].slice(0, 4)
    if (i === rows.length - 1 || rows[i + 1][0].slice(0, 4) !== y) { out.push([y, (nav[i] ?? 1) / base - 1]); base = nav[i] ?? 1 }
  }
  return out
}
