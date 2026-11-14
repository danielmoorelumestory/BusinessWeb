/**
 * 网格详情页价格图下方的副图指标：MACD(12,26,9) 与同花顺「ETF 波段顶底」。
 * 只用于显示，不参与网格回测。输入为按日期升序的收盘价（页面用的是前复权日线）。
 */

const ema = (values: number[], alpha: number) => {
  const out: number[] = [];
  values.forEach((value, index) => out.push(index ? out[index - 1] + alpha * (value - out[index - 1]) : value));
  return out;
};

export type MacdSeries = { dif: number[]; dea: number[]; hist: number[]; ema12: number[]; ema26: number[] };

/** MACD 12/26/9，从第一根收盘价起递推（与同花顺默认口径一致）；hist 为 2×(DIF−DEA)，即同花顺的 MACD 柱。 */
export function macdSeries(closes: number[]): MacdSeries {
  const ema12 = ema(closes, 2 / 13), ema26 = ema(closes, 2 / 27);
  const dif = ema12.map((value, index) => value - ema26[index]);
  const dea = ema(dif, 0.2);
  return { dif, dea, hist: dif.map((value, index) => 2 * (value - dea[index])), ema12, ema26 };
}

/**
 * 下一交易日的 MACD 交叉临界价：用最后一根收盘后的 EMA12、EMA26、DEA 反推。
 * 下一根收盘价高于它则 DIF>DEA（多头），低于它则 DIF<DEA。当前多头时它是死叉价，空头时是金叉价。
 */
export function macdCrossPrice(series: MacdSeries): number | undefined {
  return macdCrossPriceAt(series, series.dif.length - 1);
}

/** 第 i 根收盘后，对第 i+1 根收盘价的交叉临界价（i 越界返回 undefined）。 */
export function macdCrossPriceAt(series: MacdSeries, i: number): number | undefined {
  if (i < 0 || i >= series.dif.length) return undefined;
  const a = 2 / 13, b = 2 / 27;
  return (series.dea[i] - (1 - a) * series.ema12[i] + (1 - b) * series.ema26[i]) / (a - b);
}

export type MacdEstimate = { bull: boolean; price: number; basisDate: string; forToday: boolean; lastClose: number };

/**
 * MACD 金叉 / 死叉预估价。盘中（最后一根是今天、还没收盘）用昨天收盘后的状态，估的是「今天收盘」的临界价，
 * 拿现价直接对照；收盘后或非交易时段用最后一根，估的是「下一交易日收盘」的临界价。
 * 基准日多头时给死叉价（收盘低于它即死叉），空头时给金叉价（收盘高于它即金叉）。
 */
export function macdEstimate(bars: { date: string; close: number }[], live: boolean): MacdEstimate | undefined {
  if (bars.length < 35) return undefined;
  const series = macdSeries(bars.map(bar => bar.close)), basis = bars.length - 1 - (live ? 1 : 0);
  const price = macdCrossPriceAt(series, basis);
  if (price === undefined || !Number.isFinite(price) || price <= 0) return undefined;
  return { bull: series.dif[basis] > series.dea[basis], price, basisDate: bars[basis].date, forToday: live, lastClose: bars.at(-1)!.close };
}

/**
 * 均线穿越临界价：第 i 天收盘后，下一交易日收盘价 P 与「含 P 的 n 日均线」比较，
 * P ≥ (前 n−1 日收盘之和 + P) / n  ⇔  P ≥ 前 n−1 日收盘均值。所以临界价就是截至 i 的最近 n−1 日收盘均值。
 */
export function maCrossPriceAt(closes: number[], n: number, i: number): number | undefined {
  if (i < n - 2 || i >= closes.length || n < 2) return undefined;
  let sum = 0;
  for (let k = i - n + 2; k <= i; k++) sum += closes[k];
  return sum / (n - 1);
}

export type MaEstimate = { n: number; above: boolean; price: number; basisDate: string; forToday: boolean; lastClose: number };

