// 择时 + B+KD10 策略的买卖点：只用于在日K上标注，不参与网格回测。
// 与研究回测（扩展高波动ETF检验/B加KD10择时破线卖对照.py 的 Y1）一致：
// - 择时（R2：创业板 ÷ 红利 高于其 20 日均线）为牛市时，空仓出现
//   ① MACD(12,26,9) 金叉，或 ② 收盘由 10 日线下/平 站上 10 日线 且 KDJ(9,3,3) 的 K−D ≥ 5.3
//   → 下一交易日开盘买入。择时为熊市时不开新仓。
// - 持仓时 MACD 死叉，或 当天择时为熊市 且收盘跌破 10 日线（不看 MACD 多空）→ 当日收盘卖出；
//   择时为牛市时跌破 10 日线不卖，只等死叉。
//   买入当天触发（T+1 不能卖）则下一交易日开盘卖出。
// - 择时缺数据（2011 年前、均线未形成）按牛市处理；某日无比值时沿用之前最近一天。
// - 前 warmup 根只用于预热指标，不产生买卖。
import { MACD_WARMUP } from './macd-signals';

export type Kd10Bar = { date: string; open: number; high: number; low: number; close: number };
export type Kd10Reason = '金叉' | '站上10日线' | '死叉' | '熊市破10日线';
export type Kd10Signal = {
  date: string;
  side: 'buy' | 'sell';
  price: number;
  /** 产生信号的交易日：买入为前一日；卖出一般同日，T+1 顺延时为前一日。 */
  signalDate: string;
  reason: Kd10Reason;
  /** 卖出时本笔价格涨跌（未扣费用）。 */
  ret?: number;
};
export type Kd10Result = {
  signals: Kd10Signal[];
  /** 最后一根产生买入信号、尚未成交。 */
  pendingBuy?: { signalDate: string; reason: Kd10Reason };
  holding: boolean;
};
export const KD10_THRESHOLD = 5.3;

/** bullOf：按日期给出择时是否为牛市；undefined 表示无数据（按牛市处理）。 */
export function kd10Signals(bars: Kd10Bar[], bullOf: (date: string) => boolean | undefined, { warmup = MACD_WARMUP } = {}): Kd10Result {
  const signals: Kd10Signal[] = [];
  const n = bars.length;
  if (!n) return { signals, holding: false };
  // MACD(12,26,9)
  const gold: boolean[] = [], dead: boolean[] = [];
  let emaFast = bars[0].close, emaSlow = bars[0].close, dea = 0, prior: [number, number] | undefined;
  for (let i = 0; i < n; i++) {
    if (i) { emaFast += 2 / 13 * (bars[i].close - emaFast); emaSlow += 2 / 27 * (bars[i].close - emaSlow); }
    const dif = emaFast - emaSlow; dea += 2 / 10 * (dif - dea);
    gold.push(!!prior && prior[0] <= prior[1] && dif > dea); dead.push(!!prior && prior[0] >= prior[1] && dif < dea);
    prior = [dif, dea];
  }
  // 10 日线上下、KDJ(9,3,3) 的 K−D
  const above: boolean[] = [], below: boolean[] = [], kd: number[] = [];
  let sum = 0, k = 50, d = 50;
  for (let i = 0; i < n; i++) {
    sum += bars[i].close; if (i >= 10) sum -= bars[i - 10].close;
    const ma = i >= 9 ? sum / 10 : NaN;
    // 收盘恰好等于均线时算「不在线上也不在线下」；浮点求和有微小误差，按相对 1e-9 视为相等（与研究的精确小数一致）
    const eps = Math.abs(bars[i].close) * 1e-9;
    above.push(i >= 9 && bars[i].close > ma + eps); below.push(i >= 9 && bars[i].close < ma - eps);
    let hi = -Infinity, lo = Infinity;
    for (let j = Math.max(0, i - 8); j <= i; j++) { hi = Math.max(hi, bars[j].high); lo = Math.min(lo, bars[j].low); }
    const rsv = hi > lo ? 100 * (bars[i].close - lo) / (hi - lo) : 50;
    k = (2 * k + rsv) / 3; d = (2 * d + k) / 3; kd.push(k - d);
  }
  let holding = false, entry = 0, entryIndex = -1;
  let pending: { side: 'buy' | 'sell'; reason: Kd10Reason } | undefined;
  const exitReason = (i: number, bull: boolean | undefined): Kd10Reason | undefined => dead[i] ? '死叉' : bull === false && below[i] ? '熊市破10日线' : undefined;
  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    if (pending) {
      if (pending.side === 'buy') { holding = true; entry = bar.open; entryIndex = i; }
      else holding = false;
      signals.push({ date: bar.date, side: pending.side, price: bar.open, signalDate: bars[i - 1].date, reason: pending.reason, ...(pending.side === 'sell' && entry > 0 ? { ret: bar.open / entry - 1 } : {}) });
      pending = undefined;
    }
    if (i < warmup) continue;
    const bull = bullOf(bar.date);
    if (holding) {
      const why = exitReason(i, bull);
      if (!why) continue;
      if (entryIndex === i) pending = { side: 'sell', reason: why };
      else { holding = false; signals.push({ date: bar.date, side: 'sell', price: bar.close, signalDate: bar.date, reason: why, ret: entry > 0 ? bar.close / entry - 1 : undefined }); }
      continue;
    }
    if (bull === false) continue;
    if (gold[i]) pending = { side: 'buy', reason: '金叉' };
    else if (i > 0 && above[i] && !above[i - 1] && kd[i] >= KD10_THRESHOLD) pending = { side: 'buy', reason: '站上10日线' };
  }
  return { signals, holding, pendingBuy: pending?.side === 'buy' ? { signalDate: bars.at(-1)!.date, reason: pending.reason } : undefined };
}

/** 把择时比值点做成按日期查询：某日无点时沿用之前最近一天；均线未形成或无数据返回 undefined。 */
export function bullLookup(points: { date: string; bull: boolean | null }[]): (date: string) => boolean | undefined {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return date => {
    let lo = 0, hi = sorted.length - 1, found = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (sorted[mid].date <= date) { found = mid; lo = mid + 1; } else hi = mid - 1; }
    const bull = found < 0 ? null : sorted[found].bull;
    return bull === null ? undefined : bull;
  };
}
