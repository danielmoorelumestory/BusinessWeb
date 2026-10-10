## Context

主站现状：路由在 `src/App.tsx`（`/grid-trading`、`/grid-trading/records`、`/grid-trading/records/:recordId`），对应 `GridCalculator`、`GridRecords`、`GridRecordDetail` 三页；`src/utils/seo.ts` 有两条条目；`src/data/siteMap.ts` 与 `src/data/aiLab.ts` 各有一条入口。代码约 3100 行（含测试），集中在 `src/pages/Grid*.tsx` 与 `src/features/grid-trading/`。云同步走 Supabase（`api/grid-sync.ts`、`functions/api/grid-sync.js`），使用者从未启用过（线上返回 503）。`api/grid-market` 被热力图（`src/services/heatmapQuotes.ts`）使用，不能删除；`pulse-sync`、`candidates-sync` 是另外两个 Supabase 同步，也要保留。

notes：`notes-site/` 目前是 notes 的 `902f04b` 的副本（规则版本 4）。notes 仓库 `HEAD` 为 `35f3747`，多出 4 个提交：`696d258` 恢复删除成交的二次确认；`896c8c3` 反弹买入/回落卖出改为真实触发（规则 4→5，附带 `rebound-pullback-trigger` 变更，任务全部勾选但未归档，含增量规格 `grid-trigger-rules`）；`0978809` 迁入"股市分析 lab"（Vue 3，`src/components/stock/*.vue` 约 5000 行，`/lab/stock`）并增加 Worker 的 `/cls` 转发，同时改进网格详情页；`35f3747` 收盘 cron 把 CLS 板块日数据写入 D1 新表 `cls_plate_day`，Worker 新增 `/stock/plate`、`/stock/plates`、`/stock/plate/dates`、`/stock/sync`。这些改动涉及 27 个文件，包括 `astro.config.mjs`（加入 `@astrojs/vue` 集成）、`package.json` 与锁文件（新增 `vue`、`@astrojs/vue`）。

notes 的详情页用查询参数 `?id=` 取记录 id（已在源码里确认）。线上 `/note/` 已经部署了旧版 notes；Worker 与 D1 由使用者手动部署，无法从外部判断它们是否已是最新。

此前的约定仍然有效：`notes-site` 是一次性复制来的源码，此后在 BusinessWeb 里维护；主站 Header 的"笔记"入口只在 Cloudflare 构建里出现（`VITE_NOTES_PATH`）；Cloudflare 构建失败时会保留上一个正常的部署。

## Goals / Non-Goals

**Goals:**
- `notes-site` 与 notes 仓库 `35f3747` 一致（除 Cloudflare 构建所需的配置分支外），以最新规则为准。
- 主站只保留一套网格交易实现，即 notes 的；旧入口与旧路径都能到达它。
- 不在任何一条构建线上留下 404 或悬空引用。
- 删除主站网格代码与 Supabase 网格同步后，其余功能（热力图、Pulse、候选池）不受影响。

**Non-Goals:**
- 不把 notes 的网格页重写成 React。
- 不处理"股市分析 lab"与主站板块轮动、涨停分析、`api/cls-plate` 的重叠（留给后续变更 `replace-stock-tools`）。
- 不迁移主站浏览器里的旧网格记录（已确认无价值）。
- 不自动部署 Worker，不为 notes 补测试，不整合笔记与报告内容。

## Decisions

### 1. 用补丁而不是整体重新复制来同步
对 notes 仓库生成 `902f04b..35f3747` 的补丁（排除 `openspec/`），以 `notes-site/` 为根应用。
- 理由：此前复制时 `notes-site` 内唯一的本地改动是 `astro.config.mjs` 的 Cloudflare 分支，用补丁可以精确地只带入新提交，冲突范围明确；整体重新复制会覆盖那处改动，也不利于核对到底变了什么。
- 备选：整体重新复制再手工恢复配置分支。放弃，容易漏掉本地改动。
- `astro.config.mjs` 预计会冲突，手工合并后应同时具备：`@astrojs/vue` 集成、`isCloudflare`/`SITE_URL` 分支、`base: '/note'`。合并后用不同环境变量（默认、`CF_PAGES=1`、`VERCEL=1`）各构建一次，确认三条分支行为与同步前一致。
- 同步后在 `notes-site` 内重新 `npm ci`，并确认锁文件与 `package.json` 一致。

### 2. `rebound-pullback-trigger` 变更迁入归档，规格同步为主规格
该变更的 4 组任务已全部完成。复制到 `openspec/changes/archive/`，目录名使用它在 notes 中最后一次提交的日期作为前缀；其增量规格 `grid-trigger-rules` 是新能力，同步为 `openspec/specs/grid-trigger-rules/spec.md`，与 notes 自己归档时的做法一致。
- 理由：规格应与代码处于同一个仓库，规则 v5 的行为契约不应留在即将归档的 notes 仓库里。

