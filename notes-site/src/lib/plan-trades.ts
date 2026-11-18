// 回测优选分组对应的两套波段买卖方案：只用于在日K上标注和统计，不参与网格回测。
// - 创业板择时买卖点（cyb）：Y1 = 择时（创业板÷红利）+ B+KD10，见 kd10-signals.ts。
// - 沪深300择时买卖点（hs）：只认金叉 = 择时（沪深300÷红利）牛市 MACD 金叉次日开盘买、熊市不开新仓、死叉当日收盘卖。
// 统计按价格涨跌计算，未扣交易费用。
import { bullLookup, kd10Signals } from './kd10-signals';
import { macdCloseSignals, windowBounds } from './macd-signals';

export type PlanKey = 'cyb' | 'hs' | 'macd';
export type PlanBar = { date: string; open: number; high: number; low: number; close: number };
export type PlanSignal = { date: string; side: 'buy' | 'sell'; price: number; signalDate: string; reason: string; ret?: number; forced?: boolean };
export type PlanResult = { key: PlanKey; name: string; signals: PlanSignal[]; pendingBuy?: { signalDate: string; reason: string }; holding: boolean };
type BullPoint = { date: string; bull: boolean | null };

export const PLAN_NAMES: Record<PlanKey, string> = { cyb: '创业板择时', hs: '沪深300择时', macd: '纯MACD' };

export function cybPlan(bars: PlanBar[], r2: BullPoint[]): PlanResult {
  const result = kd10Signals(bars, bullLookup(r2));
  return { key: 'cyb', name: PLAN_NAMES.cyb, ...result };
}

export function hsPlan(bars: PlanBar[], h1: BullPoint[]): PlanResult {
  const result = macdCloseSignals(bars, { bull: bullLookup(h1) });
  return {
    key: 'hs', name: PLAN_NAMES.hs, holding: result.holding,
    signals: result.signals.map(signal => ({ ...signal, reason: signal.side === 'buy' ? '金叉' : '死叉' })),
    ...(result.pendingBuy ? { pendingBuy: { signalDate: result.pendingBuy.signalDate, reason: '金叉' } } : {}),
  };
}

/** 纯MACD（不择时）：金叉次日开盘买、死叉当日收盘卖，对应研究里的「纯MACD」对照。 */
export function macdPlan(bars: PlanBar[]): PlanResult {
  const result = macdCloseSignals(bars);
  return {
    key: 'macd', name: PLAN_NAMES.macd, holding: result.holding,
    signals: result.signals.map(signal => ({ ...signal, reason: signal.side === 'buy' ? '金叉' : '死叉' })),
    ...(result.pendingBuy ? { pendingBuy: { signalDate: result.pendingBuy.signalDate, reason: '金叉' } } : {}),
  };
}

export type PlanTrade = { buyDate: string; buyPrice: number; sellDate?: string; sellPrice: number; ret: number; open: boolean };
export type PlanStats = {
  /** 已完成的交易笔数（不含持仓中） */
  trades: number; wins: number; losses: number;
  winRate?: number; avgWin?: number; avgLoss?: number;
  /** 盈亏比 = 平均盈利 ÷ |平均亏损| */
  payoff?: number;
  /** 已完成交易逐笔复利累计 */
  total: number; best?: number; worst?: number;
  /** 区间末仍持有的一笔（按区间最后一个收盘价计浮动） */
  open?: PlanTrade;
};

/** 把买卖信号配成一笔笔交易；只统计买入日在 [from, to] 内的交易，卖出晚于 to 的按 to 当天收盘计浮动。 */
export function planTrades(signals: PlanSignal[], bars: { date: string; close: number }[], from?: string, to?: string): PlanTrade[] {
  const end = to ?? bars.at(-1)?.date ?? '';
  const closeAt = (date: string) => { let close: number | undefined; for (const bar of bars) { if (bar.date > date) break; close = bar.close; } return close; };
  const trades: PlanTrade[] = [];
  for (let k = 0; k < signals.length; k++) {
    const buy = signals[k];
    if (buy.side !== 'buy' || (from && buy.date < from) || buy.date > end) continue;
    const sell = signals[k + 1]?.side === 'sell' ? signals[k + 1] : undefined;
    if (sell && sell.date <= end) { trades.push({ buyDate: buy.date, buyPrice: buy.price, sellDate: sell.date, sellPrice: sell.price, ret: sell.price / buy.price - 1, open: false }); continue; }
    const close = closeAt(end);
    if (close !== undefined) trades.push({ buyDate: buy.date, buyPrice: buy.price, sellPrice: close, ret: close / buy.price - 1, open: true });
  }
  return trades;
}

export function planStats(trades: PlanTrade[]): PlanStats {
  const done = trades.filter(trade => !trade.open), rets = done.map(trade => trade.ret);
  const wins = rets.filter(ret => ret > 0), losses = rets.filter(ret => ret <= 0);
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
  const avgWin = mean(wins), avgLoss = mean(losses);
  return {
    trades: done.length, wins: wins.length, losses: losses.length,
    winRate: done.length ? wins.length / done.length : undefined, avgWin, avgLoss,
    payoff: avgWin !== undefined && avgLoss !== undefined && avgLoss < 0 ? avgWin / -avgLoss : undefined,
    total: rets.reduce((acc, ret) => acc * (1 + ret), 1) - 1,
    best: rets.length ? Math.max(...rets) : undefined, worst: rets.length ? Math.min(...rets) : undefined,
    open: trades.find(trade => trade.open),
  };
}

