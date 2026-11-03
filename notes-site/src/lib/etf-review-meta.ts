export const ETF_REVIEW_META_ID = 'meta:etf-review-v1';
export const SEED_TS = '1970-01-01T00:00:00.000Z';

export const NOTE_EMOTIONS = ['恐慌', '悲观', '失望', '谨慎', '中性', '期待', '乐观', '兴奋', '亢奋'] as const;
export const NOTE_CONCLUSIONS = ['上升趋势', '强势回调', '震荡偏强', '横盘震荡', '弱势反弹', '止跌企稳', '冲高回落', '震荡偏弱', '下降趋势', '待确认'] as const;
export const NOTE_ACTIONS = ['观望', '持有', '建仓', '加仓', '减仓', '清仓'] as const;

export type DailyNote = {
  // 兼容旧笔记的历史值，新笔记选项由上方常量定义。
  emotion: typeof NOTE_EMOTIONS[number] | '冷静' | '犹豫' | 'FOMO' | '';
  conclusion: typeof NOTE_CONCLUSIONS[number] | '看多' | '中性' | '看空' | '';
  action: typeof NOTE_ACTIONS[number] | '调参' | '';
  risk: string;
  remark: string;
  summary?: string;
  updatedAt: string;
};

export type ReviewGroup = { id: string; name: string; order: number; updatedAt?: string };
export type DailyPremium = { rate: number; referenceNav?: number; quoteDate: string; updatedAt: string };

export type EtfReviewMeta = {
  id: typeof ETF_REVIEW_META_ID;
  kind: 'etf-review-meta';
  savedAt: string;
  updatedAt: string;
  groups: ReviewGroup[];
  watchlist: { code: string; name: string; addedAt: string; updatedAt?: string }[];
  memberships: Record<string, string[]>;
  // 每个分组独立保存标的顺序；空字符串代表未分组。兼容没有排序数据的旧记录。
  groupCodeOrder?: Record<string, string[]>;
  notes: Record<string, DailyNote>;
  dailyPremiums?: Record<string, DailyPremium>;
  workspaceUpdatedAt?: string;
  membershipUpdatedAt?: Record<string, string>;
  /** code → 用户主动踢出的清单组 id；seed 只尊重这些，不因粗粒度 membershipUpdatedAt 漏补标的 */
  catalogMembershipOptOut?: Record<string, string[]>;
  deletedGroups?: Record<string, string>;
  deletedWatchlist?: Record<string, string>;
  resetAt?: string;
};

const GROUP_DEFS: { id: string; name: string; order: number }[] = [
  { id: 'g-focus', name: '重点观察', order: 0 },
  { id: 'g-held', name: '已持仓', order: 1 },
  { id: 'g-backup', name: '备选', order: 2 },
];

export function defaultMeta(nowIso: string): EtfReviewMeta {
  return {
    id: ETF_REVIEW_META_ID,
    kind: 'etf-review-meta',
    savedAt: nowIso,
    updatedAt: SEED_TS,
    groups: GROUP_DEFS.map(g => ({ ...g })),
    watchlist: [],
    memberships: {},
    notes: {},
  };
}

export function isEtfReviewMeta(item: unknown): item is EtfReviewMeta {
  if (!item || typeof item !== 'object') return false;
  const o = item as Record<string, unknown>;
  return o.id === ETF_REVIEW_META_ID && o.kind === 'etf-review-meta';
}

export function noteKey(code: string, date: string): string {
  return `${code}|${date}`;
}

export function truncateNote(note: DailyNote): DailyNote {
  return {
    ...note,
    risk: note.risk.slice(0, 200),
    remark: note.remark.slice(0, 2000),
    summary: note.summary?.slice(0, 1000),
  };
}

