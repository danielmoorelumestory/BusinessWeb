// MACD(12,26,9) 收盘卖策略的买卖点：只用于在日K上标注，不参与网格回测。
// 规则：空仓时金叉 → 次日开盘买入；持仓时死叉 → 当日收盘卖出。
// T+1：买入当天出现死叉不能卖，改为下一交易日开盘卖出（与研究回测引擎一致）。
// 金叉：前一日 DIF ≤ DEA 且当日 DIF > DEA；死叉：前一日 DIF ≥ DEA 且当日 DIF < DEA。
// EMA 以第一根收盘价为初值、DEA 初值为 0；前 warmup 根只用于预热指标，不产生买卖。

export type MacdBar = { date: string; open: number; close: number };
export type MacdSignal = {
  date: string;
  side: 'buy' | 'sell';
  price: number;
  /** 产生信号的日期：买入为前一日金叉；卖出一般与成交同日，买入当天死叉时为前一日（次日开盘卖）。 */
  signalDate: string;
  /** 卖出时本笔收益（已扣往返费用前的价格涨跌）。 */
  ret?: number;
  /** 回测窗口末强制平仓（不是策略信号）。 */
  forced?: boolean;
};
export type MacdCloseResult = {
  signals: MacdSignal[];
  /** 最后一根出现金叉、尚未成交：下一交易日开盘买。 */
  pendingBuy?: { signalDate: string };
  holding: boolean;
};

export const MACD_WARMUP = 120;

/**
 * bull：可选的择时判定（按日期返回牛/熊，undefined 视为牛）；给出时择时熊市不开新仓，已持有的照常等死叉卖。
 * window：只在 [from, to] 内交易，规则同 kd10Signals 的 window（窗口首日空仓、末日收盘强制平仓）。
 */
export function macdCloseSignals(bars: MacdBar[], { fast = 12, slow = 26, signal = 9, warmup = MACD_WARMUP, bull, window }: { fast?: number; slow?: number; signal?: number; warmup?: number; bull?: (date: string) => boolean | undefined; window?: { from: string; to: string } } = {}): MacdCloseResult {
  const signals: MacdSignal[] = [];
  if (!bars.length) return { signals, holding: false };
  const kf = 2 / (fast + 1), ks = 2 / (slow + 1), kd = 2 / (signal + 1);
  let emaFast = bars[0].close, emaSlow = bars[0].close, dea = 0;
  let prior: [number, number] | undefined;
  let holding = false, pending = false, pendingSell = false, entry = 0;
  const [lo, hi] = windowBounds(bars, warmup, window);
  for (let i = 0; i <= hi; i++) {
    const bar = bars[i];
    if (i) { emaFast += kf * (bar.close - emaFast); emaSlow += ks * (bar.close - emaSlow); }
    const dif = emaFast - emaSlow;
    dea += kd * (dif - dea);
    const gold = !!prior && prior[0] <= prior[1] && dif > dea;
    const dead = !!prior && prior[0] >= prior[1] && dif < dea;
    prior = [dif, dea];
    if (pendingSell) {
      holding = false; pendingSell = false;
      signals.push({ date: bar.date, side: 'sell', price: bar.open, signalDate: bars[i - 1].date, ret: entry > 0 ? bar.open / entry - 1 : undefined });
    }
    let boughtToday = false;
    if (pending) {
      holding = true; pending = false; entry = bar.open; boughtToday = true;
      signals.push({ date: bar.date, side: 'buy', price: bar.open, signalDate: bars[i - 1].date });
    }
    if (i < lo) continue;
    if (window && i === hi) {
      if (holding) { holding = false; signals.push({ date: bar.date, side: 'sell', price: bar.close, signalDate: bar.date, ret: entry > 0 ? bar.close / entry - 1 : undefined, forced: true }); }
      break;
    }
    if (holding && dead && boughtToday) {
      pendingSell = true;
    } else if (holding && dead) {
      holding = false;
      signals.push({ date: bar.date, side: 'sell', price: bar.close, signalDate: bar.date, ret: entry > 0 ? bar.close / entry - 1 : undefined });
    } else if (!holding && gold && bull?.(bar.date) !== false) {
      pending = true;
    }
  }
  return { signals, holding, pendingBuy: !window && pending ? { signalDate: bars.at(-1)!.date } : undefined };
}

/** 交易区间的首尾下标：首个 ≥ warmup 且日期 ≥ from 的根，到最后一个日期 ≤ to 的根；没有窗口时为 [warmup, 末根]。 */
export function windowBounds(bars: { date: string }[], warmup: number, window?: { from: string; to: string }): [number, number] {
  if (!window) return [warmup, bars.length - 1];
  let lo = bars.findIndex((bar, i) => i >= warmup && bar.date >= window.from);
  if (lo < 0) lo = bars.length;
  let hi = -1;
  for (let i = bars.length - 1; i >= 0; i--) if (bars[i].date <= window.to) { hi = i; break; }
  return [lo, hi];
}
