import { describe, expect, it } from 'vitest';
import { planStats, planTrades, type PlanSignal } from './plan-trades';

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
});
