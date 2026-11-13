// notes-site/src/lib/etf-uptrend.test.ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS, TAG_KEYS, bit, filterRows, gridDetailHref, missingCats, nextSort, sortRows, tabCount,
  type Day, type Detail, type Filters,
} from './etf-uptrend';

const f = (...keys: (typeof TAG_KEYS)[number][]) => keys.reduce((s, k) => s | bit(k), 0);
const day: Day = {
  d: '2026-11-13',
  cats: [...TAG_KEYS],
  rows: [
    ['20:589200', '科创200ETF工银', f('new_pool', 'broad_index', 'unique_rep')],
    ['36:159253', '银行ETF博时', f('industry')],
    ['20:515020', '银行ETF华夏', f('industry', 'unique_rep', 't0')],
    ['20:560670', '银行ETF华泰柏瑞', f('trend_retracement', 'industry')],
  ],
};
const F = (o: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...o });
const codes = (rows: { 0: string }[]) => rows.map(r => r[0]);

describe('etf-uptrend filters', () => {
  it('分类与勾选项取交集', () => {
    expect(codes(filterRows(day, F({ tab: 'industry' }), new Set(), null))).toHaveLength(3);
    expect(codes(filterRows(day, F({ tab: 'industry', unique: true }), new Set(), null))).toEqual(['20:515020']);
    expect(codes(filterRows(day, F({ retr: true, newPool: true }), new Set(), null))).toEqual([]);
    expect(codes(filterRows(day, F({ tab: 't0' }), new Set(), null))).toEqual(['20:515020']);
  });

  it('自选、较上次新进、搜索', () => {
    expect(codes(filterRows(day, F({ tab: 'watch' }), new Set(['36:159253']), null))).toEqual(['36:159253']);
    const prev = new Set(['20:589200', '36:159253', '20:515020']);
    expect(codes(filterRows(day, F({ entered: true }), new Set(), prev))).toEqual(['20:560670']);
    expect(filterRows(day, F({ entered: true }), new Set(), null)).toEqual([]);
    expect(codes(filterRows(day, F({ q: '华夏' }), new Set(), null))).toEqual(['20:515020']);
    expect(codes(filterRows(day, F({ q: '5606' }), new Set(), null))).toEqual(['20:560670']);
  });

  it('旧快照缺少分类时明确报缺，而不是当作「否」', () => {
    const old: Day = { ...day, cats: ['trend_retracement', 'new_pool'] };
    expect(missingCats(old, F({ tab: 'broad_index', unique: true }))).toEqual(['broad_index', 'unique_rep']);
    expect(filterRows(old, F({ tab: 'broad_index' }), new Set(), null)).toEqual([]);
    expect(tabCount(old, 'industry', new Set())).toBeNull();
    expect(tabCount(day, 'industry', new Set())).toBe(3);
    expect(tabCount(old, 'all', new Set())).toBe(4);
  });
});

describe('etf-uptrend sorting', () => {
  const p = (start: string, dur: number | undefined) => ({ at: '', reasons: {}, periods: [{ start_day: start, end_day: '2026-11-12', duration: dur }] }) as Detail;
  const detail: Record<string, Detail> = { '20:589200': p('2026-11-04', 7), '36:159253': p('2026-09-29', 28), '20:560670': p('2026-09-30', 27) };

  it('降序 → 升序 → 原序；无数据的行在最后', () => {
    const s1 = nextSort(null, 'dur');
    expect(s1).toEqual({ key: 'dur', dir: 'desc' });
    expect(codes(sortRows(day.rows, s1, detail))).toEqual(['36:159253', '20:560670', '20:589200', '20:515020']);
    const s2 = nextSort(s1, 'dur');
    expect(codes(sortRows(day.rows, s2, detail))).toEqual(['20:589200', '20:560670', '36:159253', '20:515020']);
    expect(nextSort(s2, 'dur')).toBeNull();
    expect(sortRows(day.rows, null, detail)).toBe(day.rows);
    expect(nextSort(s2, 'start')).toEqual({ key: 'start', dir: 'desc' });
  });
});

describe('grid detail link', () => {
  it('编码代码与名称', () => {
    expect(gridDetailHref('/note/lab/grid-trading/detail', '159593', 'A50ETF平安'))
      .toBe('/note/lab/grid-trading/detail?code=159593&name=A50ETF%E5%B9%B3%E5%AE%89');
  });
});
