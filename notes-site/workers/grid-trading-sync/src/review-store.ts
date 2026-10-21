import { calculateReviewTechnical, isTechnicalFresh, isUsableSnapshot, TECHNICAL_VERSION, type ReviewCandle, type TechnicalSnapshot } from '../../../src/lib/review-technical';

export const REVIEW_TABLE_SQL = `CREATE TABLE IF NOT EXISTS review_technical (
  code TEXT PRIMARY KEY, payload TEXT, updated_at INTEGER NOT NULL DEFAULT 0,
  refreshing_until INTEGER NOT NULL DEFAULT 0
)`;

export async function ensureReviewTable(db: D1Database) { await db.prepare(REVIEW_TABLE_SQL).run(); }

export async function readTechnicalSnapshots(db: D1Database, codes: string[]): Promise<Record<string, TechnicalSnapshot>> {
  if (!codes.length) return {};
  await ensureReviewTable(db);
  const { results } = await db.prepare(`SELECT code, payload FROM review_technical WHERE code IN (${codes.map(() => '?').join(',')})`).bind(...codes).all<{ code: string; payload: string | null }>();
  const records: Record<string, TechnicalSnapshot> = {};
  for (const row of results) {
    try { const entry = JSON.parse(row.payload ?? 'null'); if (isUsableSnapshot(entry)) records[row.code] = entry; } catch { /* 忽略损坏结果；旧版本但结构完整的结果保留用于显示。 */ }
  }
  return records;
}

export async function saveTechnicalSnapshot(db: D1Database, code: string, candles: ReviewCandle[], now = Date.now()): Promise<TechnicalSnapshot> {
  const beijing = new Date(now + 8 * 3600_000);
  const today = beijing.toISOString().slice(0, 10);
  const latest = candles.reduce((date, candle) => candle.date > date ? candle.date : date, '');
  const record = calculateReviewTechnical(candles, latest !== today || beijing.getUTCHours() >= 15);
  if (!record) throw new Error('暂无有效历史行情，未覆盖已保存指标');
  const previous = (await readTechnicalSnapshots(db, [code]))[code];
  if (previous?.record.day && record.day!.asOf < previous.record.day.asOf) throw new Error('行情日期落后，保留已有指标');
  const snapshot = { version: TECHNICAL_VERSION, record, updatedAt: now };
  await db.prepare(`INSERT INTO review_technical (code, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    WHERE excluded.updated_at >= review_technical.updated_at`).bind(code, JSON.stringify(snapshot), now).run();
  return snapshot;
}

/** D1 租约防止多个页面/设备同时为同一标的重复抓取。 */
export async function refreshTechnicalSnapshot(db: D1Database, code: string, load: () => Promise<ReviewCandle[]>, now = Date.now()) {
  const previous = (await readTechnicalSnapshots(db, [code]))[code] ?? null;
  if (isTechnicalFresh(previous, now)) return { snapshot: previous, refreshed: false };
  await db.prepare('INSERT INTO review_technical (code) VALUES (?) ON CONFLICT(code) DO NOTHING').bind(code).run();
  const leaseUntil = now + 180_000;
  const lease = await db.prepare('UPDATE review_technical SET refreshing_until = ? WHERE code = ? AND refreshing_until <= ?').bind(leaseUntil, code, now).run();
  if (!lease.meta.changes) return { snapshot: previous, pending: true };
  try {
    const snapshot = await saveTechnicalSnapshot(db, code, await load());
    return { snapshot, refreshed: true };
  } finally {
    await db.prepare('UPDATE review_technical SET refreshing_until = 0 WHERE code = ? AND refreshing_until = ?').bind(code, leaseUntil).run();
  }
}
