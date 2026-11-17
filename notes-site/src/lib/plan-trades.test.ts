import { describe, expect, it } from 'vitest';
import { planCurveStats, planStats, planTrades, type PlanSignal } from './plan-trades';

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
  it('按每日盯市资金曲线算最大回撤、年化与逐年收益', () => {
    const curve = planCurveStats(planTrades(signals, bars), bars);
    // 资金曲线：1 → 1.2 → 1.2 → 0.9 → 1.26 → 1.35
    expect(curve.maxDrawdown).toBeCloseTo(-.25);
    expect(curve.yearly).toEqual([{ year: '2024', ret: expect.closeTo(.35) }]);
    expect(curve.annual).toBeCloseTo(1.35 ** (365.25 / 7) - 1);
    expect(curve.calmar).toBeCloseTo(curve.annual! / .25);
  });
  it('跨年拆分逐年收益，统计赚钱年数与最差一年', () => {
    const yb = [{ date: '2023-12-29', close: 10 }, { date: '2024-01-02', close: 11 }];
    const curve = planCurveStats(planTrades([sig('2023-12-29', 'buy', 10)], yb), yb);
    expect(curve.yearly.map(item => [item.year, +item.ret.toFixed(4)])).toEqual([['2023', 0], ['2024', .1]]);
    expect(curve.yearsUp).toBe(1);
    expect(curve.worstYear).toBe(0);
    expect(curve.maxDrawdown).toBe(0);
    expect(curve.calmar).toBeUndefined();
  });
});