/** n 日线跌破 / 站上预估价，时点口径与 macdEstimate 相同；基准日收盘在均线上（含相等）时给跌破价，否则给站上价。 */
export function maEstimate(bars: { date: string; close: number }[], n: number, live: boolean): MaEstimate | undefined {
  const basis = bars.length - 1 - (live ? 1 : 0);
  if (basis < n - 1) return undefined;
  const closes = bars.map(bar => bar.close);
  const price = maCrossPriceAt(closes, n, basis);
  if (price === undefined || !(price > 0)) return undefined;
  const ma = closes.slice(basis - n + 1, basis + 1).reduce((a, b) => a + b, 0) / n;
  return { n, above: closes[basis] >= ma, price, basisDate: bars[basis].date, forToday: live, lastClose: closes.at(-1)! };
}

/** 最后一根日线是否为北京时间今天、且尚未收盘（15:00 前）。 */
export function isLiveBar(lastDate: string | undefined, now = new Date()): boolean {
  const bj = new Date(now.getTime() + 8 * 3600e3);
  return !!lastDate && lastDate === bj.toISOString().slice(0, 10) && bj.getUTCHours() < 15;
}

/**
 * 同花顺 ETF 波段顶底（截图核验复现，非官方源码）：
 * 100 × SUM(MAX(C−REF(C,1),0),13) / SUM(|C−REF(C,1)|,13)。
 * 用价格差（不是涨跌幅）、等权滚动求和；不足 13 次变化或 13 次变化全为 0 时返回 null。
 */
export function etfBand(closes: number[], period = 13): (number | null)[] {
  return closes.map((_, index) => {
    if (index < period) return null;
    let up = 0, total = 0;
    for (let k = index - period + 1; k <= index; k++) {
      const change = closes[k] - closes[k - 1];
      if (change > 0) up += change;
      total += Math.abs(change);
    }
    return total > 1e-12 ? 100 * up / total : null;
  });
}

export const BAND_HIGH = 70, BAND_LOW = 30;

/**
 * R1 风格比值：创业板50 ETF ÷ 红利低波 ETF（前复权收盘），与比值自身 20 日均线比较。
 * 比值在均线上方 = 偏进攻（按 R1，MACD 金叉可买）；下方 = 偏防守（金叉不买，持仓等死叉尾盘卖）。
 * 研究来源：扩展高波动ETF检验/多元行情协议.md（R1-20，T1 熊市不开新仓）。
 */
export const R1_CODES = { growth: '159949', defensive: '512890' } as const;
/** R2：创业板 ETF ÷ 红利 ETF，历史从 2011 年起（研究中的 R2-20）。 */
export const R2_CODES = { growth: '159915', defensive: '510880' } as const;
export const R1_MA = 20;
export type RatioPoint = { date: string; ratio: number; ma: number | null; bull: boolean | null };

export function styleRatio(growth: { date: string; close: number }[], defensive: { date: string; close: number }[], n = R1_MA): RatioPoint[] {
  const other = new Map(defensive.map(bar => [bar.date, bar.close]));
  const ratios = growth.filter(bar => other.has(bar.date) && bar.close > 0 && other.get(bar.date)! > 0)
    .map(bar => ({ date: bar.date, ratio: bar.close / other.get(bar.date)! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let sum = 0;
  return ratios.map((point, i) => {
    sum += point.ratio;
    if (i >= n) sum -= ratios[i - n].ratio;
    const ma = i >= n - 1 ? sum / n : null;
    return { ...point, ma, bull: ma === null ? null : point.ratio > ma };
  });
}

export type R1Estimate = { bull: boolean; ratio: number; ma: number; date: string; live: boolean; critical: number; basisDate: string };

/**
 * 当前状态 + 转向临界比值。live（最后一根是今天、未收盘）时状态是盘中暂态，临界值针对「今天收盘」；
 * 否则针对「下一交易日收盘」。临界比值 = 待估那天之前最近 n−1 个比值的均值（与 10 日线临界价同理）。
 */
export function r1Estimate(points: RatioPoint[], live: boolean, n = R1_MA): R1Estimate | undefined {
  const last = points.at(-1);
  if (!last || last.ma === null || last.bull === null) return undefined;
  const basis = points.length - 1 - (live ? 1 : 0);
  if (basis < n - 2) return undefined;
  const window = points.slice(basis - n + 2, basis + 1);
  const critical = window.reduce((a, p) => a + p.ratio, 0) / window.length;
  return { bull: last.bull, ratio: last.ratio, ma: last.ma, date: last.date, live, critical, basisDate: points[basis].date };
}
