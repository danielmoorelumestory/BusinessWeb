// 回测优选分组对应的两套波段买卖方案：只用于在日K上标注和统计，不参与网格回测。
// - 创业板择时买卖点（cyb）：Y1 = 择时（创业板÷红利）+ B+KD10，见 kd10-signals.ts。
// - 沪深300择时买卖点（hs）：只认金叉 = 择时（沪深300÷红利）牛市 MACD 金叉次日开盘买、熊市不开新仓、死叉当日收盘卖。
// 统计按价格涨跌计算，未扣交易费用。
import { bullLookup, kd10Signals } from './kd10-signals';
import { macdCloseSignals } from './macd-signals';

export type PlanKey = 'cyb' | 'hs';
export type PlanBar = { date: string; open: number; high: number; low: number; close: number };
export type PlanSignal = { date: string; side: 'buy' | 'sell'; price: number; signalDate: string; reason: string; ret?: number };
export type PlanResult = { key: PlanKey; name: string; signals: PlanSignal[]; pendingBuy?: { signalDate: string; reason: string }; holding: boolean };
type BullPoint = { date: string; bull: boolean | null };

export const PLAN_NAMES: Record<PlanKey, string> = { cyb: '创业板择时', hs: '沪深300择时' };

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
