import broadRaw from '../../../src/data/broadEtf.json';
import industryRaw from '../../../src/data/industryEtf.json';
import strategyRaw from '../../../src/data/strategyAssetEtf.json';
import type { EtfReviewMeta } from './etf-review-meta';

// broadRaw 仍用于基金档案 sourceUrl 映射（宽基不再作为清单分组）

export type CatalogItem = { code: string; name: string; sourceUrl?: string };
export type CatalogGroupDef = { id: string; name: string; order: number; items: CatalogItem[] };

export const BROAD_CATALOG_GROUP_ID = 'g-catalog-broad';
const OTHER_SOURCE_IDS = new Set(['strategy-etf', 'commodity-etf', 'money-etf']);
const EASTMONEY = (code: string) => `https://fundf10.eastmoney.com/jbgk_${code}.html`;

export function buildCatalogGroups(): CatalogGroupDef[] {
  const industry = (industryRaw as { id: string; name: string; items: { code: string; name: string }[] }[]).map((group, index) => ({
    id: `g-catalog-${group.id}`,
    name: group.name,
    order: 10 + index,
    items: group.items.map(item => ({ code: item.code, name: item.name })),
  }));
  const otherItems: CatalogItem[] = [];
  for (const group of strategyRaw as { id: string; items: CatalogItem[] }[]) {
    if (!OTHER_SOURCE_IDS.has(group.id)) continue;
    for (const item of group.items) {
      otherItems.push({ code: item.code, name: item.name, sourceUrl: item.sourceUrl });
    }
  }
  // 宽基与「指标性ETF」等个人分组重叠，不再 seed g-catalog-broad
  return [
    ...industry,
    { id: 'g-catalog-other', name: '其他 ETF', order: 10 + industry.length, items: otherItems },
  ];
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

export function ensureCatalogSeed(meta: EtfReviewMeta): { meta: EtfReviewMeta; changed: boolean } {
  const defs = buildCatalogGroups();
  // 仅对「已存在且已有成员」的清单组尊重 membership 手动编辑。
  // 新引入、或仅有空壳（老逻辑跳过 membership 留下的）的清单组仍要灌。
  const preexistingGroupIds = new Set(meta.groups.map(group => group.id));
  const populatedCatalogIds = new Set(
    [...preexistingGroupIds].filter(id => isCatalogGroupId(id) && id !== BROAD_CATALOG_GROUP_ID && Object.values(meta.memberships).some(ids => ids.includes(id))),
  );
  let groups = [...meta.groups];
  let watchlist = [...meta.watchlist];
  const memberships = { ...meta.memberships };
  const deletedGroups = { ...(meta.deletedGroups ?? {}) };
  let changed = false;

  // 退役宽基清单组：去掉组壳与 membership（标的与个人组保留）
  if (groups.some(group => group.id === BROAD_CATALOG_GROUP_ID)) {
    groups = groups.filter(group => group.id !== BROAD_CATALOG_GROUP_ID);
    changed = true;
  }
  if (deletedGroups[BROAD_CATALOG_GROUP_ID]) {
    delete deletedGroups[BROAD_CATALOG_GROUP_ID];
    changed = true;
  }
  for (const [code, ids] of Object.entries(memberships)) {
    if (!ids.includes(BROAD_CATALOG_GROUP_ID)) continue;
    memberships[code] = ids.filter(id => id !== BROAD_CATALOG_GROUP_ID);
    changed = true;
  }

  for (const def of defs) {
    if (groups.some(group => group.id === def.id)) continue;
    groups = [...groups, { id: def.id, name: def.name, order: def.order }];
    if (deletedGroups[def.id]) delete deletedGroups[def.id];
    changed = true;
  }

  const deletedWatch = meta.deletedWatchlist ?? {};
  const touched = meta.membershipUpdatedAt ?? {};

  for (const def of defs) {
    for (const item of def.items) {
      const code = item.code.trim();
      if (deletedWatch[code]) continue;

      if (!watchlist.some(watch => watch.code === code)) {
        watchlist = [...watchlist, { code, name: item.name, addedAt: '1970-01-01T00:00:00.000Z' }];
        changed = true;
      }

      // 用户曾改过 membership，且该清单组已有成员 → 视为对该组 opt-out，不再强行加回
      if (touched[code] && populatedCatalogIds.has(def.id)) continue;
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
