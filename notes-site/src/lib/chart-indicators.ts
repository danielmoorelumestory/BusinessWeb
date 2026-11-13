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
