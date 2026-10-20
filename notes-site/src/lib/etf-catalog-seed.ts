import broadRaw from '../../../src/data/broadEtf.json';
import industryRaw from '../../../src/data/industryEtf.json';
import strategyRaw from '../../../src/data/strategyAssetEtf.json';
import type { EtfReviewMeta } from './etf-review-meta';

// broadRaw 仅用于基金档案 sourceUrl（宽基不作为清单分组）

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
/** 曾把策略+商品+货币捏成一组；现按 industry-etf 原分组拆开，退役此 id */
export const OTHER_CATALOG_GROUP_ID = 'g-catalog-other';
export const MONEY_CATALOG_GROUP_ID = 'g-catalog-money-etf';
export const BOND_CATALOG_GROUP_ID = 'g-catalog-bond-funds';

/** 货币 / 债基：独立样式，不与股票 ETF 复盘表统一，也不可并入其他清单组 */
const ISOLATED_SOURCE_IDS = new Set(['money-etf', 'bond-funds']);
const ASSET_SOURCE_IDS = new Set(['strategy-etf', 'commodity-etf', 'money-etf', 'bond-funds']);
const EASTMONEY = (code: string) => `https://fundf10.eastmoney.com/jbgk_${code}.html`;

const RETIRED_CATALOG_IDS = new Set([BROAD_CATALOG_GROUP_ID, OTHER_CATALOG_GROUP_ID]);

export function isCatalogGroupId(id: string): boolean {
  return id.startsWith('g-catalog-');
}

export function isIsolatedCatalogGroupId(id: string): boolean {
  return id === MONEY_CATALOG_GROUP_ID || id === BOND_CATALOG_GROUP_ID;
}

export function buildCatalogGroups(): CatalogGroupDef[] {
  const industry = (industryRaw as { id: string; name: string; items: { code: string; name: string }[] }[]).map((group, index) => ({
    id: `g-catalog-${group.id}`,
    name: group.name,
    order: 10 + index,
    sourceId: group.id,
    items: group.items.map(item => ({ code: item.code, name: item.name })),
  }));
  const assets = (strategyRaw as {
    id: string;
    title: string;
    description?: string;
    items: CatalogItem[];
  }[])
    .filter(group => ASSET_SOURCE_IDS.has(group.id))
    .map((group, index) => ({
      id: `g-catalog-${group.id}`,
      name: group.title,
      order: 10 + industry.length + index,
      sourceId: group.id,
      description: group.description,
      items: group.items.map(item => ({
        code: item.code,
        name: item.name,
        sourceUrl: item.sourceUrl,
        family: item.family,
        category: item.category,
        coverage: item.coverage,
        gridApplicable: item.gridApplicable,
      })),
    }));
  return [...industry, ...assets];
}

let cachedGroups: CatalogGroupDef[] | null = null;
let cachedItemByCode: Map<string, { item: CatalogItem; groupId: string }> | null = null;

export function catalogGroupsCached(): CatalogGroupDef[] {
  if (!cachedGroups) cachedGroups = buildCatalogGroups();
  return cachedGroups;
}

function itemIndex(): Map<string, { item: CatalogItem; groupId: string }> {
  if (cachedItemByCode) return cachedItemByCode;
  const map = new Map<string, { item: CatalogItem; groupId: string }>();
  for (const group of catalogGroupsCached()) {
    for (const item of group.items) map.set(item.code.trim(), { item, groupId: group.id });
  }
  cachedItemByCode = map;
  return map;
}

/** 该代码所属的隔离清单组（货币/债基）；股票 ETF 返回 null */
export function isolatedHomeGroupId(code: string): string | null {
  const hit = itemIndex().get(code.trim());
  if (!hit || !isIsolatedCatalogGroupId(hit.groupId)) return null;
  return hit.groupId;
}

export function catalogItemOf(code: string): CatalogItem | undefined {
  return itemIndex().get(code.trim())?.item;
}

export function catalogGroupDef(groupId: string): CatalogGroupDef | undefined {
  return catalogGroupsCached().find(group => group.id === groupId);
}

/**
 * 分组勾选白名单：
 * - 货币/债基代码 → 仅个人组 + 自己的隔离清单组
 * - 其他代码 → 任意非隔离组（不能勾进货币/债基清单组）
 */
export function allowedMembershipGroupIds(code: string, groupIds: string[]): string[] {
  const home = isolatedHomeGroupId(code);
  if (home) {
    return groupIds.filter(id => !isCatalogGroupId(id) || id === home);
  }
  return groupIds.filter(id => !isIsolatedCatalogGroupId(id));
}

let cachedSourceUrls: Map<string, string> | null = null;

function sourceUrlByCode(): Map<string, string> {
  if (cachedSourceUrls) return cachedSourceUrls;
  const map = new Map<string, string>();
  for (const item of broadRaw as { code: string; sourceUrl?: string }[]) {
    if (item.sourceUrl) map.set(item.code, item.sourceUrl);
  }
  for (const group of catalogGroupsCached()) {
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

function sanitizeMemberships(
  memberships: Record<string, string[]>,
  catalogOptOut: Record<string, string[]>,
): { memberships: Record<string, string[]>; changed: boolean } {
  let changed = false;
  let next = memberships;
  for (const [code, ids] of Object.entries(memberships)) {
    const allowed = new Set(allowedMembershipGroupIds(code, ids));
    const home = isolatedHomeGroupId(code);
    let filtered = ids.filter(id => allowed.has(id));
    if (home && !filtered.includes(home) && !(catalogOptOut[code] ?? []).includes(home)) {
      filtered = [...filtered, home];
    }
    if (filtered.length === ids.length && filtered.every((id, index) => id === ids[index])) continue;
    if (next === memberships) next = { ...memberships };
    next[code] = filtered;
    changed = true;
  }
  return { memberships: next, changed };
}

export function ensureCatalogSeed(meta: EtfReviewMeta): { meta: EtfReviewMeta; changed: boolean } {
  const defs = catalogGroupsCached();
  let groups = [...meta.groups];
  let watchlist = [...meta.watchlist];
  let memberships = { ...meta.memberships };
  let deletedGroups = { ...(meta.deletedGroups ?? {}) };
  let changed = false;

  for (const retiredId of RETIRED_CATALOG_IDS) {
    const retired = retireCatalogGroup(retiredId, groups, memberships, deletedGroups);
    groups = retired.groups;
    memberships = retired.memberships;
    deletedGroups = retired.deletedGroups;
    if (retired.changed) changed = true;
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
  const catalogOptOut = meta.catalogMembershipOptOut ?? {};

  for (const def of defs) {
    for (const item of def.items) {
      const code = item.code.trim();
      if (deletedWatch[code]) continue;

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

  const sanitized = sanitizeMemberships(memberships, catalogOptOut);
  memberships = sanitized.memberships;
  if (sanitized.changed) changed = true;

  if (!changed) return { meta, changed: false };

  const nextDeleted = Object.keys(deletedGroups).length ? deletedGroups : undefined;
  return {
    meta: {
      ...meta,
      groups,
      watchlist,
      memberships,
      ...(nextDeleted ? { deletedGroups: nextDeleted } : meta.deletedGroups ? { deletedGroups: meta.deletedGroups } : {}),
    },
    changed: true,
  };
}
