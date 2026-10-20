// notes-site/src/lib/etf-review.test.ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  noteKey, truncateNote, mergeMeta, poolCodes, filterByGroups,
  defaultMeta, isEtfReviewMeta, readMeta, writeMeta, addWatch, removeWatch,
  upsertDailyNote, setMemberships, clearReviewWorkspace, ETF_REVIEW_META_ID, SEED_TS, splitCloudItems, pushMeta,
  orderedGroupCodes, moveGroupCode, captureDailyPremiums,
  restoreReviewBackup, ETF_REVIEW_HISTORY_KEY,
} from './etf-review';
import {
  RECORDS_KEY, SYNC_KEY_STORAGE, readGridRecords, syncAll, uploadAll, pullAll,
} from './grid-trading';

describe('etf-review domain', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('noteKey joins code and date', () => {
    expect(noteKey('510300', '2026-10-18')).toBe('510300|2026-10-18');
  });

  it('每日溢价按日期累积，当天更新，不冒用旧行情或回填历史笔记', () => {
    upsertDailyNote('513180', '2026-10-19', { emotion: '冷静', conclusion: '中性', action: '观望', risk: '', remark: '保留笔记' });
    const quote = { code: '513180', date: '2026-10-19', premiumRate: -.14, referenceNav: .5137 };
    expect(captureDailyPremiums([quote], '2026-10-19')).toBe(true);
    const first = readMeta();
    expect(first.dailyPremiums?.['513180|2026-10-19']?.rate).toBe(-.14);
    expect(first.dailyPremiums?.['513180|2026-10-18']).toBeUndefined();
    expect(first.notes['513180|2026-10-19'].remark).toBe('保留笔记');
    expect(captureDailyPremiums([quote], '2026-10-19')).toBe(false);
    expect(readMeta()).toEqual(first);
    expect(captureDailyPremiums([{ ...quote, premiumRate: 0 }], '2026-10-19')).toBe(true);
    expect(readMeta().dailyPremiums?.['513180|2026-10-19']?.rate).toBe(0);
    expect(captureDailyPremiums([quote], '2026-10-20')).toBe(false);
    expect(captureDailyPremiums([{ ...quote, date: '2026-10-20', premiumRate: .25 }], '2026-10-20')).toBe(true);
    const second = readMeta();
    expect(second.dailyPremiums?.['513180|2026-10-19']?.rate).toBe(0);
    expect(second.dailyPremiums?.['513180|2026-10-20']?.rate).toBe(.25);
    expect(mergeMeta(first, second).dailyPremiums).toEqual(second.dailyPremiums);
    expect(captureDailyPremiums([{ code: '600989', date: '2026-10-20' }, { ...quote, date: '2026-10-20', premiumRate: NaN }], '2026-10-20')).toBe(false);
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

  it('较新的溢价快照不能覆盖新增ETF、重命名分组、分组归属和逐条笔记', () => {
    const local = { ...defaultMeta('2026-10-18T00:00:00Z'), updatedAt: '2026-10-20T10:00:00Z', workspaceUpdatedAt: '2026-10-20T10:00:00Z',
      groups: [{ id: 'g-held', name: '重点观察', order: 0 }, { id: 'new', name: '指标性ETF', order: 1 }],
      deletedGroups: { 'g-focus': '2026-10-20T10:00:00Z', 'g-backup': '2026-10-20T10:00:00Z' },
      watchlist: [{ code: '588800', name: '科创100', addedAt: '2026-10-20T09:00:00Z' }], memberships: { '588800': ['new'] },
      notes: { '588800|2026-10-20': { emotion: '冷静' as const, conclusion: '中性' as const, action: '观望' as const, risk: '', remark: '保留笔记', updatedAt: '2026-10-20T09:00:00Z' } } };
    const remote = { ...defaultMeta('2026-10-18T00:00:00Z'), updatedAt: '2026-10-20T12:00:00Z', dailyPremiums: { '588800|2026-10-20': { rate: .2, quoteDate: '2026-10-20', updatedAt: '2026-10-20T12:00:00Z' } } };
    for (const merged of [mergeMeta(local, remote), mergeMeta(remote, local)]) {
      expect(merged.groups.map(group => group.name)).toEqual(['重点观察', '指标性ETF']);
      expect(merged.watchlist).toEqual(local.watchlist);
      expect(merged.memberships['588800']).toEqual(['new']);
      expect(merged.notes).toEqual(local.notes);
      expect(merged.dailyPremiums).toEqual(remote.dailyPremiums);
    }
  });

  it('显式删除不会被旧版本复活，重新添加仍可重新分组，清空也会保留意图', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-20T09:00:00Z'));
      addWatch('588800', '科创100'); setMemberships('588800', ['g-held']);
      const before = readMeta();
      vi.setSystemTime(new Date('2026-10-20T10:00:00Z')); removeWatch('588800');
      expect(mergeMeta(readMeta(), before).watchlist.some(watch => watch.code === '588800')).toBe(false);
      vi.setSystemTime(new Date('2026-10-20T11:00:00Z')); addWatch('588800', '科创100'); setMemberships('588800', ['g-held']);
      expect(mergeMeta(readMeta(), before).memberships['588800']).toEqual(['g-held']);
      const cleared = clearReviewWorkspace();
      expect(mergeMeta(before, cleared).watchlist).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  it('覆盖前自动留存本机历史；恢复完整备份保留分组、标的和笔记', () => {
    addWatch('588800', '科创100'); setMemberships('588800', ['g-held']);
    const backup = readMeta();
    clearReviewWorkspace();
    const history = JSON.parse(localStorage.getItem(ETF_REVIEW_HISTORY_KEY) ?? '[]');
    expect(history.some((item: { meta: typeof backup }) => item.meta.watchlist.some(watch => watch.code === '588800'))).toBe(true);
    const restored = restoreReviewBackup(backup);
    expect(restored.watchlist).toEqual(backup.watchlist);
    expect(restored.memberships).toEqual(backup.memberships);
    expect(mergeMeta(restored, clearReviewWorkspace()).watchlist).toEqual([]);
    expect(() => restoreReviewBackup({})).toThrow('不是有效');
  });

  it('云端请求进行中新增的本机ETF不会被同步开始时的旧快照覆盖', async () => {
    const original = readMeta();
    let complete: (response: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      if (options?.method === 'PUT') return Promise.resolve(new Response(null, { status: 200 }));
      return new Promise(resolve => { complete = resolve; });
    });
    const syncing = syncAll('1234567890123456');
    addWatch('588800', '科创100'); setMemberships('588800', ['g-held']);
    complete(new Response(JSON.stringify({ records: [original] }), { status: 200 }));
    await syncing;
    expect(readMeta().watchlist.some(watch => watch.code === '588800')).toBe(true);
    expect(readMeta().memberships['588800']).toEqual(['g-held']);
  });

  it('上传仅PUT本机快照，不拉取也不改写本机', async () => {
    addWatch('588800', '科创100'); setMemberships('588800', ['g-held']);
    const meta = localStorage.getItem('etf-review-meta-v1');
    const record = { id: 'r-local', savedAt: '2026-10-20T10:00:00Z', row: { code: '510300' }, result: {} };
    localStorage.setItem(RECORDS_KEY, JSON.stringify([record]));
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ skipped: [] }), { status: 200 }));
    expect(await uploadAll('1234567890123456')).toMatchObject({ uploaded: 2, skipped: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).toBe('PUT');
    const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(payload.records).toContainEqual(record);
    expect(localStorage.getItem('etf-review-meta-v1')).toBe(meta);
    expect(readGridRecords()).toEqual([record]);
  });

  it('拉取仅GET并安全合并到本机，保留本机新增ETF，不回写云端', async () => {
    addWatch('588800', '科创100'); setMemberships('588800', ['g-held']);
    const remote = { ...defaultMeta('2026-10-18T00:00:00Z'), updatedAt: '2026-10-20T12:00:00Z', watchlist: [{ code: '159687', name: '亚太精选', addedAt: '2026-10-20T09:00:00Z' }] };
    const record = { id: 'r-cloud', savedAt: '2026-10-20T12:00:00Z', row: { code: '510300' }, result: {} };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ records: [remote, record] }), { status: 200 }));
    await pullAll('1234567890123456');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
    const codes = readMeta().watchlist.map(watch => watch.code);
    expect(codes).toEqual(expect.arrayContaining(['159687', '588800']));
    expect(readMeta().memberships['588800']).toEqual(['g-held']);
    expect(readGridRecords()).toEqual([record]);
  });

  it('上传或拉取网络失败均不改写本机数据', async () => {
    addWatch('588800', '科创100');
    const before = localStorage.getItem('etf-review-meta-v1');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('failed', { status: 503 }));
    await expect(uploadAll('1234567890123456')).rejects.toThrow('上传失败');
    await expect(pullAll('1234567890123456')).rejects.toThrow('读取云端记录失败');
    expect(localStorage.getItem('etf-review-meta-v1')).toBe(before);
  });

  it('poolCodes unions grid and watchlist uniquely', () => {
    expect(poolCodes(['510300', '159915'], [{ code: '159915' }, { code: '588000' }]).sort())
      .toEqual(['159915', '510300', '588000']);
  });

  it('组内移动持久保存且各组互不影响，兼容新增和删除标的', () => {
    const codes = ['510300', '159915', '588000'];
    expect(orderedGroupCodes(codes)).toEqual(codes);
    const original = readMeta();
    moveGroupCode('g-focus', codes, '588000', -1);
    expect(readMeta().groupCodeOrder?.['g-focus']).toEqual(['510300', '588000', '159915']);
    moveGroupCode('g-focus', codes, '588000', -1);
    const saved = readMeta();
    expect(orderedGroupCodes(codes, saved.groupCodeOrder?.['g-focus'])).toEqual(['588000', '510300', '159915']);
    expect(orderedGroupCodes(codes, saved.groupCodeOrder?.['g-held'])).toEqual(codes);
    expect(saved.memberships).toEqual(original.memberships);
    expect(saved.notes).toEqual(original.notes);
    expect(orderedGroupCodes(['510300', '159915', '513180'], saved.groupCodeOrder?.['g-focus'])).toEqual(['510300', '159915', '513180']);
    expect(mergeMeta(original, saved).groupCodeOrder).toEqual(saved.groupCodeOrder);
    moveGroupCode('g-focus', codes, '588000', -1);
    expect(readMeta()).toEqual(saved);
    moveGroupCode('', codes, '510300', 1);
    expect(readMeta().groupCodeOrder?.['']).toEqual(['159915', '510300', '588000']);
    expect(readMeta().groupCodeOrder?.['g-focus']).toEqual(saved.groupCodeOrder?.['g-focus']);
    const before = readMeta();
    moveGroupCode('', codes, '588000', 1);
    moveGroupCode('', codes, 'missing', 1);
    expect(readMeta()).toEqual(before);
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
    expect(meta.groups.map(g => g.name).slice(0, 3)).toEqual(['重点观察', '已持仓', '备选']);
    expect(meta.groups.some(g => g.id === 'g-catalog-broad')).toBe(false);
    expect(meta.groups.some(g => g.id === 'g-catalog-ETF-01_TMT科技')).toBe(true);
    expect(meta.groups.some(g => g.id === 'g-catalog-other')).toBe(true);
    expect(meta.groups.some(g => g.id === 'g-catalog-industry')).toBe(false);
    expect(meta.watchlist.some(w => w.code === '588200')).toBe(true);
    expect(meta.memberships['588200']).toContain('g-catalog-ETF-01_TMT科技');
    expect(meta.updatedAt).toBe(SEED_TS);
  });

  it('readMeta does not revive removeWatch codes', () => {
    readMeta();
    removeWatch('510300');
    expect(readMeta().watchlist.some(w => w.code === '510300')).toBe(false);
  });

  it('readMeta skips catalog membership after setMemberships opt-out', () => {
    readMeta();
    setMemberships('588200', ['g-held']);
    expect(readMeta().memberships['588200']).toEqual(['g-held']);
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

    expect(meta.groups.map(group => group.name).slice(0, 3)).toEqual(['重点观察', '已持仓', '备选']);
    expect(meta.groups.some(group => group.id === 'g-catalog-ETF-01_TMT科技')).toBe(true);
    expect(meta.groups.some(group => group.id === 'g-catalog-broad')).toBe(false);
    expect(meta.watchlist.some(watch => watch.code === '510300')).toBe(true);
    expect(meta.memberships['510300']).toEqual(['removed-group']);
    expect(meta.notes).toEqual(stored.notes);
  });

  it('addWatch rejects bad code; removeWatch drops memberships', () => {
    expect(() => addWatch('12', 'x')).toThrow();
    addWatch('510300', '沪深300');
    setMemberships('510300', [readMeta().groups[0].id]);
    removeWatch('510300');
    expect(readMeta().watchlist.some(watch => watch.code === '510300')).toBe(false);
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
    const merged = readMeta();
    expect(merged.updatedAt).toBe(remoteMeta.updatedAt);
    expect(merged.groups.some(group => group.id === 'g-catalog-ETF-01_TMT科技')).toBe(true);
    expect(JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '[]')).toEqual([record]);
    const put = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(put.records[0]).toEqual(record);
    expect(put.records.some((item: { kind?: string }) => item.kind === 'etf-review-meta')).toBe(true);
    expect(put.records.every((item: { id?: string; row?: unknown }) => item.id !== remoteMeta.id || !('row' in item))).toBe(true);
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

    const merged = readMeta();
    expect(merged.notes).toEqual(remoteMeta.notes);
    expect(merged.updatedAt).toBe(remoteMeta.updatedAt);
    expect(merged.groups.some(group => group.id === 'g-catalog-ETF-01_TMT科技')).toBe(true);
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
    const current = readMeta();
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    expect(await pushMeta('复盘调整')).toBe('');
    const put = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(put.records).toEqual([current]);
  });
});
