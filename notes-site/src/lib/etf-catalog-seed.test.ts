import { describe, expect, it } from 'vitest';
import { defaultMeta } from './etf-review-meta';
import {
  BOND_CATALOG_GROUP_ID,
  BROAD_CATALOG_GROUP_ID,
  MONEY_CATALOG_GROUP_ID,
  OTHER_CATALOG_GROUP_ID,
  broadPositioningOf,
  buildCatalogGroups,
  ensureCatalogSeed,
  MACD_GOOD_CATALOG_GROUP_ID,
  HS300_TIMING_CATALOG_GROUP_ID,
  TIMING_PORTFOLIO_CATALOG_GROUP_ID,
  fundProfileUrl,
  isCatalogGroupId,
  positioningOf,
  referenceOnlyCodes,
  referenceOnlyGroups,
  subThemeCellHtml,
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

    for (const group of industry as { id: string; name: string; items: { code: string; name: string; subTheme?: string }[] }[]) {
      const seeded = groups.find(item => item.id === `g-catalog-${group.id}`);
      expect(seeded, group.name).toBeTruthy();
      expect(seeded!.name).toBe(group.name);
      expect(seeded!.items.map(item => item.code)).toEqual(group.items.map(item => item.code));
      expect(seeded!.items.map(item => item.subTheme)).toEqual(group.items.map(item => item.subTheme));
    }
    const chip = groups.find(group => group.id === 'g-catalog-ETF-01_TMT科技')!.items.find(item => item.code === '588200')!;
    expect(chip.subTheme).toContain('芯片设计');

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
    // 9 个行业/策略/商品组 + 创业板择时优选 + 沪深300择时优选 + 择时组合
    expect(filled.groups.filter(group => isCatalogGroupId(group.id))).toHaveLength(12);
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
    // 588200 同时在 创业板择时优选、择时组合 清单中，只退出了 TMT 组
    expect(again.meta.memberships['588200']).toEqual(['g-focus', MACD_GOOD_CATALOG_GROUP_ID, TIMING_PORTFOLIO_CATALOG_GROUP_ID]);
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

  it('指标性/宽基行业分布列用标的与定位；行业组仍用 subTheme', () => {
    const broad = broadPositioningOf('510300')!;
    expect(broad.family).toBeTruthy();
    expect(broad.coverage).toBeTruthy();
    expect(positioningOf('510300')?.family).toBe(broad.family);
    expect(positioningOf('588200')?.subTheme).toContain('芯片');
    const escape = (value: unknown) => String(value ?? '');
    expect(subThemeCellHtml('510300', escape)).toContain(broad.family!);
    expect(subThemeCellHtml('510300', escape)).toContain('catalog-position-cell');
    expect(subThemeCellHtml('588200', escape)).toContain('subtheme-tag');
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

  it('MACD优秀 分组排在用户当前的 TMT 科技之前', () => {
    const tmt = 'g-catalog-ETF-01_TMT科技';
    const base = { ...defaultMeta('2026-11-11T00:00:00.000Z') };
    const first = ensureCatalogSeed(base).meta;
    const order = (meta: typeof first, id: string) => meta.groups.find(group => group.id === id)!.order;
    expect(order(first, MACD_GOOD_CATALOG_GROUP_ID)).toBeLessThan(order(first, tmt));
    // 用户重排过分组（TMT 排在第 2 位）后新增 MACD优秀，仍插在 TMT 前
    const renumbered = { ...first, groups: first.groups.filter(group => group.id !== MACD_GOOD_CATALOG_GROUP_ID).map((group, index) => ({ ...group, order: group.id === tmt ? 2 : index + 10 })) };
    const again = ensureCatalogSeed(renumbered).meta;
    expect(order(again, MACD_GOOD_CATALOG_GROUP_ID)).toBe(1.5);
    expect(Object.entries(again.memberships).filter(([, ids]) => ids.includes(MACD_GOOD_CATALOG_GROUP_ID)).length).toBeGreaterThan(0);
  });

  it('回测分组重新筛选后，落选的 ETF 退出该组，手动分组与 watchlist 保留', () => {
    const first = ensureCatalogSeed(defaultMeta('2026-11-15T00:00:00.000Z')).meta;
    const stale = { ...first, memberships: { ...first.memberships, '510300': ['g-focus', MACD_GOOD_CATALOG_GROUP_ID, HS300_TIMING_CATALOG_GROUP_ID] } };
    const again = ensureCatalogSeed(stale);
    expect(again.changed).toBe(true);
    expect(again.meta.memberships['510300']).toEqual(['g-focus']);
    expect(again.meta.memberships['562500']).toContain(MACD_GOOD_CATALOG_GROUP_ID);
    expect(again.meta.memberships['562500']).not.toContain(HS300_TIMING_CATALOG_GROUP_ID);
  });

  it('沪深300择时优选 排在 创业板择时优选 之后、TMT 科技之前，并加入成员', () => {
    const tmt = 'g-catalog-ETF-01_TMT科技';
    const first = ensureCatalogSeed(defaultMeta('2026-11-14T00:00:00.000Z')).meta;
    const order = (meta: typeof first, id: string) => meta.groups.find(group => group.id === id)!.order;
    expect(order(first, MACD_GOOD_CATALOG_GROUP_ID)).toBeLessThan(order(first, HS300_TIMING_CATALOG_GROUP_ID));
    expect(order(first, HS300_TIMING_CATALOG_GROUP_ID)).toBeLessThan(order(first, tmt));
    // 已有 MACD优秀 的老用户（TMT 被重排到第 2 位）新增本组，仍落在两者之间
    const renumbered = { ...first, groups: first.groups.filter(group => group.id !== HS300_TIMING_CATALOG_GROUP_ID).map((group, index) => ({ ...group, order: group.id === tmt ? 2 : group.id === MACD_GOOD_CATALOG_GROUP_ID ? 1.5 : index + 10 })) };
    const again = ensureCatalogSeed(renumbered).meta;
    expect(order(again, HS300_TIMING_CATALOG_GROUP_ID)).toBe(1.75);
    expect(again.memberships['159755']).toContain(HS300_TIMING_CATALOG_GROUP_ID);
  });

  it('择时组合 排在 沪深300择时优选 之后、TMT 科技之前，成员可同时属于优选分组', () => {
    const tmt = 'g-catalog-ETF-01_TMT科技';
    const first = ensureCatalogSeed(defaultMeta('2026-11-16T00:00:00.000Z')).meta;
    const order = (meta: typeof first, id: string) => meta.groups.find(group => group.id === id)!.order;
    expect(order(first, HS300_TIMING_CATALOG_GROUP_ID)).toBeLessThan(order(first, TIMING_PORTFOLIO_CATALOG_GROUP_ID));
    expect(order(first, TIMING_PORTFOLIO_CATALOG_GROUP_ID)).toBeLessThan(order(first, tmt));
    expect(first.groups.find(group => group.id === TIMING_PORTFOLIO_CATALOG_GROUP_ID)!.name).toBe('择时组合');
    expect(first.memberships['562500']).toEqual(expect.arrayContaining([MACD_GOOD_CATALOG_GROUP_ID, TIMING_PORTFOLIO_CATALOG_GROUP_ID]));
    expect(first.memberships['513630']).toContain(TIMING_PORTFOLIO_CATALOG_GROUP_ID);
    // 老用户（TMT 已重排到第 2 位）新增本组，落在 TMT 前
    const renumbered = { ...first, groups: first.groups.filter(group => group.id !== TIMING_PORTFOLIO_CATALOG_GROUP_ID).map((group, index) => ({ ...group, order: group.id === tmt ? 2 : index + 10 })) };
    expect(order(ensureCatalogSeed(renumbered).meta, TIMING_PORTFOLIO_CATALOG_GROUP_ID)).toBe(1.875);
  });
});
