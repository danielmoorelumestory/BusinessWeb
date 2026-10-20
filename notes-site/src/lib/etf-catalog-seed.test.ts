import { describe, expect, it } from 'vitest';
import { defaultMeta } from './etf-review-meta';
import {
  BROAD_CATALOG_GROUP_ID,
  OTHER_CATALOG_GROUP_ID,
  buildCatalogGroups,
  ensureCatalogSeed,
  fundProfileUrl,
  isCatalogGroupId,
} from './etf-catalog-seed';
import industry from '../../../src/data/industryEtf.json';
import strategy from '../../../src/data/strategyAssetEtf.json';

describe('etf-catalog-seed', () => {
  it('buildCatalogGroups: 与 industry-etf 逐组对账——名字、代码、数量全量一致', () => {
    const groups = buildCatalogGroups();
    expect(groups.map(group => group.id)).not.toContain(BROAD_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain(OTHER_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain('g-catalog-industry');
    expect(groups.map(group => group.id)).not.toContain('g-catalog-bond-funds');

    for (const group of industry as { id: string; name: string; items: { code: string; name: string }[] }[]) {
      const seeded = groups.find(item => item.id === `g-catalog-${group.id}`);
      expect(seeded, group.name).toBeTruthy();
      expect(seeded!.name).toBe(group.name);
      expect(seeded!.items.map(item => item.code)).toEqual(group.items.map(item => item.code));
      expect(seeded!.items.map(item => item.name)).toEqual(group.items.map(item => item.name));
    }

    for (const group of strategy as { id: string; title: string; items: { code: string; name: string }[] }[]) {
      if (!['strategy-etf', 'commodity-etf', 'money-etf'].includes(group.id)) {
        expect(groups.some(item => item.id === `g-catalog-${group.id}`)).toBe(false);
        continue;
      }
      const seeded = groups.find(item => item.id === `g-catalog-${group.id}`)!;
      expect(seeded.name).toBe(group.title);
      expect(seeded.items.map(item => item.code)).toEqual(group.items.map(item => item.code));
      expect(seeded.items.map(item => item.name)).toEqual(group.items.map(item => item.name));
    }

    const agri = groups.find(group => group.id === 'g-catalog-ETF-07_农业周期')!;
    expect(agri.items.map(item => item.code)).toEqual(['159698', '159865']);
    expect(agri.items.map(item => item.name)).toEqual(['粮食ETF鹏华', '养殖ETF国泰']);
  });

  it('ensureCatalogSeed fills empty meta; gap-fill 不受 membershipUpdatedAt 阻挡', () => {
    const empty = defaultMeta('2026-10-20T00:00:00.000Z');
    const { meta: filled, changed } = ensureCatalogSeed(empty);
    expect(changed).toBe(true);
    expect(filled.groups.filter(group => isCatalogGroupId(group.id))).toHaveLength(10);
    expect(filled.memberships['159865']).toContain('g-catalog-ETF-07_农业周期');
    expect(filled.memberships['159698']).toContain('g-catalog-ETF-07_农业周期');
    expect(filled.memberships['511880']).toContain('g-catalog-money-etf');

    // 组已有粮食ETF、养殖带 membershipUpdatedAt 但仍缺农业组 → 必须补上
    const partial = {
      ...filled,
      memberships: {
        ...filled.memberships,
        '159698': ['g-catalog-ETF-07_农业周期'],
        '159865': ['g-held'],
      },
      membershipUpdatedAt: { '159865': '2026-10-20T12:00:00.000Z' },
    };
    const gap = ensureCatalogSeed(partial);
    expect(gap.changed).toBe(true);
    expect(gap.meta.memberships['159865']).toEqual(expect.arrayContaining(['g-held', 'g-catalog-ETF-07_农业周期']));
  });

  it('catalogMembershipOptOut 阻止强行加回；deletedWatchlist 仍生效', () => {
    const { meta: filled } = ensureCatalogSeed(defaultMeta('2026-10-20T00:00:00.000Z'));
    const opted = {
      ...filled,
      memberships: { ...filled.memberships, '588200': ['g-focus'] },
      catalogMembershipOptOut: { '588200': ['g-catalog-ETF-01_TMT科技'] },
    };
    const again = ensureCatalogSeed(opted);
    expect(again.meta.memberships['588200']).toEqual(['g-focus']);
    expect(again.meta.memberships['588200']).not.toContain('g-catalog-ETF-01_TMT科技');

    const removed = {
      ...filled,
      watchlist: filled.watchlist.filter(watch => watch.code !== '588200'),
      memberships: Object.fromEntries(Object.entries(filled.memberships).filter(([code]) => code !== '588200')),
      deletedWatchlist: { '588200': '2026-10-20T12:00:00.000Z' },
    };
    expect(ensureCatalogSeed(removed).meta.watchlist.some(watch => watch.code === '588200')).toBe(false);
  });

  it('retires legacy g-catalog-broad / g-catalog-other shells and memberships', () => {
    const legacy = {
      ...defaultMeta('2026-10-18T00:00:00.000Z'),
      groups: [
        { id: 'g-focus', name: '重点观察', order: 0 },
        { id: 'custom', name: '指标性ETF', order: 1 },
        { id: BROAD_CATALOG_GROUP_ID, name: '宽基 ETF', order: 10 },
        { id: OTHER_CATALOG_GROUP_ID, name: '其他 ETF', order: 11 },
      ],
      watchlist: [
        { code: '510300', name: '沪深300', addedAt: '2026-10-18T00:00:00.000Z' },
        { code: '511880', name: '银华日利', addedAt: '2026-10-18T00:00:00.000Z' },
      ],
      memberships: {
        '510300': ['custom', BROAD_CATALOG_GROUP_ID],
        '511880': [OTHER_CATALOG_GROUP_ID],
      },
      membershipUpdatedAt: { '510300': '2026-10-18T12:00:00.000Z' },
    };
    const { meta } = ensureCatalogSeed(legacy);
    expect(meta.groups.some(group => group.id === BROAD_CATALOG_GROUP_ID)).toBe(false);
    expect(meta.groups.some(group => group.id === OTHER_CATALOG_GROUP_ID)).toBe(false);
    expect(meta.memberships['510300']).toEqual(['custom']);
    expect(meta.memberships['511880']).toContain('g-catalog-money-etf');
    expect(meta.memberships['511880']).not.toContain(OTHER_CATALOG_GROUP_ID);
    expect(meta.groups.find(group => group.id === 'g-catalog-money-etf')?.name).toBe('货币 ETF');
  });

  it('fundProfileUrl prefers sourceUrl then eastmoney', () => {
    expect(fundProfileUrl('510300')).toBe('https://fundf10.eastmoney.com/jbgk_510300.html');
    expect(fundProfileUrl('512890')).toBe('https://fundf10.eastmoney.com/jbgk_512890.html');
  });

  it('noop when already seeded', () => {
    const { meta } = ensureCatalogSeed(defaultMeta('2026-10-20T00:00:00.000Z'));
    const second = ensureCatalogSeed(meta);
    expect(second.changed).toBe(false);
  });
});
