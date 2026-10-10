## 1. 存储层与数据库结构

- [x] 1.1 新增 `d1/schema.sql`：`sync_snapshot`、`pulse_history`，初始行用 `INSERT OR IGNORE`，全部 `IF NOT EXISTS`，注明可重复执行
- [x] 1.2 新增 `server/d1Snapshot.ts`：`readSnapshot`、`writeSnapshot`（带条件的 `UPDATE`、`batch` 写历史、历史保留 30 份、按 `meta.changes` 判断冲突）
- [x] 1.3 为存储层写测试（vitest 的 node 环境 + `node:sqlite` 的 D1 形状包装；`vite.config.js` 的 include 增加 `api/**` 与 `server/**`，`testSetup.ts` 在没有 `window` 时跳过浏览器全局）：空快照读取、写入后读取、版本号不匹配返回冲突且数据不变、并发同版本只有一个成功、历史只保留 30 份、`keepHistory: false` 不写历史

## 2. 适配器与接口

- [x] 2.1 修改 `server/edge/adapter.mjs`，把 `context.env` 作为 `req.env` 传给处理函数，并补适配器单元测试（有无 `env` 两种情形）
- [x] 2.2 重写 `api/pulse-sync.ts` 的存储部分：用 `req.env?.DB` 与 `server/d1Snapshot.ts`；保留方法检查、令牌校验（先于数据库访问）、1,000,000 字节与结构校验、`ETag`、`X-Allow-Shrink` 与防误删（422）；数据库异常统一返回 502；读取到结构无效的快照返回 502
- [x] 2.3 重写 `api/candidates-sync.ts` 的存储部分：同上，不做防误删、无历史，响应带 `ETag` 与 `X-Revision`
- [x] 2.4 删除两个文件里对 `SUPABASE_URL`、`SUPABASE_SECRET_KEY` 的读取与 Supabase 请求代码，并把文件头注释改成 D1 的说明
- [x] 2.5 为两个接口写处理函数测试（假的 D1 用 `node:sqlite`）：503（无绑定 / 令牌太短）、401、405、428、413、400、409、422、`X-Allow-Shrink`、502（D1 抛错且不泄露细节）、各自成功的读与写
- [x] 2.6 修改 `scripts/check-functions.mjs`：未配置时仍断言 503 的用例保持通过，补一条"没有绑定也不崩溃"的检查

## 3. 清理与配置

- [x] 3.1 删除 `supabase/migrations/202610020002_pulse_reviews.sql` 与 `202610020003_candidates.sql`（评论与板块历史的迁移保留）
- [x] 3.2 修改 `vite.config.js`：`/api/candidates-sync` 的开发代理改到 `https://businessweb-c0u.pages.dev`，并加上 `/api/pulse-sync`
- [x] 3.3 全局搜索前端与文案中对 Supabase 的提及（同步面板提示、测试），有则改为 Cloudflare 的说法；列出每一处的处理方式。结果：`Pulse.tsx` 同步面板 3 处文案改为 Cloudflare D1 / 服务端变量；旧的两份 Supabase 版接口测试（`pulseSyncApi.test.ts`、`candidates/api.test.ts`）被新测试取代而删除；`.github/workflows/cloud-keepalive.yml`（为防 Supabase 暂停而读取快照，D1 不会暂停，且从未运行过）删除；`clsPlate`、`comments`、`sectorHistory` 仍用 Supabase，不在范围
- [x] 3.4 更新文档：`docs/DEPLOYMENT.md`、`docs/cloudflare-pages.md`（D1 绑定 `DB` 的配置步骤、curl 验证）、`.env.example`（注明 `SUPABASE_*` 只用于评论、`PULSE_SYNC_TOKEN` 的用途）、`README.md`

## 4. 本地端到端验证

- [x] 4.1 `npm test -- --run`、`npm run test:edge`、`npm run test:functions`、`npm run typecheck` 全部通过，补充的新测试包含在内
- [x] 4.2 `npm run build`、`npm run build:pages`、`npm run build:cloudflare` 三种构建都成功
- [x] 4.3 用 `wrangler pages dev` 加本地 D1 做端到端（结果：打包 `.ts` 与 `../server/d1Snapshot.js` 正常；读空快照 `ETag "0"`，写入 200，旧版本号 409，缩减 422，带 `X-Allow-Shrink` 成功并留下历史 revision 0、1，候选池 `X-Revision` 与 `ETag` 一致，缺 `If-Match` 428，POST 405）：建表后 GET 得 `ETag: "0"`、PUT 成功、再 GET 得新内容、旧版本号 PUT 得 409、复盘缩减得 422、带 `X-Allow-Shrink` 成功

## 5. 上线（需要用户确认并参与）

- [ ] 5.1 创建 D1 `businessweb` 并应用 `d1/schema.sql`（执行前向用户确认）
- [ ] 5.2 推送代码（向用户确认），确认线上接口因没有绑定返回 503 且其他页面不受影响
- [ ] 5.3 用户在 Pages 控制台添加 D1 绑定 `DB`（生产与预览）与 Secret `PULSE_SYNC_TOKEN`，重新部署
- [ ] 5.4 线上验证：无令牌 401、带令牌 GET 200 与 `ETag: "0"`、陌生请求头与方法的处理；用户在页面里各同步一次并确认
