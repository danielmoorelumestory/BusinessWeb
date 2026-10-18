// notes-site/src/lib/etf-review.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import {
  noteKey, truncateNote, mergeMeta, poolCodes, filterByGroups,
  defaultMeta, isEtfReviewMeta, readMeta, writeMeta, addWatch, removeWatch,
  upsertDailyNote, setMemberships, ETF_REVIEW_META_ID,
} from './etf-review';

describe('etf-review domain', () => {
  beforeEach(() => localStorage.clear());

  it('noteKey joins code and date', () => {
    expect(noteKey('510300', '2026-10-18')).toBe('510300|2026-10-18');
  });

  it('truncateNote cuts risk and remark', () => {
    const note = truncateNote({
      emotion: '冷静', conclusion: '看多', action: '观望',
      risk: 'x'.repeat(250), remark: 'y'.repeat(600), updatedAt: '2026-10-18T00:00:00.000Z',
    });
    expect(note.risk).toHaveLength(200);
    expect(note.remark).toHaveLength(500);
  });

  it('mergeMeta prefers newer updatedAt', () => {
    const older = { ...defaultMeta('2026-01-01T00:00:00.000Z'), updatedAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...defaultMeta('2026-02-01T00:00:00.000Z'), updatedAt: '2026-02-01T00:00:00.000Z',
      notes: { '510300|2026-02-01': { emotion: '冷静', conclusion: '看多', action: '加仓', risk: '', remark: 'n', updatedAt: '2026-02-01T00:00:00.000Z' } } };
    expect(mergeMeta(older, newer).notes['510300|2026-02-01']?.remark).toBe('n');
    expect(mergeMeta(newer, older).notes['510300|2026-02-01']?.remark).toBe('n');
  });

  it('poolCodes unions grid and watchlist uniquely', () => {
    expect(poolCodes(['510300', '159915'], [{ code: '159915' }, { code: '588000' }]).sort())
      .toEqual(['159915', '510300', '588000']);
  });

  it('filterByGroups OR-matches selected tags', () => {
    const memberships = { a: ['g1'], b: ['g2'], c: ['g1', 'g2'] };
    expect(filterByGroups(['a', 'b', 'c'], memberships, []).sort()).toEqual(['a', 'b', 'c']);
    expect(filterByGroups(['a', 'b', 'c'], memberships, ['g1']).sort()).toEqual(['a', 'c']);
  });

  it('isEtfReviewMeta recognizes meta id and kind', () => {
    expect(isEtfReviewMeta({ id: ETF_REVIEW_META_ID, kind: 'etf-review-meta' })).toBe(true);
    expect(isEtfReviewMeta({ id: 'x', row: {}, result: {} })).toBe(false);
  });

  it('readMeta seeds default groups when empty', () => {
    const meta = readMeta();
    expect(meta.groups.map(g => g.name)).toEqual(['重点观察', '已持仓', '备选']);
  });

  it('addWatch rejects bad code; removeWatch drops memberships', () => {
    expect(() => addWatch('12', 'x')).toThrow();
    addWatch('510300', '沪深300');
    setMemberships('510300', [readMeta().groups[0].id]);
    removeWatch('510300');
    expect(readMeta().watchlist).toEqual([]);
    expect(readMeta().memberships['510300']).toBeUndefined();
  });

  it('upsertDailyNote overwrites same code|date', () => {
    upsertDailyNote('510300', '2026-10-18', { emotion: '冷静', conclusion: '看多', action: '观望', risk: 'r', remark: 'a' });
    upsertDailyNote('510300', '2026-10-18', { emotion: '犹豫', conclusion: '中性', action: '减仓', risk: '', remark: 'b' });
    const note = readMeta().notes['510300|2026-10-18'];
    expect(note?.remark).toBe('b');
    expect(note?.emotion).toBe('犹豫');
  });
});