export function mergeMeta(local: EtfReviewMeta | null, remote: EtfReviewMeta | null): EtfReviewMeta {
  if (!local && !remote) return defaultMeta(new Date().toISOString());
  if (!local) return remote!;
  if (!remote) return local;
  if (local.updatedAt === SEED_TS) return remote;
  if (remote.updatedAt === SEED_TS) return local;
  if (remote.resetAt && remote.resetAt >= local.updatedAt) return remote;
  if (local.resetAt && local.resetAt >= remote.updatedAt) return local;
  const preferred = remote.updatedAt >= local.updatedAt ? remote : local;
  const coreStamp = (meta: EtfReviewMeta) => meta.workspaceUpdatedAt ?? (local.workspaceUpdatedAt || remote.workspaceUpdatedAt ? meta.savedAt : meta.updatedAt);
  const primary = coreStamp(remote) >= coreStamp(local) ? remote : local;
  const secondary = primary === remote ? local : remote;
  const times = (a: Record<string, string> = {}, b: Record<string, string> = {}) => {
    const result = { ...a }; for (const [key, value] of Object.entries(b)) if (!result[key] || value >= result[key]) result[key] = value; return result;
  };
  const deletedGroups = times(local.deletedGroups, remote.deletedGroups);
  const deletedWatchlist = times(local.deletedWatchlist, remote.deletedWatchlist);
  const groupMap = new Map<string, ReviewGroup>();
  const groupStamp = new Map<string, string>();
  for (const meta of [secondary, primary]) for (const group of meta.groups) {
    const existing = groupMap.get(group.id);
    if (!existing || (group.updatedAt ?? coreStamp(meta)) >= groupStamp.get(group.id)!) { groupMap.set(group.id, group); groupStamp.set(group.id, group.updatedAt ?? coreStamp(meta)); }
  }
  const groups = [...primary.groups, ...secondary.groups].filter((group, index, all) => all.findIndex(item => item.id === group.id) === index)
    .map(group => groupMap.get(group.id)!).filter(group => !deletedGroups[group.id] || deletedGroups[group.id] < groupStamp.get(group.id)!)
    .map((group, order) => ({ ...group, order }));
  const watchMap = new Map<string, EtfReviewMeta['watchlist'][number]>();
  for (const meta of [secondary, primary]) for (const watch of meta.watchlist) {
    const existing = watchMap.get(watch.code);
    if (!existing || (watch.updatedAt ?? watch.addedAt) >= (existing.updatedAt ?? existing.addedAt)) watchMap.set(watch.code, watch);
  }
  const watchlist = [...watchMap.values()].filter(watch => !deletedWatchlist[watch.code] || deletedWatchlist[watch.code] < (watch.updatedAt ?? watch.addedAt));
  const groupIds = new Set(groups.map(group => group.id));
  const memberships: Record<string, string[]> = {};
  for (const code of new Set([...Object.keys(local.memberships), ...Object.keys(remote.memberships), ...Object.keys(local.membershipUpdatedAt ?? {}), ...Object.keys(remote.membershipUpdatedAt ?? {})])) {
    const source = (remote.membershipUpdatedAt?.[code] ?? coreStamp(remote)) >= (local.membershipUpdatedAt?.[code] ?? coreStamp(local)) ? remote : local;
    const fallback = source === remote ? local : remote;
    const ids = source.memberships[code] ?? (source.membershipUpdatedAt?.[code] ? undefined : fallback.memberships[code]);
    if (ids && (!deletedWatchlist[code] || deletedWatchlist[code] < (source.membershipUpdatedAt?.[code] ?? coreStamp(source)))) memberships[code] = ids.filter(id => groupIds.has(id));
  }
  const mergeItems = <T extends { updatedAt: string }>(a: Record<string, T> = {}, b: Record<string, T> = {}) => {
    const result = { ...a }; for (const [key, value] of Object.entries(b)) if (!result[key] || value.updatedAt >= result[key].updatedAt) result[key] = value; return result;
  };
  const groupCodeOrder = { ...secondary.groupCodeOrder, ...primary.groupCodeOrder };
  const mergeOptOut = (a: Record<string, string[]> = {}, b: Record<string, string[]> = {}) => {
    const result: Record<string, string[]> = { ...a };
    for (const [code, ids] of Object.entries(b)) {
      result[code] = [...new Set([...(result[code] ?? []), ...ids])];
    }
    return result;
  };
  const catalogMembershipOptOut = mergeOptOut(local.catalogMembershipOptOut, remote.catalogMembershipOptOut);
  return {
    ...preferred, groups, watchlist, memberships, notes: mergeItems(local.notes, remote.notes),
    ...(local.dailyPremiums || remote.dailyPremiums ? { dailyPremiums: mergeItems(local.dailyPremiums, remote.dailyPremiums) } : {}),
    ...(local.groupCodeOrder || remote.groupCodeOrder ? { groupCodeOrder } : {}),
    ...(local.workspaceUpdatedAt || remote.workspaceUpdatedAt ? { workspaceUpdatedAt: coreStamp(primary) } : {}),
    ...(local.membershipUpdatedAt || remote.membershipUpdatedAt ? { membershipUpdatedAt: times(local.membershipUpdatedAt, remote.membershipUpdatedAt) } : {}),
    ...(Object.keys(catalogMembershipOptOut).length ? { catalogMembershipOptOut } : {}),
    ...(Object.keys(deletedGroups).length ? { deletedGroups } : {}),
    ...(Object.keys(deletedWatchlist).length ? { deletedWatchlist } : {}),
  };
}

export function poolCodes(gridCodes: string[], watchlist: { code: string }[]): string[] {
  const set = new Set<string>();
  for (const code of gridCodes) set.add(code);
  for (const w of watchlist) set.add(w.code);
  return [...set];
}

export function orderedGroupCodes(codes: string[], order: string[] = []): string[] {
  const available = new Set(codes);
  return [...new Set([...order.filter(code => available.has(code)), ...codes])];
}

export function filterByGroups(
  codes: string[],
  memberships: Record<string, string[]>,
  selectedGroupIds: string[],
): string[] {
  if (!selectedGroupIds.length) return [...codes];
  const selected = new Set(selectedGroupIds);
  return codes.filter(code => {
    const groups = memberships[code];
    if (!groups?.length) return false;
    return groups.some(g => selected.has(g));
  });
}

type TombstoneLike = { deleted: true };

function isTombstoneItem(item: unknown): item is TombstoneLike & Record<string, unknown> {
  return !!item && typeof item === 'object' && (item as TombstoneLike).deleted === true;
}

export function splitCloudItems(items: unknown[]): {
  meta: EtfReviewMeta | null;
  records: unknown[];
  tombstones: unknown[];
} {
  let meta: EtfReviewMeta | null = null;
  const records: unknown[] = [];
  const tombstones: unknown[] = [];
  for (const item of items) {
    if (isEtfReviewMeta(item)) {
      if (!meta || Date.parse(item.updatedAt) >= Date.parse(meta.updatedAt)) meta = item;
      continue;
    }
    if (isTombstoneItem(item)) {
      tombstones.push(item);
      continue;
    }
    if (item && typeof item === 'object' && 'row' in item && 'result' in item) {
      records.push(item);
    }
  }
  return { meta, records, tombstones };
}