### 3. 旧路径用"两层"跳转：Cloudflare 服务端 302 + 前端兜底组件
- Cloudflare 层：`public/_redirects` 里写 302 临时跳转，`_redirects` 在 SPA 回退之前生效。映射：`/grid-trading` → `/note/lab/grid-trading/`；`/grid-trading/records` → `/note/lab/grid-trading/saved/`；`/grid-trading/records/:id` → `/note/lab/grid-trading/detail/?id=:id`。
  - 先用 302 而不是 301：永久跳转会被浏览器长期缓存，万一要回退很麻烦；稳定后再改。
  - 目标地址里带查询参数的占位符写法是否被 Pages 支持，需要在本地与线上实测；不支持就由第二层兜底。
- 前端层：保留一个很小的 `GridMoved` 路由组件，匹配 `/grid-trading/*`。设置了 `VITE_NOTES_PATH` 的构建（Cloudflare）用 `window.location.replace` 跳到对应的 `/note/` 页面；其他构建（Vercel、GitHub Pages）没有 `/note/`，显示"网格交易已迁移"的说明并给出指向 `https://businessweb-c0u.pages.dev/note/lab/grid-trading/` 的链接。
- 理由：只靠 `_redirects` 的话，Vercel 与 GitHub Pages 两条构建线上旧路径会变成 404 或"这一页不存在"；只靠前端跳转的话，Cloudflare 上多一次页面加载，也不利于搜索引擎。
- 备选：直接删除旧路由，让它落到"未找到"页。放弃，旧链接（书签、外部引用）会失效。

### 4. 站内入口用普通链接
`siteMap` 与 `aiLab` 的入口改指向 `/note/lab/grid-trading/`。渲染这些入口的组件对以 `/note/` 开头的路径必须使用普通 `<a href>`，不能用 React Router 的 `Link`，否则会被前端路由接管而显示"这一页不存在"。这与已有的 Header"笔记"入口原因相同。具体的渲染位置在实施时核对。
- 其他构建线上这些入口会指向不存在的 `/note/...`，由决策 3 的兜底组件接不住（因为路径本身就以 `/note/` 开头，不会进入 `/grid-trading/*`）。处理办法：入口的目标路径随构建变化——设置了 `VITE_NOTES_PATH` 时指向 `/note/lab/grid-trading/`，否则指向 `/grid-trading`，由兜底组件显示迁移说明。

### 5. 删除范围按"引用图"确定，并以构建失败兜底
删除 `src/pages/Grid*.tsx`（含测试）、`src/features/grid-trading/`、`src/services/gridSyncApi.test.ts` 及其对应的服务文件（若存在）、`api/grid-sync.ts`、`functions/api/grid-sync.js`、迁移脚本 `supabase/migrations/202610020001_grid_sync.sql`、`scripts/check-functions.mjs` 与 `scripts/check-deployment.mjs` 里的 `grid-sync` 项、`.env.example` 的 `GRID_SYNC_TOKEN`、文档里的相关段落（`DEPLOYMENT.md`、`README.md`、`docs/cloudflare-pages.md`）。历史计划文档 `docs/superpowers/plans/...` 作为历史记录保留不改。
- 删除后全局搜索 `grid-trading`、`gridSync`、`grid-sync`、`GRID_SYNC_TOKEN`，每一处残留都要有明确结论；TypeScript 编译与构建失败即视为遗漏。
- **必须保留** `api/grid-market`、`functions/api/grid-market.js`、`server/market.mjs`（热力图在用）。

### 6. 保活工作流改读 `pulse-sync`
`.github/workflows/cloud-keepalive.yml` 目前用 `GRID_SYNC_TOKEN` 读取 `/api/grid-sync`，作用是定期访问 Supabase 防止免费项目被暂停。网格同步删除后改为读取 `/api/pulse-sync` 并使用 `PULSE_SYNC_TOKEN`。该工作流在 GitHub 上从未运行过，改动不会影响线上。
- 备选：直接删除该工作流。放弃，Supabase 仍被 Pulse 与候选池使用，保活仍有意义。

### 7. 先同步再替换，两部分分开提交与验证
先完成第 1 部分并让 `build:cloudflare` 通过、浏览器里实测 notes 的网格能回测，再开始第 2 部分的删除。
- 理由：如果同步出了问题（例如 Vue 集成构建失败），还没有删除任何主站代码，可以随时停下；替换只依赖"`/note/lab/grid-trading/` 可用"这一个前提。

## Risks / Trade-offs

