import { describe, expect, it } from 'vitest';
import { isMacdGolden, isPriceAboveAllMa, macdCrossState, matchesReviewFilters, setReviewRecord } from './review-analysis';
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

const macdState = (close: number, ma10: number, dif: number | null, dea: number | null) =>
  ({ asOf: '2026-11-06', close, ma5: null, ma10, ma20: null, dif, dea });

describe('MACD 金叉/死叉筛选', () => {
  // 日线 DIF > DEA（金叉状态）、周线 DIF < DEA（死叉状态）
  setReviewRecord('999101', { applicable: true, day: macdState(10, 9, 0.2, 0.1), week: macdState(10, 9, -0.1, 0.05), month: macdState(10, 9, null, null) } as unknown as ReviewRecord);

  it('DIF 在 DEA 之上才算金叉', () => {
    expect(isMacdGolden('999101', 'day')).toBe(true);
    expect(isMacdGolden('999101', 'week')).toBe(false);
  });

  it('缺少 MACD 数据或无记录时不命中', () => {
    expect(isMacdGolden('999101', 'month')).toBe(false);
    expect(isMacdGolden('999405', 'day')).toBe(false);
  });

  it('DIF 在 DEA 之下为死叉，缺数据既不算金叉也不算死叉', () => {
    expect(macdCrossState('999101', 'week')).toBe('dead');
    expect(macdCrossState('999101', 'month')).toBe(null);
    expect(matchesReviewFilters('999101', ['macd:month:dead'])).toBe(false);
  });

  it('与均线条件同时选中时需全部满足', () => {
    expect(matchesReviewFilters('999101', [])).toBe(true);
    expect(matchesReviewFilters('999101', ['macd:day:golden', 'day:10'])).toBe(true);
    expect(matchesReviewFilters('999101', ['macd:day:golden', 'macd:week:dead'])).toBe(true);
    expect(matchesReviewFilters('999101', ['macd:day:golden', 'macd:week:golden'])).toBe(false);
    expect(matchesReviewFilters('999101', ['macd:week:golden', 'day:10'])).toBe(false);
  });
});

describe('KDJ K−D 筛选', () => {
  const kd = (kdjK: number | null, kdjD: number | null) => ({ asOf: '2026-11-06', close: 10, ma5: null, ma10: 9, ma20: null, dif: 1, dea: 0.5, kdjK, kdjD });
  setReviewRecord('999201', { applicable: true, day: kd(70, 60), week: kd(50, 49), month: kd(null, null) } as unknown as ReviewRecord);
  setReviewRecord('999202', { applicable: true, day: kd(55, 52), week: kd(50, 49), month: kd(null, null) } as unknown as ReviewRecord);
  it('K−D 达到阈值才命中', () => {
    expect(matchesReviewFilters('999201', ['kd:day:5.3'])).toBe(true);
    expect(matchesReviewFilters('999202', ['kd:day:5.3'])).toBe(false);
  });
  it('缺少 KDJ 数据视为不命中，可与 MACD 组合', () => {
    expect(matchesReviewFilters('999201', ['kd:month:5.3'])).toBe(false);
    expect(matchesReviewFilters('999201', ['kd:day:5.3', 'macd:day:golden'])).toBe(true);
    expect(matchesReviewFilters('999201', ['kd:day:5.3', 'macd:day:dead'])).toBe(false);
  });
});
