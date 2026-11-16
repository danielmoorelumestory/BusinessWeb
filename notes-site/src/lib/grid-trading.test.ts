import { describe, expect, it } from 'vitest';

describe('mergeQuoteByChange', () => {
  it('按当日涨跌幅把实时报价换算到后复权口径', async () => {
    const { mergeQuoteByChange } = await import('./grid-trading');
    const candles = [{ date: '2026-11-12', open: 4, high: 4, low: 4, close: 4 }];
    const quote = { code: '510880', name: '', price: 3.1, open: 3, high: 3.2, low: 3, date: '2026-11-13', changePercent: 2.5 };
    const merged = mergeQuoteByChange(candles, quote);
    expect(merged).toHaveLength(2);
    expect(merged[1].close).toBeCloseTo(4.1);
    // 当天已在日线里：用前一根换算并覆盖收盘
    const again = mergeQuoteByChange(merged, { ...quote, changePercent: -1 });
    expect(again).toHaveLength(2);
    expect(again[1].close).toBeCloseTo(3.96);
    // 没有涨跌幅不并入
    expect(mergeQuoteByChange(candles, { ...quote, changePercent: undefined })).toBe(candles);
  });
});
