import { evictCaches, pushCloudPayload } from './grid-trading';
import {
  type DailyNote,
  type EtfReviewMeta,
  type ReviewGroup,
  ETF_REVIEW_META_ID,
  SEED_TS,
  defaultMeta,
  isEtfReviewMeta,
  noteKey,
  truncateNote,
  mergeMeta,
  poolCodes,
  filterByGroups,
  splitCloudItems,
} from './etf-review-meta';

export const ETF_REVIEW_META_KEY = 'etf-review-meta-v1';

export {
  ETF_REVIEW_META_ID,
  SEED_TS,
  type DailyNote,
  type ReviewGroup,
  type EtfReviewMeta,
  defaultMeta,
  isEtfReviewMeta,
  noteKey,
  truncateNote,
  mergeMeta,
  poolCodes,
  filterByGroups,
  splitCloudItems,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return true;
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; code?: unknown; message?: unknown };
  if (e.name === 'QuotaExceededError') return true;
  if (e.code === 22 || e.code === 'QuotaExceededError') return true;
  if (typeof e.message === 'string' && /quota/i.test(e.message)) return true;
  return false;
}

function hasUsableGroups(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object') return false;
  const groups = (meta as { groups?: unknown }).groups;
  return Array.isArray(groups) && groups.length > 0;
}

export function writeMeta(meta: EtfReviewMeta): void {
  const text = JSON.stringify(meta);
  try {
    localStorage.setItem(ETF_REVIEW_META_KEY, text);
    return;
  } catch (first) {
    if (!isQuotaExceededError(first)) throw first;
  }
  evictCaches();
  try {
    localStorage.setItem(ETF_REVIEW_META_KEY, text);
  } catch {
    throw new Error('无法保存 ETF 复盘数据：浏览器存储已满');
  }
}

export function readMeta(): EtfReviewMeta {
  const raw = readJson<unknown>(ETF_REVIEW_META_KEY, null);
  if (isEtfReviewMeta(raw) && hasUsableGroups(raw)) return raw;
  const defaults = defaultMeta(new Date().toISOString());
  const seeded = isEtfReviewMeta(raw)
    ? { ...raw, groups: defaults.groups }
    : defaults;
  writeMeta(seeded);
  return seeded;
}

function touch(meta: EtfReviewMeta): EtfReviewMeta {
  const next = { ...meta, updatedAt: new Date().toISOString() };
  writeMeta(next);
  return next;
}

type NoteFields = Pick<DailyNote, 'emotion' | 'conclusion' | 'action' | 'risk' | 'remark'>;

export function upsertDailyNote(code: string, date: string, fields: NoteFields): EtfReviewMeta {
  const meta = readMeta();
  const key = noteKey(code, date);
  const now = new Date().toISOString();
  const note = truncateNote({ ...fields, updatedAt: now });
  const next: EtfReviewMeta = {
    ...meta,
    notes: { ...meta.notes, [key]: note },
  };
  return touch(next);
}

export function setMemberships(code: string, groupIds: string[]): EtfReviewMeta {
  const meta = readMeta();
  const next: EtfReviewMeta = {
    ...meta,
    memberships: { ...meta.memberships, [code]: [...groupIds] },
  };
  return touch(next);
}

const CODE_RE = /^\d{6}$/;

export function addWatch(code: string, name: string): EtfReviewMeta {
  const trimmed = code.trim();
  if (!CODE_RE.test(trimmed)) throw new Error('无效的 ETF 代码');
  const meta = readMeta();
  const idx = meta.watchlist.findIndex(w => w.code === trimmed);
  const now = new Date().toISOString();
  let watchlist = meta.watchlist;
  if (idx >= 0) {
    watchlist = meta.watchlist.map((w, i) => (i === idx ? { ...w, name } : w));
  } else {
    watchlist = [...meta.watchlist, { code: trimmed, name, addedAt: now }];
  }
  return touch({ ...meta, watchlist });
}

export function removeWatch(code: string): EtfReviewMeta {
  const trimmed = code.trim();
  const meta = readMeta();
  const { [trimmed]: _removed, ...memberships } = meta.memberships;
  const next: EtfReviewMeta = {
    ...meta,
    watchlist: meta.watchlist.filter(w => w.code !== trimmed),
    memberships,
  };
  return touch(next);
}

export function clearReviewWorkspace(): EtfReviewMeta {
  const now = new Date().toISOString();
  const next = { ...defaultMeta(now), updatedAt: now };
  writeMeta(next);
  return next;
}

export async function pushMeta(what = 'ETF 复盘数据'): Promise<string> {
  return pushCloudPayload(readMeta(), what);
}
