import { describe, expect, it } from 'vitest';
import { macdCloseSignals, windowBounds } from './macd-signals';
import { backtestPlan, backtestPlanYearly, planStats, planTrades, PLAN_COST, PLAN_WARMUP, type PlanSignal } from './plan-trades';

const bars = ['2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08', '2024-01-09'].map((date, i) => ({ date, close: 10 + i }));
const sig = (date: string, side: 'buy' | 'sell', price: number): PlanSignal => ({ date, side, price, signalDate: date, reason: side === 'buy' ? '金叉' : '死叉' });
const signals = [sig('2024-01-02', 'buy', 10), sig('2024-01-03', 'sell', 12), sig('2024-01-04', 'buy', 12), sig('2024-01-05', 'sell', 9), sig('2024-01-08', 'buy', 10)];

describe('plan-trades', () => {
  it('配对成交易，最后一笔按区间末收盘计浮动', () => {
    const trades = planTrades(signals, bars);
    expect(trades.map(trade => [trade.open, +trade.ret.toFixed(4)])).toEqual([[false, .2], [false, -.25], [true, .5]]);
  });
  it('统计胜率、盈亏比与复利累计，持仓中不计入已完成', () => {
    const stats = planStats(planTrades(signals, bars));
    expect(stats.trades).toBe(2);
    expect(stats.winRate).toBe(.5);
    expect(stats.payoff).toBeCloseTo(.2 / .25);
    expect(stats.total).toBeCloseTo(1.2 * .75 - 1);
    expect(stats.open?.buyDate).toBe('2024-01-08');
  });
  it('区间只算买入日在区间内的；卖出晚于区间末的按区间末收盘计浮动', () => {
    const trades = planTrades(signals, bars, '2024-01-04', '2024-01-04');
    expect(trades).toEqual([{ buyDate: '2024-01-04', buyPrice: 12, sellPrice: 12, ret: 0, open: true }]);
  });
  it('研究口径窗口回测：首日空仓、第 121 根起交易、末日强制平仓，逐笔扣单边 0.1%', () => {
    const wave = Array.from({ length: 700 }, (_, i) => {
      const day = new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
      const close = 10 + 3 * Math.sin(i / 15) + i * .01;
      return { date: day, open: close * .998, high: close * 1.01, low: close * .99, close };
    });
    const bull = () => true;
    const window = { from: '2020-06-01', to: '2021-03-31' };
    const signals = macdCloseSignals(wave, { warmup: PLAN_WARMUP, bull, window }).signals;
    expect(signals[0].side).toBe('buy');
    expect(signals.every(signal => signal.date >= '2020-06-01' && signal.date <= '2021-03-31')).toBe(true);
    expect(signals.at(-1)!.side).toBe('sell');
    const result = backtestPlan('hs', wave, bull, window)!;
    const net = signals.filter(signal => signal.side === 'sell').map((sell, k) => sell.price * (1 - PLAN_COST) / (signals.filter(x => x.side === 'buy')[k].price * (1 + PLAN_COST)));
    expect(result.total).toBeCloseTo(net.reduce((a, b) => a * b, 1) - 1, 10);
    expect(result.natural).toBe(signals.filter(signal => signal.side === 'sell' && !signal.forced).length);
    expect(result.mdd).toBeLessThan(0);
  });
  it('窗口内可交易日不足 120 根不出结果；逐年回测跳过不足的年份', () => {
    const flat = Array.from({ length: 400 }, (_, i) => ({ date: new Date(Date.UTC(2020, 6, 1) + i * 86_400_000).toISOString().slice(0, 10), open: 10, high: 10, low: 10, close: 10 }));
    expect(windowBounds(flat, PLAN_WARMUP, { from: '2020-01-01', to: '2020-12-31' })).toEqual([120, 183]);
    expect(backtestPlan('hs', flat, () => true, { from: '2020-01-01', to: '2020-12-31' })).toBeUndefined();
    const yearly = backtestPlanYearly('hs', flat, () => true);
    expect(yearly.map(item => item.year)).toEqual([2021]);
    expect(yearly[0].result.total).toBe(0);
    expect(yearly[0].result.hold).toBeCloseTo((1 - PLAN_COST) / (1 + PLAN_COST) - 1, 12);
  });
  it('纯MACD 不看择时：择时全为熊市也照常交易，结果与牛市沪深300方案相同', () => {
    const wave = Array.from({ length: 500 }, (_, i) => {
      const day = new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
      const close = 10 + 3 * Math.sin(i / 15);
      return { date: day, open: close, high: close * 1.01, low: close * .99, close };
    });
    const macd = backtestPlan('macd', wave, () => false)!;
    expect(macd.natural).toBeGreaterThan(0);
    expect(macd.total).toBeCloseTo(backtestPlan('hs', wave, () => true)!.total, 12);
    expect(backtestPlan('hs', wave, () => false)!.natural).toBe(0);
  });
});
