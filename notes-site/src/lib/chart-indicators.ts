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
  const last = series.dif.length - 1;
  if (last < 0) return undefined;
  const a = 2 / 13, b = 2 / 27;
  return (series.dea[last] - (1 - a) * series.ema12[last] + (1 - b) * series.ema26[last]) / (a - b);
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
