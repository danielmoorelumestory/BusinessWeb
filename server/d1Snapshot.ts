// 复盘与候选池的 D1 存储：整份快照 + 版本号乐观并发。只依赖 D1 的最小接口，便于用 node:sqlite 做测试。
// 表结构见 d1/schema.sql。

export type SnapshotKind = 'pulse' | 'candidates'

export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
}
export interface D1Like {
  prepare(sql: string): D1Statement
  batch(statements: D1Statement[]): Promise<Array<{ meta: { changes: number } }>>
}

export type Snapshot = { revision: number; payload: unknown }

export const HISTORY_LIMIT = 30

// 读取一份快照；行不存在（没有应用 schema.sql）返回 null，数据不是合法 JSON 时抛错，由调用方统一处理成 502。
export async function readSnapshot(db: D1Like, kind: SnapshotKind): Promise<Snapshot | null> {
  const row = await db.prepare('SELECT revision, payload FROM sync_snapshot WHERE kind = ?').bind(kind).first<{ revision: number; payload: string }>()
  if (!row) return null
  return { revision: Number(row.revision), payload: JSON.parse(row.payload) }
}

/**
 * 只在云端版本号等于 expectedRevision 时写入，成功后版本号加一，返回 'ok'；否则返回 'conflict' 且不改动任何数据。
 * 全部语句在同一个 batch（同一事务）里，且都带版本号条件：并发请求带相同版本号时只有一个 UPDATE 能命中。
 * keepHistory 为真时先把旧版本存入 pulse_history（同样带版本号条件，冲突时不会产生历史），并只保留最近 HISTORY_LIMIT 份。
 */
export async function writeSnapshot(
  db: D1Like, kind: SnapshotKind, expectedRevision: number, payload: unknown, options: { keepHistory?: boolean } = {},
): Promise<'ok' | 'conflict'> {
  const now = new Date().toISOString()
  const statements: D1Statement[] = []
  if (options.keepHistory) {
    statements.push(db.prepare('INSERT INTO pulse_history (revision, payload, saved_at) SELECT revision, payload, ? FROM sync_snapshot WHERE kind = ? AND revision = ?')
      .bind(now, kind, expectedRevision))
  }
  const updateIndex = statements.length
  statements.push(db.prepare('UPDATE sync_snapshot SET payload = ?, revision = revision + 1, updated_at = ? WHERE kind = ? AND revision = ?')
    .bind(JSON.stringify(payload), now, kind, expectedRevision))
  if (options.keepHistory) {
    statements.push(db.prepare('DELETE FROM pulse_history WHERE id NOT IN (SELECT id FROM pulse_history ORDER BY id DESC LIMIT ?)').bind(HISTORY_LIMIT))
  }
  const results = await db.batch(statements)
  return results[updateIndex].meta.changes === 1 ? 'ok' : 'conflict'
}
