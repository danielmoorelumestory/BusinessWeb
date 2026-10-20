import broadRaw from '../../../src/data/broadEtf.json';
import industryRaw from '../../../src/data/industryEtf.json';
import strategyRaw from '../../../src/data/strategyAssetEtf.json';
import type { EtfReviewMeta } from './etf-review-meta';

// broadRaw / 货币债基 sourceUrl 仅用于基金档案；宽基、货币、债基不作为复盘分组

export type CatalogItem = {
  code: string;
  name: string;
  sourceUrl?: string;
  family?: string;
  category?: string;
  coverage?: string;
  gridApplicable?: boolean;
};

export type CatalogGroupDef = {
  id: string;
  name: string;
  order: number;
  items: CatalogItem[];
  description?: string;
  sourceId?: string;
};

export const BROAD_CATALOG_GROUP_ID = 'g-catalog-broad';
export const OTHER_CATALOG_GROUP_ID = 'g-catalog-other';
export const MONEY_CATALOG_GROUP_ID = 'g-catalog-money-etf';
export const BOND_CATALOG_GROUP_ID = 'g-catalog-bond-funds';

/** 进复盘分组的策略类；货币/债基只读参考区，不 seed */
const SEEDED_ASSET_IDS = new Set(['strategy-etf', 'commodity-etf']);
const REFERENCE_ONLY_SOURCE_IDS = new Set(['money-etf', 'bond-funds']);
const EASTMONEY = (code: string) => `https://fundf10.eastmoney.com/jbgk_${code}.html`;

const RETIRED_CATALOG_IDS = new Set([
  BROAD_CATALOG_GROUP_ID,
  OTHER_CATALOG_GROUP_ID,
  MONEY_CATALOG_GROUP_ID,
  BOND_CATALOG_GROUP_ID,
]);

export function isCatalogGroupId(id: string): boolean {
  return id.startsWith('g-catalog-');
}

function mapAssetItems(items: CatalogItem[]): CatalogItem[] {
  return items.map(item => ({
    code: item.code,
    name: item.name,
    sourceUrl: item.sourceUrl,
    family: item.family,
    category: item.category,
    coverage: item.coverage,
    gridApplicable: item.gridApplicable,
  }));
}

export function buildCatalogGroups(): CatalogGroupDef[] {
  const industry = (industryRaw as { id: string; name: string; items: { code: string; name: string }[] }[]).map((group, index) => ({
    id: `g-catalog-${group.id}`,
    name: group.name,
    order: 10 + index,
    sourceId: group.id,
    items: group.items.map(item => ({ code: item.code, name: item.name })),
  }));
  const assets = (strategyRaw as { id: string; title: string; description?: string; items: CatalogItem[] }[])
    .filter(group => SEEDED_ASSET_IDS.has(group.id))
    .map((group, index) => ({
      id: `g-catalog-${group.id}`,
      name: group.title,
      order: 10 + industry.length + index,
      sourceId: group.id,
      description: group.description,
      items: mapAssetItems(group.items),
    }));
  return [...industry, ...assets];
}

/** industry-etf 货币/债基源数据：只读展示，不进分组 */
export function referenceOnlyGroups(): CatalogGroupDef[] {
  return (strategyRaw as { id: string; title: string; description?: string; items: CatalogItem[] }[])
    .filter(group => REFERENCE_ONLY_SOURCE_IDS.has(group.id))
    .map((group, index) => ({
      id: `g-catalog-${group.id}`,
      name: group.title,
      order: index,
      sourceId: group.id,
      description: group.description,
      items: mapAssetItems(group.items),
    }));
}

export function referenceOnlyCodes(): Set<string> {
  return new Set(referenceOnlyGroups().flatMap(group => group.items.map(item => item.code.trim())));
}

let cachedGroups: CatalogGroupDef[] | null = null;

export function catalogGroupsCached(): CatalogGroupDef[] {
  if (!cachedGroups) cachedGroups = buildCatalogGroups();
  return cachedGroups;
}

export function catalogGroupDef(groupId: string): CatalogGroupDef | undefined {
  return catalogGroupsCached().find(group => group.id === groupId)
    ?? referenceOnlyGroups().find(group => group.id === groupId);
}

export function catalogItemOf(code: string): CatalogItem | undefined {
  const trimmed = code.trim();
  for (const group of [...catalogGroupsCached(), ...referenceOnlyGroups()]) {
    const item = group.items.find(entry => entry.code.trim() === trimmed);
    if (item) return item;
  }
  return undefined;
}

let cachedSourceUrls: Map<string, string> | null = null;

