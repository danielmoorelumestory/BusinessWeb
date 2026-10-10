## Context

复盘与候选池各是一份"整份快照 + 版本号"的 JSON：客户端 GET 读取并拿到 `ETag`，PUT 时带 `If-Match`，版本号不符返回 409。目前这套逻辑写在 `api/pulse-sync.ts` 与 `api/candidates-sync.ts` 里，存储走 Supabase 的 REST 与两个 SQL 函数（见 `supabase/migrations/202610020002`、`202610020003`）。用户没有 Supabase，线上这两个接口一直是 503。

处理函数的形态是 Vercel 风格的 `handler(req, res)`，在 Cloudflare 上由 `server/edge/adapter.mjs` 的 `toPagesFunction` 适配。适配器目前不向处理函数暴露 Workers 的 `env`（绑定），只把字符串变量填进 `process.env`；D1 是绑定对象，不能放进 `process.env`。

约束：Pages 项目没有 `wrangler.toml`（避免它成为配置的唯一来源），绑定要在 Cloudflare 控制台里加；`nodejs_compat` 已开；不新增依赖；前端与接口契约不变。

## Goals / Non-Goals

**Goals:**
- 复盘与候选池在 Cloudflare Pages 上用 D1 存储并正常同步，不需要 Supabase。
- 接口契约（路径、方法、头、状态码、请求与响应体、令牌鉴权）与现在完全一致，前端零改动。
- 版本号并发控制是原子的；复盘的防误删与 30 份历史行为不变。
- 存储逻辑集中在一个小模块，用真实的 SQLite 引擎做测试。

**Non-Goals:**
- 章节评论（`/api/comments`）：它需要审核、限流与管理员操作，继续使用 Supabase。
- Vercel 与 GitHub Pages 构建线上的同步能力：它们没有 D1，保持 503。
- 迁移旧数据：Supabase 从未配置，没有云端历史。
- 把两个接口合并成一个，或改变前端同步流程。
- 用户自己的 D1 `grid-trading-sync`：它属于网格 Worker，不复用。

## Decisions

**1. 新建独立的 D1 数据库 `businessweb`，不复用 `grid-trading-sync`。**
网格库由 notes 的 Worker 管理，并且会随 notes 同步更新 `schema.sql`；把无关数据放进去会让两个系统互相牵连。D1 免费额度（数据库个数、读写行数）对个人使用足够。备选：复用网格库——省一次配置，但职责混杂，否决。

**2. 一张快照表加一张历史表，用 `kind` 区分两份数据。**
```
sync_snapshot(kind TEXT PRIMARY KEY CHECK (kind IN ('pulse','candidates')),
              revision INTEGER NOT NULL DEFAULT 0,
              payload TEXT NOT NULL, updated_at TEXT NOT NULL)
pulse_history(id INTEGER PRIMARY KEY AUTOINCREMENT, revision INTEGER NOT NULL,
              payload TEXT NOT NULL, saved_at TEXT NOT NULL)
```
建表时插入两条初始行（版本 0、空数据）。`schema.sql` 全部使用 `IF NOT EXISTS` 与 `INSERT OR IGNORE`，重复执行不会清数据。备选：每份数据一张表——两张结构完全相同，合并更简单。

**3. 原子写入用"带条件的更新"，并用 `batch` 保证历史与更新一起成功。**
D1 没有事务语句，但 `db.batch([...])` 在同一事务里执行。写入顺序：
1. `INSERT INTO pulse_history SELECT … FROM sync_snapshot WHERE kind='pulse' AND revision=?`（只在版本号匹配时才产生历史）；
2. `UPDATE sync_snapshot SET payload=?, revision=revision+1, updated_at=? WHERE kind=? AND revision=?`；
3. 复盘再加一条 `DELETE FROM pulse_history WHERE id NOT IN (SELECT id … ORDER BY id DESC LIMIT 30)`。
根据 `UPDATE` 的 `meta.changes` 判断：为 0 即版本号不匹配，返回 `conflict`；此时第 1 步也因条件不满足而没有插入。两个并发请求带相同版本号时，数据库保证只有一个 `UPDATE` 命中。备选：先读后写——有竞态，否决。

