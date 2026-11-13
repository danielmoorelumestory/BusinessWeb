// MACD(12,26,9) 收盘卖策略的买卖点：只用于在日K上标注，不参与网格回测。
// 规则：空仓时金叉 → 次日开盘买入；持仓时死叉 → 当日收盘卖出。
// 金叉：前一日 DIF ≤ DEA 且当日 DIF > DEA；死叉：前一日 DIF ≥ DEA 且当日 DIF < DEA。
// EMA 以第一根收盘价为初值、DEA 初值为 0；前 warmup 根只用于预热指标，不产生买卖。

export type MacdBar = { date: string; open: number; close: number };
export type MacdSignal = {
  date: string;
  side: 'buy' | 'sell';
  price: number;
  /** 产生信号的日期：买入为前一日金叉，卖出与成交同日。 */
  signalDate: string;
  /** 卖出时本笔收益（已扣往返费用前的价格涨跌）。 */
  ret?: number;
};
export type MacdCloseResult = {
  signals: MacdSignal[];
  /** 最后一根出现金叉、尚未成交：下一交易日开盘买。 */
  pendingBuy?: { signalDate: string };
  holding: boolean;
};

export const MACD_WARMUP = 120;

export function macdCloseSignals(bars: MacdBar[], { fast = 12, slow = 26, signal = 9, warmup = MACD_WARMUP } = {}): MacdCloseResult {
  const signals: MacdSignal[] = [];
  if (!bars.length) return { signals, holding: false };
  const kf = 2 / (fast + 1), ks = 2 / (slow + 1), kd = 2 / (signal + 1);
  let emaFast = bars[0].close, emaSlow = bars[0].close, dea = 0;
  let prior: [number, number] | undefined;
  let holding = false, pending = false, entry = 0;
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (i) { emaFast += kf * (bar.close - emaFast); emaSlow += ks * (bar.close - emaSlow); }
    const dif = emaFast - emaSlow;
    dea += kd * (dif - dea);
    const gold = !!prior && prior[0] <= prior[1] && dif > dea;
    const dead = !!prior && prior[0] >= prior[1] && dif < dea;
    prior = [dif, dea];
    if (pending) {
      holding = true; pending = false; entry = bar.open;
      signals.push({ date: bar.date, side: 'buy', price: bar.open, signalDate: bars[i - 1].date });
    }
    if (i < warmup) continue;
    if (holding && dead) {
      holding = false;
      signals.push({ date: bar.date, side: 'sell', price: bar.close, signalDate: bar.date, ret: entry > 0 ? bar.close / entry - 1 : undefined });
    } else if (!holding && gold) {
      pending = true;
    }
  }
  return { signals, holding, pendingBuy: pending ? { signalDate: bars.at(-1)!.date } : undefined };
}
