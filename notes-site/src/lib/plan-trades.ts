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

export type PlanCurveStats = {
  /** 年化收益：区间首日到末日按自然日折算 */
  annual?: number;
  /** 最大回撤（负数），按每日收盘盯市的资金曲线计算 */
  maxDrawdown?: number;
  /** 卡玛 = 年化 ÷ |最大回撤| */
  calmar?: number;
  /** 区间覆盖的各自然年收益（首尾年不足一年也算一年） */
  yearly: { year: string; ret: number }[];
  yearAvg?: number; yearsUp: number; worstYear?: number;
};

/**
 * 把交易串成每日盯市的资金曲线（满仓进出、逐笔复利、未扣费用），再算年化、最大回撤、卡玛与逐年收益。
 * trades 来自 planTrades（同一区间）；持仓日按当日收盘 ÷ 买入价计浮动，卖出日按卖出价落袋。
 */
export function planCurveStats(trades: PlanTrade[], bars: { date: string; close: number }[], from?: string, to?: string): PlanCurveStats {
  const inRange = bars.filter(bar => (!from || bar.date >= from) && (!to || bar.date <= to));
  if (inRange.length < 2) return { yearly: [], yearsUp: 0 };
  const sorted = [...trades].sort((a, b) => a.buyDate.localeCompare(b.buyDate));
  const equity: { date: string; value: number }[] = [];
  let base = 1, k = 0;
  for (const bar of inRange) {
    let value = base;
    while (k < sorted.length && sorted[k].buyDate <= bar.date) {
      const trade = sorted[k];
      if (!trade.open && trade.sellDate && trade.sellDate <= bar.date) { base *= 1 + trade.ret; value = base; k++; continue; }
      value = base * bar.close / trade.buyPrice;
      break;
    }
    equity.push({ date: bar.date, value });
  }
  let peak = 1, maxDrawdown = 0;
  for (const point of equity) { peak = Math.max(peak, point.value); maxDrawdown = Math.min(maxDrawdown, point.value / peak - 1); }
  const days = (Date.parse(inRange.at(-1)!.date) - Date.parse(inRange[0].date)) / 86_400_000;
  const final = equity.at(-1)!.value;
  const annual = days > 0 && final > 0 ? final ** (365.25 / days) - 1 : undefined;
  const yearly: { year: string; ret: number }[] = [];
  let start = 1;
  for (let i = 0; i < equity.length; i++) {
    const year = equity[i].date.slice(0, 4);
    if (equity[i + 1]?.date.slice(0, 4) === year) continue;
    yearly.push({ year, ret: equity[i].value / start - 1 });
    start = equity[i].value;
  }
  const rets = yearly.map(item => item.ret);
  return {
    annual, maxDrawdown,
    calmar: annual !== undefined && maxDrawdown < 0 ? annual / -maxDrawdown : undefined,
    yearly,
    yearAvg: rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : undefined,
    yearsUp: rets.filter(ret => ret > 0).length,
    worstYear: rets.length ? Math.min(...rets) : undefined,
  };
}
