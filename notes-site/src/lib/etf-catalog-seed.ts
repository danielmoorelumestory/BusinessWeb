import broadRaw from '../../../src/data/broadEtf.json';
import industryRaw from '../../../src/data/industryEtf.json';
import strategyRaw from '../../../src/data/strategyAssetEtf.json';
import type { EtfReviewMeta } from './etf-review-meta';

// broadRaw 仅用于基金档案 sourceUrl（宽基不作为清单分组）

export type CatalogItem = { code: string; name: string; sourceUrl?: string };
export type CatalogGroupDef = { id: string; name: string; order: number; items: CatalogItem[] };

export const BROAD_CATALOG_GROUP_ID = 'g-catalog-broad';
/** 曾把策略+商品+货币捏成一组；现按 industry-etf 原分组拆开，退役此 id */
export const OTHER_CATALOG_GROUP_ID = 'g-catalog-other';
const STRATEGY_SOURCE_IDS = new Set(['strategy-etf', 'commodity-etf', 'money-etf']);
const EASTMONEY = (code: string) => `https://fundf10.eastmoney.com/jbgk_${code}.html`;

const RETIRED_CATALOG_IDS = new Set([BROAD_CATALOG_GROUP_ID, OTHER_CATALOG_GROUP_ID]);

export function buildCatalogGroups(): CatalogGroupDef[] {
  const industry = (industryRaw as { id: string; name: string; items: { code: string; name: string }[] }[]).map((group, index) => ({
    id: `g-catalog-${group.id}`,
    name: group.name,
    order: 10 + index,
    items: group.items.map(item => ({ code: item.code, name: item.name })),
  }));
  const strategy = (strategyRaw as { id: string; title: string; items: CatalogItem[] }[])
    .filter(group => STRATEGY_SOURCE_IDS.has(group.id))
    .map((group, index) => ({
      id: `g-catalog-${group.id}`,
      name: group.title,
      order: 10 + industry.length + index,
      items: group.items.map(item => ({ code: item.code, name: item.name, sourceUrl: item.sourceUrl })),
    }));
  return [...industry, ...strategy];
}

export function isCatalogGroupId(id: string): boolean {
  return id.startsWith('g-catalog-');
}

let cachedSourceUrls: Map<string, string> | null = null;

function sourceUrlByCode(): Map<string, string> {
  if (cachedSourceUrls) return cachedSourceUrls;
  const map = new Map<string, string>();
  for (const item of broadRaw as { code: string; sourceUrl?: string }[]) {
    if (item.sourceUrl) map.set(item.code, item.sourceUrl);
  }
  for (const group of buildCatalogGroups()) {
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
  const defs = buildCatalogGroups();
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
    // 名称跟 industry-etf 源数据对齐
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
        // 名称也与清单对齐（不碰用户已改过 updatedAt 的？清单权威，直接对齐）
        watchlist = watchlist.map(watch => (watch.code === code ? { ...watch, name: item.name } : watch));
        changed = true;
      }

      // 仅尊重「对该清单组」的显式 opt-out；粗粒度 membershipUpdatedAt 不再挡 gap-fill
      if ((catalogOptOut[code] ?? []).includes(def.id)) continue;
      const ids = memberships[code] ?? [];
      if (!ids.includes(def.id)) {
        memberships[code] = [...ids, def.id];
        changed = true;
      }
    }
  }

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