function sourceUrlByCode(): Map<string, string> {
  if (cachedSourceUrls) return cachedSourceUrls;
  const map = new Map<string, string>();
  for (const item of broadRaw as { code: string; sourceUrl?: string }[]) {
    if (item.sourceUrl) map.set(item.code, item.sourceUrl);
  }
  for (const group of [...catalogGroupsCached(), ...referenceOnlyGroups()]) {
    for (const item of group.items) {
      if (item.sourceUrl) map.set(item.code, item.sourceUrl);
    }
  }
  cachedSourceUrls = map;
  return map;
}

export function fundProfileUrl(code: string): string {
  const trimmed = code.trim();
  return sourceUrlByCode().get(trimmed) ?? EASTMONEY(trimmed);
}

function retireCatalogGroup(
  groupId: string,
  groups: EtfReviewMeta['groups'],
  memberships: Record<string, string[]>,
  deletedGroups: Record<string, string>,
): { groups: EtfReviewMeta['groups']; memberships: Record<string, string[]>; deletedGroups: Record<string, string>; changed: boolean } {
  let changed = false;
  let nextGroups = groups;
  let nextMemberships = memberships;
  let nextDeleted = deletedGroups;

  if (nextGroups.some(group => group.id === groupId)) {
    nextGroups = nextGroups.filter(group => group.id !== groupId);
    changed = true;
  }
  if (nextDeleted[groupId]) {
    nextDeleted = { ...nextDeleted };
    delete nextDeleted[groupId];
    changed = true;
  }
  for (const [code, ids] of Object.entries(nextMemberships)) {
    if (!ids.includes(groupId)) continue;
    if (nextMemberships === memberships) nextMemberships = { ...memberships };
    nextMemberships[code] = ids.filter(id => id !== groupId);
    changed = true;
  }
  return { groups: nextGroups, memberships: nextMemberships, deletedGroups: nextDeleted, changed };
}

export function ensureCatalogSeed(meta: EtfReviewMeta): { meta: EtfReviewMeta; changed: boolean } {
  const defs = catalogGroupsCached();
  const referenceCodes = referenceOnlyCodes();
  let groups = [...meta.groups];
  let watchlist = [...meta.watchlist];
  let memberships = { ...meta.memberships };
  let deletedGroups = { ...(meta.deletedGroups ?? {}) };
  let catalogOptOut = { ...(meta.catalogMembershipOptOut ?? {}) };
  let changed = false;

  for (const retiredId of RETIRED_CATALOG_IDS) {
    const retired = retireCatalogGroup(retiredId, groups, memberships, deletedGroups);
    groups = retired.groups;
    memberships = retired.memberships;
    deletedGroups = retired.deletedGroups;
    if (retired.changed) changed = true;
  }

  // 货币/债基不参与复盘池：清出 watchlist / membership / opt-out
  for (const code of referenceCodes) {
    if (watchlist.some(watch => watch.code === code)) {
      watchlist = watchlist.filter(watch => watch.code !== code);
      changed = true;
    }
    if (memberships[code]) {
      delete memberships[code];
      changed = true;
    }
    if (catalogOptOut[code]) {
      delete catalogOptOut[code];
      changed = true;
    }
  }

  for (const def of defs) {
    const existing = groups.find(group => group.id === def.id);
    if (!existing) {
      groups = [...groups, { id: def.id, name: def.name, order: def.order }];
      if (deletedGroups[def.id]) {
        deletedGroups = { ...deletedGroups };
        delete deletedGroups[def.id];
      }
      changed = true;
      continue;
    }
    if (existing.name !== def.name) {
      groups = groups.map(group => (group.id === def.id ? { ...group, name: def.name } : group));
      changed = true;
    }
  }

  const deletedWatch = meta.deletedWatchlist ?? {};

  for (const def of defs) {
    for (const item of def.items) {
      const code = item.code.trim();
      if (deletedWatch[code] || referenceCodes.has(code)) continue;

      const existingWatch = watchlist.find(watch => watch.code === code);
      if (!existingWatch) {
        watchlist = [...watchlist, { code, name: item.name, addedAt: '1970-01-01T00:00:00.000Z' }];
        changed = true;
      } else if (existingWatch.name !== item.name) {
        watchlist = watchlist.map(watch => (watch.code === code ? { ...watch, name: item.name } : watch));
        changed = true;
      }

      if ((catalogOptOut[code] ?? []).includes(def.id)) continue;
      const ids = memberships[code] ?? [];
      if (!ids.includes(def.id)) {
        memberships[code] = [...ids, def.id];
        changed = true;
      }
    }
  }

  if (!changed) return { meta, changed: false };

  const next: EtfReviewMeta = {
    ...meta,
    groups,
    watchlist,
    memberships,
  };
  if (Object.keys(deletedGroups).length) next.deletedGroups = deletedGroups;
  else delete next.deletedGroups;
  if (Object.keys(catalogOptOut).length) next.catalogMembershipOptOut = catalogOptOut;
  else delete next.catalogMembershipOptOut;
  return { meta: next, changed: true };
}
