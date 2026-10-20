import { describe, expect, it } from 'vitest';
import { defaultMeta } from './etf-review-meta';
import {
  BOND_CATALOG_GROUP_ID,
  BROAD_CATALOG_GROUP_ID,
  MONEY_CATALOG_GROUP_ID,
  OTHER_CATALOG_GROUP_ID,
  allowedMembershipGroupIds,
  buildCatalogGroups,
  ensureCatalogSeed,
  fundProfileUrl,
  isCatalogGroupId,
  isIsolatedCatalogGroupId,
  isolatedHomeGroupId,
} from './etf-catalog-seed';
import industry from '../../../src/data/industryEtf.json';
import strategy from '../../../src/data/strategyAssetEtf.json';

describe('etf-catalog-seed', () => {
  it('buildCatalogGroups: 与 industry-etf 逐组对账——含货币/债基原名原标的', () => {
    const groups = buildCatalogGroups();
    expect(groups.map(group => group.id)).not.toContain(BROAD_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain(OTHER_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain('g-catalog-industry');

    for (const group of industry as { id: string; name: string; items: { code: string; name: string }[] }[]) {
      const seeded = groups.find(item => item.id === `g-catalog-${group.id}`);
      expect(seeded, group.name).toBeTruthy();
      expect(seeded!.name).toBe(group.name);
      expect(seeded!.items.map(item => item.code)).toEqual(group.items.map(item => item.code));
      expect(seeded!.items.map(item => item.name)).toEqual(group.items.map(item => item.name));
    }

    for (const group of strategy as { id: string; title: string; items: { code: string; name: string }[] }[]) {
      const seeded = groups.find(item => item.id === `g-catalog-${group.id}`);
      expect(seeded, group.title).toBeTruthy();
      expect(seeded!.name).toBe(group.title);
      expect(seeded!.items.map(item => item.code)).toEqual(group.items.map(item => item.code));
      expect(seeded!.items.map(item => item.name)).toEqual(group.items.map(item => item.name));
    }

    expect(isIsolatedCatalogGroupId(MONEY_CATALOG_GROUP_ID)).toBe(true);
    expect(isIsolatedCatalogGroupId(BOND_CATALOG_GROUP_ID)).toBe(true);
    expect(isIsolatedCatalogGroupId('g-catalog-ETF-01_TMT科技')).toBe(false);
    expect(isolatedHomeGroupId('511880')).toBe(MONEY_CATALOG_GROUP_ID);
    expect(isolatedHomeGroupId('000015')).toBe(BOND_CATALOG_GROUP_ID);
    expect(isolatedHomeGroupId('588200')).toBeNull();
  });

  it('货币/债基不可并入其他清单组；股票 ETF 不可勾进货币/债基', () => {
    const ids = [
      'g-focus',
      'g-held',
      'g-catalog-ETF-01_TMT科技',
      MONEY_CATALOG_GROUP_ID,
      BOND_CATALOG_GROUP_ID,
    ];
    expect(allowedMembershipGroupIds('511880', ids)).toEqual(['g-focus', 'g-held', MONEY_CATALOG_GROUP_ID]);
    expect(allowedMembershipGroupIds('000015', ids)).toEqual(['g-focus', 'g-held', BOND_CATALOG_GROUP_ID]);
    expect(allowedMembershipGroupIds('588200', ids)).toEqual(['g-focus', 'g-held', 'g-catalog-ETF-01_TMT科技']);
  });

  it('ensureCatalogSeed fills empty meta; gap-fill 不受 membershipUpdatedAt 阻挡', () => {
    const empty = defaultMeta('2026-10-20T00:00:00.000Z');
    const { meta: filled, changed } = ensureCatalogSeed(empty);
    expect(changed).toBe(true);
    expect(filled.groups.filter(group => isCatalogGroupId(group.id))).toHaveLength(11);
    expect(filled.groups.find(group => group.id === MONEY_CATALOG_GROUP_ID)?.name).toBe('货币 ETF');
    expect(filled.groups.find(group => group.id === BOND_CATALOG_GROUP_ID)?.name).toBe('债券基金（场外）');
    expect(filled.memberships['511880']).toContain(MONEY_CATALOG_GROUP_ID);
    expect(filled.memberships['000015']).toContain(BOND_CATALOG_GROUP_ID);
    expect(filled.memberships['159865']).toContain('g-catalog-ETF-07_农业周期');

    const crossed = {
      ...filled,
      memberships: {
        ...filled.memberships,
        '511880': [MONEY_CATALOG_GROUP_ID, 'g-catalog-ETF-01_TMT科技'],
        '588200': ['g-catalog-ETF-01_TMT科技', MONEY_CATALOG_GROUP_ID],
      },
    };
    const cleaned = ensureCatalogSeed(crossed);
    expect(cleaned.meta.memberships['511880']).toEqual([MONEY_CATALOG_GROUP_ID]);
    expect(cleaned.meta.memberships['588200']).toEqual(['g-catalog-ETF-01_TMT科技']);
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
    expect(meta.memberships['511880']).toContain(MONEY_CATALOG_GROUP_ID);
    expect(meta.memberships['511880']).not.toContain(OTHER_CATALOG_GROUP_ID);
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
