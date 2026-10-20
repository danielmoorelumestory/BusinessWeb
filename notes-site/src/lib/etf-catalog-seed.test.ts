import { describe, expect, it } from 'vitest';
import { defaultMeta } from './etf-review-meta';
import {
  buildCatalogGroups,
  ensureCatalogSeed,
  fundProfileUrl,
  isCatalogGroupId,
} from './etf-catalog-seed';
import industry from '../../../src/data/industryEtf.json';
import broad from '../../../src/data/broadEtf.json';

describe('etf-catalog-seed', () => {
  it('buildCatalogGroups: broad + each industry subgroup + other, no bond, no industry总组', () => {
    const groups = buildCatalogGroups();
    expect(groups.map(group => group.id)).toContain('g-catalog-broad');
    expect(groups.map(group => group.id)).not.toContain('g-catalog-industry');
    for (const group of industry as { id: string; name: string; items: unknown[] }[]) {
      expect(groups.some(item => item.id === `g-catalog-${group.id}` && item.name === group.name && item.items.length === group.items.length)).toBe(true);
    }
    expect(groups.find(group => group.id === 'g-catalog-broad')!.items).toHaveLength((broad as unknown[]).length);
    const other = groups.find(group => group.id === 'g-catalog-other')!;
    expect(other.items.map(item => item.code).sort()).toEqual(['511880', '512890', '513630', '518880']);
    expect(other.items.some(item => item.code === '000015')).toBe(false);
  });

  it('ensureCatalogSeed fills empty meta; respects membershipUpdatedAt and deletedWatchlist', () => {
    const empty = defaultMeta('2026-10-20T00:00:00.000Z');
    const { meta: filled, changed } = ensureCatalogSeed(empty);
    expect(changed).toBe(true);
    expect(filled.groups.filter(group => isCatalogGroupId(group.id))).toHaveLength(9);
    expect(filled.watchlist.some(watch => watch.code === '510300')).toBe(true);
    expect(filled.memberships['510300']).toContain('g-catalog-broad');
    expect(filled.membershipUpdatedAt?.['510300']).toBeUndefined();

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
      watchlist: filled.watchlist.filter(watch => watch.code !== '510300'),
      memberships: Object.fromEntries(Object.entries(filled.memberships).filter(([code]) => code !== '510300')),
      deletedWatchlist: { '510300': '2026-10-20T12:00:00.000Z' },
    };
    expect(ensureCatalogSeed(removed).meta.watchlist.some(watch => watch.code === '510300')).toBe(false);
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
