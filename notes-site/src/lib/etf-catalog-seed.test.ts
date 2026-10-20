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
  it('buildCatalogGroups: industry + strategy/commodity/money 原名原标的；无宽基、无债基、无其他总组', () => {
    const groups = buildCatalogGroups();
    expect(groups.map(group => group.id)).not.toContain(BROAD_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain(OTHER_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain('g-catalog-industry');
    for (const group of industry as { id: string; name: string; items: unknown[] }[]) {
      expect(groups.some(item => item.id === `g-catalog-${group.id}` && item.name === group.name && item.items.length === group.items.length)).toBe(true);
    }
    for (const group of strategy as { id: string; title: string; items: { code: string }[] }[]) {
      if (!['strategy-etf', 'commodity-etf', 'money-etf'].includes(group.id)) continue;
      const seeded = groups.find(item => item.id === `g-catalog-${group.id}`)!;
      expect(seeded.name).toBe(group.title);
      expect(seeded.items.map(item => item.code)).toEqual(group.items.map(item => item.code));
    }
    expect(groups.some(group => group.items.some(item => item.code === '000015'))).toBe(false);
  });

  it('ensureCatalogSeed fills empty meta; respects membershipUpdatedAt and deletedWatchlist', () => {
    const empty = defaultMeta('2026-10-20T00:00:00.000Z');
    const { meta: filled, changed } = ensureCatalogSeed(empty);
    expect(changed).toBe(true);
    expect(filled.groups.filter(group => isCatalogGroupId(group.id))).toHaveLength(10);
    expect(filled.groups.some(group => group.id === BROAD_CATALOG_GROUP_ID)).toBe(false);
    expect(filled.groups.some(group => group.id === OTHER_CATALOG_GROUP_ID)).toBe(false);
    expect(filled.groups.find(group => group.id === 'g-catalog-money-etf')?.name).toBe('货币 ETF');
    expect(filled.memberships['511880']).toContain('g-catalog-money-etf');
    expect(filled.watchlist.some(watch => watch.code === '588200')).toBe(true);
    expect(filled.memberships['588200']).toContain('g-catalog-ETF-01_TMT科技');
    expect(filled.membershipUpdatedAt?.['588200']).toBeUndefined();

    const opted = {
      ...filled,
      memberships: { ...filled.memberships, '588200': ['g-focus'] },
      membershipUpdatedAt: { '588200': '2026-10-20T12:00:00.000Z' },
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

  it('first-time catalog groups still membership-seed codes that already have membershipUpdatedAt', () => {
    const legacy = {
      ...defaultMeta('2026-10-18T00:00:00.000Z'),
      groups: [
        { id: 'g-focus', name: '重点观察', order: 0 },
        { id: 'custom', name: '指标性ETF', order: 1 },
      ],
      watchlist: [{ code: '588200', name: '科创芯片', addedAt: '2026-10-18T00:00:00.000Z' }],
      memberships: { '588200': ['custom'] },
      membershipUpdatedAt: { '588200': '2026-10-18T12:00:00.000Z' },
    };
    const { meta } = ensureCatalogSeed(legacy);
    expect(meta.memberships['588200']).toEqual(expect.arrayContaining(['custom', 'g-catalog-ETF-01_TMT科技']));
    const afterOptOut = ensureCatalogSeed({
      ...meta,
      memberships: { ...meta.memberships, '588200': ['custom'] },
      membershipUpdatedAt: { ...meta.membershipUpdatedAt, '588200': '2026-10-20T12:00:00.000Z' },
    });
    expect(afterOptOut.meta.memberships['588200']).toEqual(['custom']);
    expect(afterOptOut.changed).toBe(false);

    const hollow = {
      ...legacy,
      groups: [...legacy.groups, { id: 'g-catalog-ETF-01_TMT科技', name: 'TMT科技', order: 10 }],
    };
    const filledHollow = ensureCatalogSeed(hollow);
    expect(filledHollow.meta.memberships['588200']).toContain('g-catalog-ETF-01_TMT科技');
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
