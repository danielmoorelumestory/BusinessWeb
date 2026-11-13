import { describe, expect, it } from 'vitest';
import { mergeQuote, type Candle, type Quote } from './grid-trading';

const quote: Quote = { code: '512100', name: '中证1000ETF', price: 2.6, open: 2.65, high: 2.7, low: 2.55, date: '2026-11-13', volume: 2000 };

describe('mergeQuote 成交量', () => {
  it('追加当日K线时带上实时成交量', () => {
    const candles: Candle[] = [{ date: '2026-11-12', open: 2.7, close: 2.65, high: 2.73, low: 2.64, volume: 1500 }];
    expect(mergeQuote(candles, quote).at(-1)).toEqual({ date: '2026-11-13', open: 2.65, close: 2.6, high: 2.7, low: 2.55, volume: 2000 });
  });
  it('合并已有当日K线时取较大的累计量', () => {
    const candles: Candle[] = [{ date: '2026-11-13', open: 2.66, close: 2.62, high: 2.68, low: 2.6, volume: 1800 }];
    expect(mergeQuote(candles, quote)[0].volume).toBe(2000);
    expect(mergeQuote(candles, { ...quote, volume: 1000 })[0].volume).toBe(1800);
  });
  it('都没有成交量时不凭空补 0', () => {
    const candles: Candle[] = [{ date: '2026-11-13', open: 2.66, close: 2.62, high: 2.68, low: 2.6 }];
    expect('volume' in mergeQuote(candles, { ...quote, volume: undefined })[0]).toBe(false);
  });
});