- [规则 v5 会改变网格计算结果] → 这正是"以 notes 为准"的目的；旧结果不迁移，使用者已确认主站旧记录无价值。
- [Worker 与 D1 不是最新，新页面调用不存在的接口] → 任务中明确要求使用者确认并完成部署；网格计算器与已保存标的页主要使用原有的分钟线、日线接口，受影响的主要是新的"股市分析 lab"。线上验证时区分这两类。
- [`astro.config.mjs` 合并出错导致某条环境分支（Vercel、GitHub Pages、Cloudflare）的 `base` 或 `site` 变化] → 合并后用三组环境变量各构建一次并核对输出，同步前后对比。
- [Vue 集成让 `notes-site` 构建变慢、体积变大] → 记录构建时间与 `dist/note` 体积；Pages 的单次部署文件数与单文件大小限制仍有很大余量（上次构建为 4602 个文件、105MB）。
- [notes 没有测试，同步后无法自动证明网格计算正确] → 用构建、链接检查和浏览器实测验证；补测试不在本变更内。
- [删除 `src/features/grid-trading/` 可能误伤其他模块的引用] → 删除前先用全局搜索列出所有引用；删除后靠 TypeScript 编译与构建兜底。
- [`_redirects` 带参数的占位符不被支持，导致详情页旧链接丢失 `id`] → 本地与线上都实测；不支持时由 `GridMoved` 在前端补上 `?id=`。
- [其他构建线（Vercel、GitHub Pages）失去网格功能] → 它们没有 `/note/`，只能显示迁移说明并链接到 Cloudflare 站点上的计算器；这是"只保留一套实现"的直接后果，已在提案中说明。

## Migration Plan

1. 确认 notes 仓库工作区干净、`HEAD` 为 `35f3747`；记录基线（当前 `build:cloudflare` 的输出文件清单与构建时间）。
2. 生成补丁并应用到 `notes-site/`，手工合并 `astro.config.mjs`，`npm ci`，单独构建 `notes-site`。
3. 迁入 `rebound-pullback-trigger` 变更与 `grid-trigger-rules` 规格，更新迁移文档。
4. 运行 `build:cloudflare`，核对 `/note/lab/grid-trading/`、`saved`、`detail`、`minute`、`/note/lab/stock/` 的产出与链接检查；本地用 wrangler 提供产物，在浏览器里实测网格回测。
5. 替换主站：改入口、加 `GridMoved` 与 `_redirects`、改 `seo`；本地验证三条旧路径的跳转目标。
6. 删除旧代码与 Supabase 网格同步，改保活工作流与文档，全局搜索残留。
7. 运行全部测试、类型检查与三种构建。
8. 使用者确认后推送；推送前先请使用者确认 Worker 与 D1 已更新。
9. 线上验证：旧路径跳转、`/note/lab/grid-trading/` 回测、`api/grid-market`、`pulse-sync`、`candidates-sync` 不受影响。

回滚：把 `public/_redirects` 里的跳转去掉并回退相关提交即可恢复；因为跳转用的是 302，浏览器不会长期缓存。删除的代码在 Git 历史中。

## 实施中的发现与结论

- **`_redirects` 的查询参数占位符本地可用**：`/grid-trading/records/abc123` 跳到 `/note/lab/grid-trading/detail/?id=abc123`，特殊字符的 id 保持编码（`a%26b` 不会被拆成额外参数）。仍需在线上再实测一次。
- **尾斜杠变体不会被 `_redirects` 的无斜杠规则匹配**：`/grid-trading/` 与 `/grid-trading/records/` 需要各加一条显式规则，已补上。
- **前端兜底有效**：去掉 `_redirects` 后，Cloudflare 构建里三条旧路径都由 `GridMoved` 跳到正确的 `/note/` 页面；普通构建显示迁移说明，按钮链接带着记录 id。
- **引用图比设计预想的多**：`vite.config.js` 的测试 `setupFiles` 指向网格目录里的 `testSetup.ts`（所有测试依赖它，已挪到 `src/testSetup.ts`）；`tsconfig.grid.json` 被 `typecheck` 脚本引用（改造为 `tsconfig.app.json`，覆盖新增文件）；`tsconfig.server.json` 引用了两个网格文件；主规格里另一条需求（"密钥只在服务端配置"）也列了 `GRID_SYNC_TOKEN`，已补进增量规格。
- **`notesLinks` 必须能在纯 Node 里加载**：构建期有一个 Node 步骤会把 `aiLab.ts` 打包后执行，纯 Node 里 `import.meta.env` 是 `undefined`，直接读属性会让构建退出码变成 1。已改为 `typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_NOTES_PATH || '' : ''`。曾试过改成可选链 `import.meta.env?.…`，会让 Vite 与 vitest 的静态替换失效（4 条测试因此变红），所以没有采用。
- **字符串搜索不能证明构建产物的行为**：`build:cloudflare` 产物里搜不到 `/note/lab/grid-trading/` 字样（压缩器把它拆成两段字符串），但用真实浏览器渲染 `/invest` 与 `/ai`，网格卡片的 `href` 确实是 `/note/lab/grid-trading/`。
- 验证新版 notes 页面时，MCP 浏览器工具被一个运行了 25 小时的外部 Chrome 进程占用，没有强行关闭，改用另起的独立无界面 Chrome（通过 CDP 驱动）。

## Open Questions

- `_redirects` 目标地址里的查询参数占位符：本地已验证可用，待线上再确认一次。
- 站点地图：生成脚本与已生成的 `sitemap.xml` 都列了 `/grid-trading`，已移除；`robots.txt` 里的 `Disallow: /grid-trading/records` 也已移除。
- 主站"AI 实验室"与"正念投资"页面里网格入口的卡片，在其他构建线上的文案是否需要调整，实施时看实际渲染再定。
