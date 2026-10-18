// notes-site/src/lib/etf-review.test.ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  noteKey, truncateNote, mergeMeta, poolCodes, filterByGroups,
  defaultMeta, isEtfReviewMeta, readMeta, writeMeta, addWatch, removeWatch,
  upsertDailyNote, setMemberships, clearReviewWorkspace, ETF_REVIEW_META_ID, SEED_TS, splitCloudItems, pushMeta,
} from './etf-review';
import {
  RECORDS_KEY, SYNC_KEY_STORAGE, readGridRecords, syncAll,
} from './grid-trading';

describe('etf-review domain', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

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
    expect(meta.updatedAt).toBe(SEED_TS);
  });

  it('clearReviewWorkspace uses a fresh LWW timestamp', () => {
    const cleared = clearReviewWorkspace();
    expect(cleared.updatedAt).not.toBe(SEED_TS);
    expect(Date.parse(cleared.updatedAt)).toBeGreaterThan(0);
  });

  it('readMeta reseeds empty groups without wiping workspace data', () => {
    const stored = {
      ...defaultMeta('2026-10-18T00:00:00.000Z'),
      groups: [],
      watchlist: [{ code: '510300', name: '沪深300', addedAt: '2026-10-18T00:00:00.000Z' }],
      memberships: { '510300': ['removed-group'] },
      notes: {
        '510300|2026-10-18': {
          emotion: '冷静' as const,
          conclusion: '看多' as const,
          action: '观望' as const,
          risk: '回撤',
          remark: '保留',
          updatedAt: '2026-10-18T00:00:00.000Z',
        },
      },
    };
    localStorage.setItem('etf-review-meta-v1', JSON.stringify(stored));

    const meta = readMeta();

    expect(meta.groups.map(group => group.name)).toEqual(['重点观察', '已持仓', '备选']);
    expect(meta.watchlist).toEqual(stored.watchlist);
    expect(meta.memberships).toEqual(stored.memberships);
    expect(meta.notes).toEqual(stored.notes);
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

  it('splitCloudItems separates meta from records and tombstones', () => {
    const meta = defaultMeta('2026-10-18T00:00:00.000Z');
    const record = { id: 'r1', savedAt: '2026-10-18T00:00:00.000Z', row: { code: '510300' }, result: {} };
    const tomb = { id: 'r2', savedAt: 't', updatedAt: 't', deleted: true as const };
    const { meta: found, records, tombstones } = splitCloudItems([meta, record, tomb]);
    expect(found?.id).toBe(ETF_REVIEW_META_ID);
    expect(records).toHaveLength(1);
    expect(tombstones).toHaveLength(1);
  });

  it('syncAll merges meta separately and never writes it into grid records', async () => {
    const localMeta = { ...defaultMeta('2026-10-17T00:00:00.000Z'), updatedAt: '2026-10-17T00:00:00.000Z' };
    const remoteMeta = { ...defaultMeta('2026-10-18T00:00:00.000Z'), updatedAt: '2026-10-18T00:00:00.000Z' };
    const record = { id: 'r1', savedAt: '2026-10-18T00:00:00.000Z', row: { code: '510300' }, result: {} };
    writeMeta(localMeta);
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: [remoteMeta, record] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const records = await syncAll('1234567890123456');

    expect(records).toEqual([record]);
    expect(readMeta()).toEqual(remoteMeta);
    expect(JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '[]')).toEqual([record]);
    const put = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(put.records).toEqual([record, remoteMeta]);
  });

  it('syncAll lets cloud meta replace a newly seeded empty workspace', async () => {
    const remoteMeta = {
      ...defaultMeta('2026-10-18T00:00:00.000Z'),
      updatedAt: '2026-10-18T00:00:00.000Z',
      notes: {
        '510300|2026-10-18': {
          emotion: '冷静' as const,
          conclusion: '看多' as const,
          action: '观望' as const,
          risk: '',
          remark: '云端笔记',
          updatedAt: '2026-10-18T00:00:00.000Z',
        },
      },
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: [remoteMeta] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await syncAll('1234567890123456');

    expect(readMeta()).toEqual(remoteMeta);
    const put = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(put.records).toEqual([remoteMeta]);
  });

  it('syncAll continues grid sync when meta storage writes fail', async () => {
    const record = { id: 'r1', savedAt: '2026-10-18T00:00:00.000Z', row: { code: '510300' }, result: {} };
    const remoteMeta = {
      ...defaultMeta('2026-10-18T00:00:00.000Z'),
      updatedAt: '2026-10-18T00:00:00.000Z',
    };
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'etf-review-meta-v1') throw new DOMException('blocked', 'SecurityError');
      return originalSetItem.call(this, key, value);
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: [remoteMeta, record] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    expect(await syncAll('1234567890123456')).toEqual([record]);
    expect(JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '[]')).toEqual([record]);
    const put = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(put.records).toEqual([record, remoteMeta]);
  });

  it('readGridRecords defensively excludes etf-review meta', () => {
    const record = { id: 'r1', savedAt: '2026-10-18T00:00:00.000Z', row: { code: '510300' }, result: {} };
    localStorage.setItem(RECORDS_KEY, JSON.stringify([record, defaultMeta('2026-10-18T00:00:00.000Z')]));
    expect(readGridRecords()).toEqual([record]);
  });

  it('pushMeta uploads the current workspace meta', async () => {
    localStorage.setItem(SYNC_KEY_STORAGE, '1234567890123456');
    const meta = defaultMeta('2026-10-18T00:00:00.000Z');
    writeMeta(meta);
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    expect(await pushMeta('复盘调整')).toBe('');
    const put = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(put.records).toEqual([meta]);
  });
});
