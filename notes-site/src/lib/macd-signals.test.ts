import { describe, expect, it } from 'vitest';
import { macdCloseSignals, type MacdBar } from './macd-signals';

const day = (i: number) => new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
// 正弦价格：周期性产生金叉、死叉。开盘价与收盘价不同，便于区分成交价。
const bars: MacdBar[] = Array.from({ length: 300 }, (_, i) => { const close = 10 + Math.sin(i / 12) * 2; return { date: day(i), open: close + .05, close }; });

describe('macdCloseSignals', () => {
  it('买在金叉次日开盘、卖在死叉当日收盘，且买卖交替', () => {
    const { signals } = macdCloseSignals(bars, { warmup: 30 });
    expect(signals.length).toBeGreaterThan(4);
    signals.forEach((signal, index) => {
      expect(signal.side).toBe(index % 2 ? 'sell' : 'buy');
      const i = bars.findIndex(bar => bar.date === signal.date);
      if (signal.side === 'buy') { expect(signal.price).toBe(bars[i].open); expect(signal.signalDate).toBe(bars[i - 1].date); }
      else { expect(signal.price).toBe(bars[i].close); expect(signal.signalDate).toBe(signal.date); }
    });
  });

  it('预热期内不产生信号', () => {
    const { signals } = macdCloseSignals(bars, { warmup: 120 });
    expect(signals.every(signal => signal.signalDate >= bars[120].date)).toBe(true);
  });

  it('最后一根金叉时给出待买提示', () => {
    const { signals } = macdCloseSignals(bars, { warmup: 30 });
    const firstBuy = signals.find(signal => signal.side === 'buy')!;
    const cut = bars.slice(0, bars.findIndex(bar => bar.date === firstBuy.date));
    const result = macdCloseSignals(cut, { warmup: 30 });
    expect(result.pendingBuy?.signalDate).toBe(cut.at(-1)!.date);
    expect(result.holding).toBe(false);
  });

  it('空数据', () => {
    expect(macdCloseSignals([])).toEqual({ signals: [], holding: false });
  });
});
