import { describe, expect, it } from 'vitest';
import { etfBand, isLiveBar, macdCrossPrice, macdEstimate, macdSeries, maCrossPriceAt, maEstimate } from './chart-indicators';

describe('etfBand', () => {
  it('前 13 根没有完整窗口时为 null，之后为上涨路程占比', () => {
    const closes = [10, 11, 10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17];
    const band = etfBand(closes);
    expect(band.slice(0, 13).every(value => value === null)).toBe(true);
    // 13 次变化：上涨 7 次 × 每次 +1、+2…；直接按定义计算
    let up = 0, total = 0;
    for (let k = 1; k < 14; k++) { const d = closes[k] - closes[k - 1]; up += Math.max(d, 0); total += Math.abs(d); }
    expect(band[13]).toBeCloseTo(100 * up / total, 10);
  });
  it('13 次变化全为 0 时返回 null，不填 50', () => {
    expect(etfBand(Array(20).fill(1)).at(-1)).toBeNull();
  });
  it('U=0.162、A=0.305 时为 53.115（588060 截图读数的比例）', () => {
    // 窗口内只有比例有意义：构造 U=0.162、A=0.305 的 13 次变化
    const changes = [0.05, 0.04, 0.03, 0.02, 0.012, 0.01, -0.03, -0.03, -0.03, -0.02, -0.02, -0.013, -0.0];
    const closes = [1]; changes.forEach(change => closes.push(closes.at(-1)! + change));
    expect(etfBand(closes).at(-1)).toBeCloseTo(100 * 0.162 / (0.162 + 0.143), 6);
  });
});

describe('macd', () => {
  it('临界价代入下一根收盘后 DIF 正好等于 DEA', () => {
    const closes = Array.from({ length: 120 }, (_, i) => 10 + Math.sin(i / 7) + i * 0.01);
    const price = macdCrossPrice(macdSeries(closes))!;
    const next = macdSeries([...closes, price]);
    expect(next.dif.at(-1)! - next.dea.at(-1)!).toBeCloseTo(0, 10);
    const above = macdSeries([...closes, price * 1.01]);
    expect(above.dif.at(-1)! > above.dea.at(-1)!).toBe(true);
  });
  it('柱子为 2×(DIF−DEA)', () => {
    const s = macdSeries([1, 2, 3, 2, 4, 5, 3]);
    s.hist.forEach((value, i) => expect(value).toBeCloseTo(2 * (s.dif[i] - s.dea[i]), 12));
  });
});

describe('macdEstimate', () => {
  const bars = Array.from({ length: 80 }, (_, i) => ({ date: `2026-01-${String(i).padStart(2, '0')}`, close: 10 + Math.sin(i / 6) }));
  it('收盘后用最后一根，估下一交易日', () => {
    const e = macdEstimate(bars, false)!;
    expect(e.forToday).toBe(false);
    expect(e.basisDate).toBe(bars.at(-1)!.date);
    expect(e.price).toBeCloseTo(macdCrossPrice(macdSeries(bars.map(b => b.close)))!, 12);
  });
  it('盘中用昨天收盘后的状态，估今天收盘', () => {
    const e = macdEstimate(bars, true)!;
    expect(e.forToday).toBe(true);
    expect(e.basisDate).toBe(bars.at(-2)!.date);
    expect(e.price).toBeCloseTo(macdCrossPrice(macdSeries(bars.slice(0, -1).map(b => b.close)))!, 12);
  });
  it('日线不足时不给预估', () => { expect(macdEstimate(bars.slice(0, 20), false)).toBeUndefined(); });
  it('15:00 前的今天为盘中，之后不是', () => {
    expect(isLiveBar('2026-11-13', new Date('2026-11-13T05:00:00Z'))).toBe(true);   // 北京 13:00
    expect(isLiveBar('2026-11-13', new Date('2026-11-13T07:30:00Z'))).toBe(false);  // 北京 15:30
    expect(isLiveBar('2026-11-12', new Date('2026-11-13T05:00:00Z'))).toBe(false);
  });
});

describe('maEstimate', () => {
  const closes = [10, 10.2, 10.1, 10.4, 10.6, 10.5, 10.8, 10.9, 11, 11.2, 11.1, 11.3];
  const bars = closes.map((close, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, close }));
  it('临界价收盘时恰好等于新的 10 日均线', () => {
    const p = maCrossPriceAt(closes, 10, closes.length - 1)!;
    const next = [...closes.slice(-9), p];
    expect(next.reduce((a, b) => a + b, 0) / 10).toBeCloseTo(p, 10);
  });
  it('收盘后用最后一根；盘中用前一根且对照现价', () => {
    const after = maEstimate(bars, 10, false)!;
    expect(after.above).toBe(true);
    expect(after.basisDate).toBe('2026-01-12');
    expect(after.price).toBeCloseTo(closes.slice(-9).reduce((a, b) => a + b, 0) / 9, 10);
    const live = maEstimate(bars, 10, true)!;
    expect(live.basisDate).toBe('2026-01-11');
    expect(live.forToday).toBe(true);
    expect(live.lastClose).toBe(11.3);
  });
  it('日线不足返回 undefined', () => {
    expect(maEstimate(bars.slice(0, 9), 10, false)).toBeUndefined();
  });
});
