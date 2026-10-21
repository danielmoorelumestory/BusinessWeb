import { SYNC_ENDPOINT } from './endpoints';
import { readSyncKey } from './grid-trading';
import { isTechnicalFresh, isUsableSnapshot, type TechnicalSnapshot, type ReviewRecord } from './review-technical';

const CACHE_KEY = 'etf-review-technical-v1';
const empty = () => ({} as Record<string, TechnicalSnapshot>);
export function readTechnicalCache(): Record<string, TechnicalSnapshot> {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return empty();
    return Object.fromEntries(Object.entries(value).filter(([code, entry]) => /^\d{6}$/.test(code) && isUsableSnapshot(entry))) as Record<string, TechnicalSnapshot>;
  } catch { return empty(); }
}
function cacheSnapshot(code: string, snapshot: TechnicalSnapshot) {
  const cache = readTechnicalCache(), previous = cache[code];
  if (previous && (previous.record.day!.asOf > snapshot.record.day!.asOf || previous.updatedAt > snapshot.updatedAt)) return previous;
  cache[code] = snapshot;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* 缓存不可写时仍使用数据库结果。 */ }
  return snapshot;
}

/** 本地快照即时显示；未过期不发请求，过期先读D1，D1仍过期才让后台更新。 */
export async function loadReviewTechnical(codes: string[], apply: (code: string, record: ReviewRecord) => void): Promise<void> {
  const unique = [...new Set(codes.filter(code => /^\d{6}$/.test(code)))];
  const cache = readTechnicalCache();
  for (const code of unique) if (cache[code]) apply(code, cache[code].record);
  const pending = unique.filter(code => !isTechnicalFresh(cache[code]));
  if (!pending.length) return;
  const token = readSyncKey();
  if (token.length < 16) throw new Error('请先配置同步密钥以读取已保存指标');
  const headers = { authorization: `Bearer ${token}` };
  const queue: string[] = [];
  const applySaved = (code: string, value: unknown) => {
    if (!isUsableSnapshot(value)) return false;
    const entry = cacheSnapshot(code, value);
    apply(code, entry.record);
    return isTechnicalFresh(entry);
  };
  for (let index = 0; index < pending.length; index += 50) {
    const batch = pending.slice(index, index + 50);
    const response = await fetch(`${SYNC_ENDPOINT}/review/technical?codes=${batch.join(',')}`, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('数据库指标暂不可用，保留已显示状态');
    const data = await response.json() as { records?: Record<string, unknown> };
    if (!data.records || Array.isArray(data.records)) throw new Error('指标服务尚未就绪，保留已显示状态');
    for (const code of batch) if (!applySaved(code, data.records[code])) queue.push(code);
  }
  const errors: string[] = [];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const code = queue.shift()!;
      try {
        const response = await fetch(`${SYNC_ENDPOINT}/review/technical?code=${code}`, { method: 'POST', headers, signal: AbortSignal.timeout(120000) });
        const data = await response.json() as { snapshot?: unknown; pending?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error ?? '后台更新失败');
        if (data.pending) {
          // 另一页面已在更新时不重复抓取；短暂等待后再只读数据库。
          await new Promise(resolve => setTimeout(resolve, 1500));
          const retry = await fetch(`${SYNC_ENDPOINT}/review/technical?codes=${code}`, { headers, signal: AbortSignal.timeout(15000) });
          if (!retry.ok) throw new Error('指标读取失败');
          const saved = await retry.json() as { records?: Record<string, unknown> };
          if (!applySaved(code, saved.records?.[code])) errors.push(`${code} 正在后台更新`);
        } else if (!applySaved(code, data.snapshot)) {
          throw new Error('后台未返回有效指标');
        }
      } catch { errors.push(`${code} 更新失败，保留原状态`); }
    }
  }));
  if (errors.length) throw new Error(errors.join('；'));
}
