import { describe, expect, it } from 'vitest';
import { defaultMeta } from './etf-review-meta';
import {
  BOND_CATALOG_GROUP_ID,
  BROAD_CATALOG_GROUP_ID,
  MONEY_CATALOG_GROUP_ID,
  OTHER_CATALOG_GROUP_ID,
  buildCatalogGroups,
  ensureCatalogSeed,
  fundProfileUrl,
  isCatalogGroupId,
  referenceOnlyCodes,
  referenceOnlyGroups,
} from './etf-catalog-seed';
import industry from '../../../src/data/industryEtf.json';
import strategy from '../../../src/data/strategyAssetEtf.json';

describe('etf-catalog-seed', () => {
  it('buildCatalogGroups: 行业+策略+商品；货币/债基只读不进分组', () => {
    const groups = buildCatalogGroups();
    expect(groups.map(group => group.id)).not.toContain(BROAD_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain(OTHER_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain(MONEY_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain(BOND_CATALOG_GROUP_ID);

    for (const group of industry as { id: string; name: string; items: { code: string; name: string }[] }[]) {
      const seeded = groups.find(item => item.id === `g-catalog-${group.id}`);
      expect(seeded, group.name).toBeTruthy();
      expect(seeded!.name).toBe(group.name);
      expect(seeded!.items.map(item => item.code)).toEqual(group.items.map(item => item.code));
    }

    for (const group of strategy as { id: string; title: string; items: { code: string; name: string }[] }[]) {
      if (group.id === 'money-etf' || group.id === 'bond-funds') {
        expect(groups.some(item => item.id === `g-catalog-${group.id}`)).toBe(false);
        continue;
      }
      const seeded = groups.find(item => item.id === `g-catalog-${group.id}`)!;
      expect(seeded.name).toBe(group.title);
      expect(seeded.items.map(item => item.code)).toEqual(group.items.map(item => item.code));
    }

    const reference = referenceOnlyGroups();
    expect(reference.map(group => group.id)).toEqual([MONEY_CATALOG_GROUP_ID, BOND_CATALOG_GROUP_ID]);
    expect(referenceOnlyCodes().has('511880')).toBe(true);
    expect(referenceOnlyCodes().has('000015')).toBe(true);
    expect(reference.find(group => group.id === MONEY_CATALOG_GROUP_ID)!.items.map(item => item.code)).toEqual(['511880']);
  });

  it('ensureCatalogSeed fills groups and strips money/bond from review pool', () => {
    const empty = defaultMeta('2026-10-20T00:00:00.000Z');
    const { meta: filled, changed } = ensureCatalogSeed(empty);
    expect(changed).toBe(true);
    expect(filled.groups.filter(group => isCatalogGroupId(group.id))).toHaveLength(9);
    expect(filled.groups.some(group => group.id === MONEY_CATALOG_GROUP_ID)).toBe(false);
    expect(filled.groups.some(group => group.id === BOND_CATALOG_GROUP_ID)).toBe(false);
    expect(filled.watchlist.some(watch => watch.code === '511880')).toBe(false);
    expect(filled.watchlist.some(watch => watch.code === '000015')).toBe(false);
    expect(filled.memberships['159865']).toContain('g-catalog-ETF-07_农业周期');

    const polluted = {
      ...filled,
      groups: [
        ...filled.groups,
        { id: MONEY_CATALOG_GROUP_ID, name: '货币 ETF', order: 99 },
        { id: BOND_CATALOG_GROUP_ID, name: '债券基金（场外）', order: 100 },
      ],
      watchlist: [
        ...filled.watchlist,
        { code: '511880', name: '银华日利ETF', addedAt: '1970-01-01T00:00:00.000Z' },
        { code: '000015', name: '华夏纯债', addedAt: '1970-01-01T00:00:00.000Z' },
      ],
      memberships: {
        ...filled.memberships,
        '511880': [MONEY_CATALOG_GROUP_ID],
        '000015': [BOND_CATALOG_GROUP_ID],
      },
    };
    const cleaned = ensureCatalogSeed(polluted);
    expect(cleaned.meta.groups.some(group => group.id === MONEY_CATALOG_GROUP_ID)).toBe(false);
    expect(cleaned.meta.watchlist.some(watch => watch.code === '511880')).toBe(false);
    expect(cleaned.meta.memberships['511880']).toBeUndefined();
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

  it('retires legacy g-catalog-broad / other / money / bond shells', () => {
    const legacy = {
      ...defaultMeta('2026-10-18T00:00:00.000Z'),
      groups: [
        { id: 'g-focus', name: '重点观察', order: 0 },
        { id: BROAD_CATALOG_GROUP_ID, name: '宽基 ETF', order: 10 },
        { id: OTHER_CATALOG_GROUP_ID, name: '其他 ETF', order: 11 },
        { id: MONEY_CATALOG_GROUP_ID, name: '货币 ETF', order: 12 },
      ],
      watchlist: [
        { code: '510300', name: '沪深300', addedAt: '2026-10-18T00:00:00.000Z' },
        { code: '511880', name: '银华日利', addedAt: '2026-10-18T00:00:00.000Z' },
      ],
      memberships: {
        '510300': [BROAD_CATALOG_GROUP_ID],
        '511880': [MONEY_CATALOG_GROUP_ID],
      },
    };
    const { meta } = ensureCatalogSeed(legacy);
    expect(meta.groups.some(group => group.id === BROAD_CATALOG_GROUP_ID)).toBe(false);
    expect(meta.groups.some(group => group.id === MONEY_CATALOG_GROUP_ID)).toBe(false);
    expect(meta.watchlist.some(watch => watch.code === '511880')).toBe(false);
    expect(meta.memberships['510300'] ?? []).not.toContain(BROAD_CATALOG_GROUP_ID);
  });

  it('fundProfileUrl prefers sourceUrl then eastmoney', () => {
    expect(fundProfileUrl('510300')).toBe('https://fundf10.eastmoney.com/jbgk_510300.html');
    expect(fundProfileUrl('512890')).toBe('https://fundf10.eastmoney.com/jbgk_512890.html');
    expect(fundProfileUrl('511880')).toBe('https://fundf10.eastmoney.com/jbgk_511880.html');
  });

  it('noop when already seeded', () => {
    const { meta } = ensureCatalogSeed(defaultMeta('2026-10-20T00:00:00.000Z'));
    const second = ensureCatalogSeed(meta);
    expect(second.changed).toBe(false);
  });
});