// ── 研究口径回测（与 数据训练优化ETF/engine.py + 全量逐年优秀AB筛选.py 一致）──
// 满仓进出、单边 0.1% 成本；第 121 根日线（下标 120）起才交易；窗口首日空仓、末日收盘强制平仓；
// 窗口内可交易日不足 120 根不出结果；年化要求 ≥244 根且 ≥365 自然日；最大回撤按每日收盘净值。
export const PLAN_COST = 0.001;
export const PLAN_WARMUP = 120;
const MIN_ROWS = 120, ANNUAL_MIN_ROWS = 244, ANNUAL_MIN_DAYS = 365;

export type PlanWindow = { from: string; to: string };
export type PlanBacktest = {
  first: string; last: string; sessions: number; years: number;
  total: number; cagr?: number; mdd: number; calmar?: number;
  /** 已完成交易（不含窗口末强制平仓）笔数、赚钱笔数 */
  natural: number; wins: number;
  winRate?: number; avgWin?: number; avgLoss?: number; payoff?: number; best?: number; worst?: number;
  /** 单笔平均盈亏：已完成交易收益的算术平均 */
  avgRet?: number;
  /** 同窗口一直持有：首日信号、次日开盘买入，末日收盘卖出，同样扣成本 */
  hold?: number;
};
export type PlanYearly = { year: number; result: PlanBacktest }[];

function signalsIn(key: PlanKey, bars: PlanBar[], bull: (date: string) => boolean | undefined, window: PlanWindow): PlanSignal[] {
  if (key === 'cyb') return kd10Signals(bars, bull, { warmup: PLAN_WARMUP, window }).signals;
  return macdCloseSignals(bars, { bull: key === 'macd' ? undefined : bull, warmup: PLAN_WARMUP, window }).signals.map(signal => ({ ...signal, reason: signal.forced ? '期末平仓' : signal.side === 'buy' ? '金叉' : '死叉' }));
}

/** 按研究引擎回测一个窗口；窗口内（下标 ≥120）不足 120 根时返回 undefined。 */
export function backtestPlan(key: PlanKey, bars: PlanBar[], bull: (date: string) => boolean | undefined, window: PlanWindow = { from: '1900-01-01', to: '9999-12-31' }): PlanBacktest | undefined {
  const [start, end] = windowBounds(bars, PLAN_WARMUP, window);
  if (end - start + 1 < MIN_ROWS) return undefined;
  const signals = signalsIn(key, bars, bull, window);
  const f = PLAN_COST;
  let cash = 1, q = 0, entryCash = 0, peak = 1, mdd = 0, k = 0;
  const rets: number[] = [];
  for (let i = start; i <= end; i++) {
    const bar = bars[i];
    while (k < signals.length && signals[k].date < bar.date) k++;
    for (; k < signals.length && signals[k].date === bar.date; k++) {
      const signal = signals[k];
      if (signal.side === 'buy' && !q) { q = cash / (signal.price * (1 + f)); entryCash = cash; cash = 0; }
      else if (signal.side === 'sell' && q) { cash = q * signal.price * (1 - f); q = 0; if (!signal.forced) rets.push(cash / entryCash - 1); }
    }
    const value = cash + q * bar.close;
    peak = Math.max(peak, value); mdd = Math.min(mdd, value / peak - 1);
  }
  const days = (Date.parse(bars[end].date) - Date.parse(bars[start].date)) / 86_400_000, years = days / 365.25;
  const cagr = end - start + 1 >= ANNUAL_MIN_ROWS && days >= ANNUAL_MIN_DAYS && cash > 0 ? Math.expm1(Math.log(cash) / years) : undefined;
  const wins = rets.filter(ret => ret > 0), losses = rets.filter(ret => ret <= 0);
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
  const avgWin = mean(wins), avgLoss = mean(losses);
  const hold = start + 1 <= end ? bars[end].close * (1 - f) / (bars[start + 1].open * (1 + f)) - 1 : undefined;
  return {
    first: bars[start].date, last: bars[end].date, sessions: end - start + 1, years,
    total: cash - 1, cagr, mdd, calmar: cagr !== undefined && mdd < 0 ? cagr / -mdd : undefined,
    natural: rets.length, wins: wins.length, winRate: rets.length ? wins.length / rets.length : undefined,
    avgWin, avgLoss, payoff: avgWin !== undefined && avgLoss !== undefined && avgLoss < 0 ? avgWin / -avgLoss : undefined,
    best: rets.length ? Math.max(...rets) : undefined, worst: rets.length ? Math.min(...rets) : undefined, avgRet: mean(rets), hold,
  };
}

/** 每个自然年单独回测（年初空仓、年末平仓），不足 120 个可交易日的年份不计。 */
export function backtestPlanYearly(key: PlanKey, bars: PlanBar[], bull: (date: string) => boolean | undefined): PlanYearly {
  if (!bars.length) return [];
  const out: PlanYearly = [];
  for (let year = Number(bars[0].date.slice(0, 4)); year <= Number(bars.at(-1)!.date.slice(0, 4)); year++) {
    const result = backtestPlan(key, bars, bull, { from: `${year}-01-01`, to: `${year}-12-31` });
    if (result) out.push({ year, result });
  }
  return out;
}

export function yearlySummary(yearly: PlanYearly) {
  const rets = yearly.map(item => item.result.total);
  return {
    years: rets.length, positive: rets.filter(ret => ret > 0).length,
    avg: rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : undefined,
    worst: rets.length ? Math.min(...rets) : undefined,
  };
}