**4. 防误删的检查留在 JS 里，在读取当前快照之后、写入之前做。**
需要比较"现有有效记录数"和"新数据有效记录数"，逻辑沿用现有 SQL 函数的语义（有效 = `deleted` 不为 `'true'`，现有不少于 6 条且新数据少于一半才拒绝）。检查与写入之间的竞态由第 3 点的版本号条件兜底：如果其间有人更新，`UPDATE` 命中 0 行，返回 409 而不是误写入。

**5. 适配器把 `context.env` 传成 `req.env`，处理函数用 `req.env?.DB`。**
适配器已经构造 Node 风格的 `req`，在其上增加只读的 `env` 即可，对其他接口无影响。没有 `env.DB` 时（Vercel、本地单测）返回 503。备选：把 D1 放进 `globalThis`——隐式依赖，难测试，否决。

**6. 存储逻辑放在 `server/d1Snapshot.ts`，对外只要 D1 的最小接口。**
暴露 `readSnapshot(db, kind)` 与 `writeSnapshot(db, kind, expectedRevision, payload, { keepHistory })`，只依赖 `prepare().bind().first()/run()` 和 `batch()`。测试时用 Node 内置的 `node:sqlite` 写一个 D1 形状的薄包装，跑真实的 SQL，覆盖并发、历史与缩减场景；不新增依赖。

**7. 令牌校验先于数据库访问，错误信息保持通用。**
顺序：方法检查 → 配置检查（`env.DB`、令牌至少 32 字符）→ 令牌比较（`timingSafeEqual`）→ 请求体校验 → 数据库。数据库异常统一返回 502"数据库请求失败"，不返回内部消息。

**8. 本地开发。**
`vite` 开发服务器没有 D1。`/api/candidates-sync` 现在代理到 Vercel；把这条代理改到 `https://businessweb-c0u.pages.dev`（并加上 `/api/pulse-sync`），本地页面同步到线上；需要完整本地验证时用 `wrangler pages dev --d1 DB=…`。

## Risks / Trade-offs

- [D1 的 `batch` 语义与预期不一致，导致历史与更新不同步] → 用 `node:sqlite` 的真实事务测试，再用 `wrangler pages dev` 的本地 D1 做一次端到端验证，最后线上用 `curl` 验证一次写入与冲突。
- [绑定没加或绑定名写错，接口一直 503] → 文档里明确写"绑定名必须是 `DB`、生产与预览都要加"，部署后用 `curl` 看状态码从 503 变为 401 再变为 200。
- [Vercel 与 GitHub Pages 构建线失去这两个接口的同步能力] → 已在提案中标注为 BREAKING，用户主要使用 Cloudflare；那两条线上这两个接口本来就因为没有 Supabase 而是 503，实际没有损失。
- [D1 免费额度] → 两条快照、每次写入约 3 行，远低于免费额度；没有定时任务。
- [JSON 以 TEXT 存储，不再有数据库层的 `jsonb` 约束] → 校验在接口层完成（现有校验函数与 1,000,000 字节上限），写入前后都校验；读取时同样校验，结构无效返回 502。
- [旧迁移文件被删除后，若以后想回到 Supabase 需要从 git 历史找回] → 可接受；评论的迁移文件保留。

## Migration Plan

1. 创建 D1：`wrangler d1 create businessweb`，记下数据库名。
2. 应用 `d1/schema.sql`：`wrangler d1 execute businessweb --remote --file=d1/schema.sql`。
3. 合并代码并推送（此时接口仍因没有绑定而返回 503，不影响线上其他功能）。
4. 在 Cloudflare Pages → Settings → Bindings 添加 D1 绑定：变量名 `DB`，选择 `businessweb`，生产与预览环境都加。
5. 在 Variables and Secrets 添加 Secret `PULSE_SYNC_TOKEN`（至少 32 字符，如 `openssl rand -hex 32`）。
6. Retry deployment，用 `curl` 验证：无令牌 401、带令牌 GET 200 且 `ETag: "0"`。
7. 在页面里填入令牌同步，确认复盘与候选池各同步成功一次。
回退：把绑定移除即回到 503，数据保留在 D1 里；代码回退用 git revert。

## Open Questions

- 令牌在页面里的填写位置沿用现有流程，不在本变更讨论；实施时确认前端提示文案里是否还提到 Supabase，若有则一并改掉。
