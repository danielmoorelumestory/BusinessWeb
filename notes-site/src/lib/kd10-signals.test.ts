import { describe, expect, it } from 'vitest';
import { bullLookup, kd10Signals, type Kd10Bar } from './kd10-signals';

const day = (i: number) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
// 带固定种子的随机游走，足够长以覆盖各种买卖情形
let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const bars: Kd10Bar[] = []; let price = 10;
for (let i = 0; i < 2500; i++) {
  const open = price * (1 + (rnd() - .5) * .01); price = open * (1 + (rnd() - .5) * .05);
  bars.push({ date: day(i), open, close: price, high: Math.max(open, price) * (1 + rnd() * .01), low: Math.min(open, price) * (1 - rnd() * .01) });
}

describe('kd10Signals', () => {
  const all = kd10Signals(bars, () => true);
  it('买卖交替、价格取开盘/收盘、T+1 顺延时为次日开盘卖', () => {
    expect(all.signals.length).toBeGreaterThan(20);
    let deferred = 0;
    all.signals.forEach((signal, index) => {
      expect(signal.side).toBe(index % 2 ? 'sell' : 'buy');
      const i = bars.findIndex(bar => bar.date === signal.date);
      if (signal.side === 'buy') { expect(signal.price).toBe(bars[i].open); expect(signal.signalDate).toBe(bars[i - 1].date); expect(['金叉', '站上10日线']).toContain(signal.reason); return; }
      expect(['死叉', '破10日线']).toContain(signal.reason);
      expect(signal.date > all.signals[index - 1].date).toBe(true);
      if (signal.signalDate !== signal.date) { deferred++; expect(signal.price).toBe(bars[i].open); expect(signal.signalDate).toBe(all.signals[index - 1].date); }
      else expect(signal.price).toBe(bars[i].close);
    });
    expect(all.signals.some(signal => signal.reason === '站上10日线')).toBe(true);
    expect(all.signals.some(signal => signal.reason === '破10日线')).toBe(true);
    expect(deferred).toBeGreaterThan(0);
  });
  it('择时为熊市时不开新仓', () => {
    expect(kd10Signals(bars, () => false).signals).toEqual([]);
    const half = bars[1200].date;
    const r = kd10Signals(bars, date => date >= half);
    expect(r.signals.filter(signal => signal.side === 'buy').every(signal => signal.signalDate >= half)).toBe(true);
  });
  it('择时无数据按牛市处理', () => {
    expect(kd10Signals(bars, () => undefined).signals).toEqual(all.signals);
  });
  it('预热期内不产生信号', () => {
    expect(all.signals.every(signal => signal.signalDate >= bars[120].date)).toBe(true);
  });
});

describe('bullLookup', () => {
  const look = bullLookup([{ date: '2024-01-03', bull: null }, { date: '2024-01-05', bull: true }, { date: '2024-01-08', bull: false }]);
  it('沿用之前最近一天，均线未形成或更早为 undefined', () => {
    expect(look('2024-01-02')).toBeUndefined();
    expect(look('2024-01-04')).toBeUndefined();
    expect(look('2024-01-05')).toBe(true);
    expect(look('2024-01-07')).toBe(true);
    expect(look('2024-01-09')).toBe(false);
  });
});
