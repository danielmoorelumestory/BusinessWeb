import { describe, expect, it } from 'vitest';
import { defaultMeta } from './etf-review-meta';
import {
  BROAD_CATALOG_GROUP_ID,
  buildCatalogGroups,
  ensureCatalogSeed,
  fundProfileUrl,
  isCatalogGroupId,
} from './etf-catalog-seed';
import industry from '../../../src/data/industryEtf.json';

describe('etf-catalog-seed', () => {
  it('buildCatalogGroups: each industry subgroup + other, no broad, no bond, no industry总组', () => {
    const groups = buildCatalogGroups();
    expect(groups.map(group => group.id)).not.toContain(BROAD_CATALOG_GROUP_ID);
    expect(groups.map(group => group.id)).not.toContain('g-catalog-industry');
    for (const group of industry as { id: string; name: string; items: unknown[] }[]) {
      expect(groups.some(item => item.id === `g-catalog-${group.id}` && item.name === group.name && item.items.length === group.items.length)).toBe(true);
    }
    const other = groups.find(group => group.id === 'g-catalog-other')!;
    expect(other.items.map(item => item.code).sort()).toEqual(['511880', '512890', '513630', '518880']);
    expect(other.items.some(item => item.code === '000015')).toBe(false);
  });

  it('ensureCatalogSeed fills empty meta; respects membershipUpdatedAt and deletedWatchlist', () => {
    const empty = defaultMeta('2026-10-20T00:00:00.000Z');
    const { meta: filled, changed } = ensureCatalogSeed(empty);
    expect(changed).toBe(true);
    expect(filled.groups.filter(group => isCatalogGroupId(group.id))).toHaveLength(8);
    expect(filled.groups.some(group => group.id === BROAD_CATALOG_GROUP_ID)).toBe(false);
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

  it('retires legacy g-catalog-broad shell and memberships', () => {
    const legacy = {
      ...defaultMeta('2026-10-18T00:00:00.000Z'),
      groups: [
        { id: 'g-focus', name: '重点观察', order: 0 },
        { id: 'custom', name: '指标性ETF', order: 1 },
        { id: BROAD_CATALOG_GROUP_ID, name: '宽基 ETF', order: 10 },
      ],
      watchlist: [{ code: '510300', name: '沪深300', addedAt: '2026-10-18T00:00:00.000Z' }],
      memberships: { '510300': ['custom', BROAD_CATALOG_GROUP_ID] },
      membershipUpdatedAt: { '510300': '2026-10-18T12:00:00.000Z' },
    };
    const { meta } = ensureCatalogSeed(legacy);
    expect(meta.groups.some(group => group.id === BROAD_CATALOG_GROUP_ID)).toBe(false);
    expect(meta.memberships['510300']).toEqual(['custom']);
    expect(meta.memberships['510300']).not.toContain(BROAD_CATALOG_GROUP_ID);
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
