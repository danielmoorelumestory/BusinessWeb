-- BusinessWeb 的 D1 数据库：经济脉搏每日复盘与研究笔记候选池的云端快照。
-- 全部使用 IF NOT EXISTS / INSERT OR IGNORE，重复执行不会清空已有数据。
-- 应用：npx wrangler d1 execute businessweb --remote --file=d1/schema.sql

-- 每份数据一条整份快照，kind 区分；revision 是乐观并发用的版本号，每次成功写入加一。
CREATE TABLE IF NOT EXISTS sync_snapshot (
  kind TEXT PRIMARY KEY CHECK (kind IN ('pulse', 'candidates')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO sync_snapshot (kind, revision, payload, updated_at)
VALUES ('pulse', 0, '{"schemaVersion":1,"reviews":[]}', '1970-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO sync_snapshot (kind, revision, payload, updated_at)
VALUES ('candidates', 0, '{"schemaVersion":1,"items":[]}', '1970-01-01T00:00:00.000Z');

-- 复盘历史：每次成功写入前保存上一版，只保留最近 30 份，误删或误覆盖时可在控制台里查询找回。
CREATE TABLE IF NOT EXISTS pulse_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision INTEGER NOT NULL,
  payload TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
