## Why

经济脉搏的每日复盘（`/api/pulse-sync`）和研究笔记的候选池（`/api/candidates-sync`）目前只能把云端副本存到 Supabase。用户没有 Supabase 账号，线上这两个接口一直返回 503，数据只存在浏览器里，换设备或清缓存就丢。用户主要部署在 Cloudflare，且已经在用 D1（网格交易的 Worker），用 D1 存这两份数据不需要再开一个服务、多管一套密钥。

## What Changes

- `/api/pulse-sync` 与 `/api/candidates-sync` 的服务端存储从 Supabase 换成 Cloudflare D1；请求路径、方法、`ETag`/`If-Match` 乐观并发、`X-Allow-Shrink`、状态码、请求与响应格式、`PULSE_SYNC_TOKEN` 鉴权**全部保持不变**，前端不改。
- 新增一个 D1 数据库 `businessweb`（只存这两份快照与复盘历史），在 Pages 项目里以绑定名 `DB` 绑定。
- Pages Functions 适配器把 `context.env` 以 `req.env` 传给处理函数，处理函数从 `req.env.DB` 取 D1。
- 抽出一个小的存储模块（读取快照、带版本号的写入、复盘历史保留 30 份），两个接口共用，并用 Node 内置的 `node:sqlite` 做测试，不新增依赖。
- 删除这两个接口对 Supabase 的所有代码，以及不再使用的迁移文件 `202610020002_pulse_reviews.sql`、`202610020003_candidates.sql`。
- **BREAKING**：Vercel 与 GitHub Pages 构建线没有 D1，这两个接口在那里恢复为"尚未配置"（503）。主要使用 Cloudflare，影响可以接受。
- 评论（`/api/comments`）仍然使用 Supabase，不在本变更范围；`SUPABASE_URL`、`SUPABASE_SECRET_KEY` 因此继续保留，但只与评论有关。

## Capabilities

### New Capabilities
- `pulse-candidates-d1-sync`: 复盘与候选池在 D1 上的云端同步——快照读取、版本号乐观并发、复盘防大面积误删与历史保留、未绑定数据库时的明确提示。

### Modified Capabilities
- `workers-api-runtime`: 需求"密钥只在服务端配置"需要补充 D1 绑定 `DB`，并说明 Supabase 变量只用于评论。

## Impact

- 代码：`api/pulse-sync.ts`、`api/candidates-sync.ts`（重写存储部分）、新增 `server/d1Snapshot.ts`、`server/edge/adapter.mjs`（传入 `env`）、`scripts/check-functions.mjs`、`vite.config.js`（本地开发代理目标）、对应测试。
- 数据与平台：新建 D1 `businessweb` 并应用 `d1/schema.sql`；在 Cloudflare Pages 的 Settings → Bindings 添加 D1 绑定 `DB`（生产与预览）；添加 Secret `PULSE_SYNC_TOKEN`（至少 32 字符）；需要重新部署一次。
- 文档：`docs/DEPLOYMENT.md`、`docs/cloudflare-pages.md`、`.env.example`、`README.md` 里关于同步的说明。
- 不影响：前端代码、章节评论、网格交易（走自己的 Worker 与 D1）、其他任何页面。
- 不涉及数据迁移：Supabase 从未配置，没有历史云端数据。
