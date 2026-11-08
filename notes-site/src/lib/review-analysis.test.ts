import { describe, expect, it } from 'vitest';
import { isPriceAboveAllMa, setReviewRecord } from './review-analysis';
import type { ReviewRecord } from './review-technical';

const state = (close: number, ma5: number | null, ma10: number | null, ma20: number | null) =>
  ({ asOf: '2026-11-06', close, ma5, ma10, ma20 });

const record = (day: ReturnType<typeof state>, week: ReturnType<typeof state>) =>
  ({ applicable: true, day, week, month: state(10, null, null, null) } as unknown as ReviewRecord);

describe('isPriceAboveAllMa', () => {
  setReviewRecord('999001', record(state(10, 9, 11, 8), state(10, 9, 9, 9)));

  it('未选择条件时不过滤', () => {
    expect(isPriceAboveAllMa('999001', [])).toBe(true);
  });

  it('多个条件全部站上才命中', () => {
    expect(isPriceAboveAllMa('999001', ['day:5', 'week:5', 'week:20'])).toBe(true);
  });

  it('只要有一个条件未站上就不命中', () => {
    expect(isPriceAboveAllMa('999001', ['day:5', 'day:10'])).toBe(false);
  });

  it('缺少均线数据的条件视为未站上', () => {
    expect(isPriceAboveAllMa('999001', ['day:5', 'month:5'])).toBe(false);
    expect(isPriceAboveAllMa('999404', ['day:5'])).toBe(false);
  });
});
