export const ETF_REVIEW_META_ID = 'meta:etf-review-v1';
export const SEED_TS = '1970-01-01T00:00:00.000Z';

export type DailyNote = {
  emotion: '冷静' | '犹豫' | 'FOMO' | '恐慌' | '';
  conclusion: '看多' | '中性' | '看空' | '';
  action: '加仓' | '减仓' | '观望' | '调参' | '';
  risk: string;
  remark: string;
  updatedAt: string;
};

export type ReviewGroup = { id: string; name: string; order: number };

export type EtfReviewMeta = {
  id: typeof ETF_REVIEW_META_ID;
  kind: 'etf-review-meta';
  savedAt: string;
  updatedAt: string;
  groups: ReviewGroup[];
  watchlist: { code: string; name: string; addedAt: string }[];
  memberships: Record<string, string[]>;
  notes: Record<string, DailyNote>;
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
    remark: note.remark.slice(0, 500),
  };
}

export function mergeMeta(local: EtfReviewMeta | null, remote: EtfReviewMeta | null): EtfReviewMeta {
  if (!local && !remote) return defaultMeta(new Date().toISOString());
  if (!local) return remote!;
  if (!remote) return local;
  const localTs = Date.parse(local.updatedAt) || 0;
  const remoteTs = Date.parse(remote.updatedAt) || 0;
  return remoteTs >= localTs ? remote : local;
}

export function poolCodes(gridCodes: string[], watchlist: { code: string }[]): string[] {
  const set = new Set<string>();
  for (const code of gridCodes) set.add(code);
  for (const w of watchlist) set.add(w.code);
  return [...set];
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
