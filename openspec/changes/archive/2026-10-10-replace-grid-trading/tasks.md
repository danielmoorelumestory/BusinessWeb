## 1. 准备与基线

- [x] 1.1 确认 notes 仓库（`/Users/train/Documents/notes`）工作区干净、`HEAD` 为 `35f3747`（只读检查，不修改 notes 仓库）
- [x] 1.2 记录基线：当前 `npm run build:cloudflare` 的 `dist/note` 文件清单与文件数、构建耗时，以及 `notes-site` 的 `astro.config.mjs` 在默认、`CF_PAGES=1`、`VERCEL=1` 三种环境下构建出的 `base` 与 RSS 站点地址
- [x] 1.3 确认 `notes-site/` 与 notes `902f04b` 的差异只有 `astro.config.mjs` 的 Cloudflare 分支（对比 `902f04b` 的文件与 `notes-site` 的文件），确保补丁基线可信

## 2. 同步 notes 最新版到 `notes-site`

- [x] 2.1 对 notes 仓库生成 `902f04b..35f3747` 的补丁（排除 `openspec/`），保存到临时目录，核对涉及的文件清单与预期的 27 个文件（排除 `openspec/` 的 5 个后约 22 个）一致
- [x] 2.2 以 `notes-site/` 为根应用补丁；对 `astro.config.mjs` 的冲突手工合并，同时保留 `@astrojs/vue` 集成、`isCloudflare` / `SITE_URL` 分支与 `base: '/note'`；其余文件有冲突时逐个处理并记录
- [x] 2.3 在 `notes-site/` 内执行 `npm ci`，确认锁文件与 `package.json` 一致；确认 `vue` 与 `@astrojs/vue` 已安装
- [x] 2.4 单独构建 `notes-site`：用默认、`CF_PAGES=1`、`VERCEL=1` 三组环境各构建一次，对比 1.2 的基线，确认 `base`、RSS 站点地址与同步前一致
- [x] 2.5 核对源码：`notes-site/src/lib/grid-trading.ts` 的规则版本为 5；`notes-site/workers/grid-trading-sync/schema.sql` 含 `cls_plate_day`；`src/pages/lab/stock/index.astro` 存在
- [x] 2.6 把 notes 的 `rebound-pullback-trigger` 变更复制到 `openspec/changes/archive/`，目录名使用它在 notes 中最后一次提交的日期作为前缀；把其增量规格 `grid-trigger-rules` 同步为 `openspec/specs/grid-trigger-rules/spec.md`（含 Purpose），运行 `openspec validate --specs`

## 3. 构建验证（同步后、替换前）

- [x] 3.1 运行 `npm run build:cloudflare`，确认通过，`dist/note/lab/grid-trading/`、`saved/`、`detail/`、`minute/` 与 `dist/note/lab/stock/` 都存在，链接检查通过；记录新的文件数、体积与构建耗时，与 1.2 对比。结果：14 秒完成，`dist/note` 从 29 个文件变为 35 个（新增 `lab/stock/` 与 Vue 运行时等资源），链接检查通过；整个 `dist` 4608 个文件、105MB
- [x] 3.2 用 `npx wrangler pages dev dist --compatibility-date=2026-10-07 --compatibility-flag=nodejs_compat` 提供产物，在浏览器里打开 `/note/lab/grid-trading/`，获取默认示例行情并回测，确认能出数据；打开 `/note/lab/stock/` 确认页面能渲染（行情接口依赖 Worker，失败属预期，只记录）。结果：用独立的无界面 Chrome（通过 CDP 驱动）实测：新版计算器点"开始回测"后沪深 300 ETF 回测成功（21 买 / 31 卖，区间到 2026-10-09，价格曲线与资金曲线完整），说明文字为规则 v5 的措辞；股市分析 lab、已保存标的、分钟线、详情页均无控制台与网络错误。注：MCP 浏览器工具被一个运行了 25 小时的外部 Chrome 进程占用，未强行关闭
- [x] 3.3 更新 `docs/notes-cohosting.md`：来源提交号改为 `35f3747`，写明新增的 Vue 依赖、Worker 源码有更新（`/cls` 转发、`/stock/*` 接口、`cls_plate_day` 表、收盘 cron 写入）以及"Worker 与 D1 需要使用者自行部署"
- [x] 3.4 **（需使用者操作）** 使用者确认或完成：把 `notes-site/workers/grid-trading-sync/schema.sql` 新增的 `cls_plate_day` 表应用到 D1，并重新部署 Worker；如果 notes 的 GitHub Pages 站点已经在使用新版 Worker，只需告知"已是最新" 结果：2026-10-10 已对线上 D1 `grid-trading-sync` 应用 `schema.sql`（新增 `cls_plate_day`，库内共 7 张表）并 `wrangler deploy` Worker（版本 7617881e），同时把 `businessweb-c0u.pages.dev` 加入来源白名单

## 4. 替换主站入口与路径

- [x] 4.1 找出渲染 `siteMap` 与 `aiLab` 入口的组件，使以 `/note/` 开头的路径使用普通 `<a href>`；为这一行为补组件测试（普通链接，点击不被前端路由拦截）
- [x] 4.2 修改 `src/data/siteMap.ts` 与 `src/data/aiLab.ts`：设置了 `VITE_NOTES_PATH` 时入口指向 `/note/lab/grid-trading/`，否则直接指向 `https://businessweb-c0u.pages.dev/note/lab/grid-trading/`（`SmartLink` 对完整地址也渲染普通 `<a>`，点击不经过中间页）
- [x] 4.3 新增 `GridMoved` 路由组件并为其写测试：`/grid-trading` → `/note/lab/grid-trading/`、`/grid-trading/records` → `.../saved/`、`/grid-trading/records/:id` → `.../detail/?id=:id`；设置了 `VITE_NOTES_PATH` 时用 `window.location.replace` 跳转，否则显示迁移说明与指向 `https://businessweb-c0u.pages.dev/note/lab/grid-trading/` 的链接
- [x] 4.4 修改 `src/App.tsx`：去掉三个网格路由与对应的懒加载导入，加入匹配 `/grid-trading/*` 的 `GridMoved` 路由
- [x] 4.5 修改 `src/utils/seo.ts`：`/grid-trading` 与 `/grid-trading/records` 的条目改为迁移页的 `noindex`（或移除），并检查站点地图生成脚本是否列出了 `/grid-trading`，同步修改
- [x] 4.6 新增 `public/_redirects`：三条旧路径的 302 跳转（`/grid-trading/records/:id` 目标带 `?id=:id`）；注意 `public/` 的内容会进入所有构建线的产物，Vercel 与 GitHub Pages 会忽略该文件

## 5. 删除旧的网格实现与 Supabase 网格同步

- [x] 5.1 用全局搜索列出所有对 `features/grid-trading`、`GridCalculator`、`GridRecords`、`GridRecordDetail`、`gridSync`、`grid-sync`、`GRID_SYNC_TOKEN` 的引用，记录每一处的处理方式；**确认 `api/grid-market`、`functions/api/grid-market.js`、`server/market.mjs` 与 `src/services/heatmapQuotes.ts` 不在删除范围内**。结果：引用图比设计预想的多——另有 `vite.config.js` 的 `setupFiles` 指向 `src/features/grid-trading/testSetup.ts`（全部测试依赖，已先挪到 `src/testSetup.ts`）、`tsconfig.grid.json`（改造为 `tsconfig.app.json`，覆盖新增的 `SmartLink`、`GridMoved`、`notesLinks` 及其测试）、`tsconfig.server.json` 里两个网格文件、规格里另一条需求（"密钥只在服务端配置"）也列了 `GRID_SYNC_TOKEN`（已补进增量规格）；`api/grid-market` 等保留项确认不在删除范围
- [x] 5.2 删除 `src/pages/GridCalculator*`、`GridRecords*`、`GridRecordDetail*`（含测试）与 `src/features/grid-trading/`（含 `parityFixture.json` 与测试）。结果：已删除 3 个页面、`src/features/grid-trading/`（含测试与 `parityFixture.json`）；前端测试从 721 项降到 632 项，减少的是被删除的网格测试
- [x] 5.3 删除 `src/services/gridSyncApi.test.ts` 及其对应的服务文件（先确认它只服务于网格同步，被 Pulse 等其他模块使用的部分要保留）。结果：仅存在 `gridSyncApi.test.ts`（测的是 `api/grid-sync`），没有对应的服务文件；已删除，Pulse 的同步服务不受影响
- [x] 5.4 删除 `api/grid-sync.ts`、`functions/api/grid-sync.js`、`supabase/migrations/202610020001_grid_sync.sql`；从 `scripts/check-functions.mjs` 与 `scripts/check-deployment.mjs` 中移除 `grid-sync` 相关项；从 `.env.example` 移除 `GRID_SYNC_TOKEN`。结果：已删除 `api/grid-sync.ts`、`functions/api/grid-sync.js`、迁移脚本；`check-functions.mjs` 去掉 `grid-sync` 用例；`check-deployment.mjs` 把 `/api/grid-sync` 检查换成 `/api/pulse-sync`；`.env.example` 改为列出真正在用的 `PULSE_SYNC_TOKEN`、`COMMENTS_ADMIN_TOKEN`
- [x] 5.5 修改 `.github/workflows/cloud-keepalive.yml`：读取目标改为 `/api/pulse-sync`，令牌改为 `PULSE_SYNC_TOKEN`，并相应调整说明文字。结果：已改为读取 `/api/pulse-sync` 并使用 `PULSE_SYNC_TOKEN`
- [x] 5.6 更新文档：`docs/DEPLOYMENT.md`、`README.md`、`docs/cloudflare-pages.md` 中关于网格同步、`GRID_SYNC_TOKEN`、网格页面的段落；`docs/superpowers/plans/` 下的历史计划文档保持不变。结果：`DEPLOYMENT.md` 的 Supabase 一节改写为"创建自有 Supabase 免费项目"（去掉网格专属内容，保留对 Pulse、评论等仍有用的步骤）；`README.md`、`cloudflare-pages.md` 同步，并在 `cloudflare-pages.md` 新增"网格交易的旧路径"一节与验证命令；`docs/superpowers/plans/` 历史文档未改
- [x] 5.7 全局搜索残留：`features/grid-trading`、`grid-sync`、`gridSync`、`GRID_SYNC_TOKEN`、`/grid-trading`，每一处都要有明确结论（保留的有理由），然后运行类型检查与构建，任何悬空引用都必须报错。结果：除历史计划文档、已归档变更，以及 `cloudflare-pages.md` 里有意写的"`/api/grid-sync` 应为 404"之外，残留为 0；主规格里两处 `GRID_SYNC_TOKEN` 与 `grid-sync` 的需求由本变更的增量规格在归档时修改

## 6. 验证

- [x] 6.1 运行 `npm test -- --run`、`npm run test:scripts`、`npm run test:edge`、`npm run test:functions`、`npm run typecheck`，全部通过。结果：前端 632 项、`test:scripts` 39 项、`test:edge` 18 项加知识库端到端、`test:knowledge` 20 项、`test:functions`、`typecheck`（0 错误）全部通过
- [x] 6.2 分别运行 `npm run build`、`npm run build:cloudflare`、`npm run build:pages`，三者都成功；普通构建与 `build:pages` 的产物里没有 `/note/` 入口。结果：三种构建都成功（退出码 0）；普通构建与 `build:pages` 的产物里没有 `/note/` 入口；`build:cloudflare` 14 秒完成并通过链接检查
- [x] 6.3 用本地 wrangler 实测 `/grid-trading`、`/grid-trading/records`、`/grid-trading/records/abc123` 的 302 目标与带参数的 `?id=abc123`；若 `_redirects` 不支持查询参数占位符，改由 `GridMoved` 补上并把结论写回设计。结果：三条旧路径的 302 目标正确，`?id=` 占位符可用且保持编码；补了 `/grid-trading/` 与 `/grid-trading/records/` 两条尾斜杠规则；去掉 `_redirects` 后前端兜底也能到达正确页面
- [x] 6.4 实测 `/api/grid-sync` 返回 404 JSON，`/api/grid-market`、`/api/pulse-sync`、`/api/candidates-sync` 行为不变。结果：`/api/grid-sync` 返回 404 JSON；`/api/grid-market`（200 与 400）、`pulse-sync`（503、405）、`candidates-sync`（503）行为不变
- [x] 6.5 在浏览器里验证 `/` 与 `/invest`、AI 实验室里的"网格交易"入口能进入 `/note/lab/grid-trading/`（Cloudflare 构建），在普通构建的开发服务器里入口直接跳到 Cloudflare 站点上的计算器。结果：（已按用户反馈改为直接跳转）用真实浏览器渲染确认——Cloudflare 构建里 `/invest` 与 `/ai` 的网格卡片 `href` 为 `/note/lab/grid-trading/`；普通构建里为完整地址 `https://businessweb-c0u.pages.dev/note/lab/grid-trading/`；`/grid-trading` 旧路径仍显示"网格交易已迁移"
- [x] 6.6 记录替换前后的变化：主站 bundle 体积、`dist` 文件数、`build:cloudflare` 耗时。结果：相对提案提交，72 个文件变化，新增 329 行、删除 3435 行；普通构建 `dist` 为 4564 个文件、96MB（替换前 4602 个、105MB）

## 7. 上线

- [x] 7.1 **（需使用者确认）** 推送前说明：主站有约 53 个未推送的提交（含合并的上游提交）加本变更的提交，将触发 Cloudflare、Vercel、GitHub Pages 各构建一次；使用者确认后再推送 结果：已确认并推送，`main` 推送到 `65bd0d5`
- [x] 7.2 推送后验证线上：`/grid-trading*` 的跳转目标、`/note/lab/grid-trading/` 回测、`/note/lab/stock/` 页面、`/api/grid-sync` 为 404、`/api/grid-market`、`pulse-sync`、`candidates-sync` 不受影响 结果：线上 `/grid-trading*`、`/sector-rotation`、`/limit-up-analysis` 302 目标正确，`/note/lab/grid-trading/`、`saved/`、`detail/`、`/note/lab/stock/` 为 200，`/api/grid-sync` 为 404，其他接口正常；股市分析 lab 三个工具在线上取到数据
- [x] 7.3 **（需使用者操作）** 使用者在 `/note/lab/grid-trading/saved/` 填入同步密钥并同步，确认能从 D1 取回此前的记录，并确认新规则下的计算结果符合预期 结果：使用者已于 2026-10-10 确认同步成功且 v5 结果符合预期
- [x] 7.4 确认回退办法：去掉 `public/_redirects` 并回退相关提交即可恢复入口，302 不会被长期缓存（只在文档中确认，不实际回退线上）。结果：回退办法已写入 `docs/cloudflare-pages.md` 的"网格交易的旧路径"一节与设计文档的回滚段落：去掉 `public/_redirects` 并回退相关提交；302 不会被浏览器长期缓存；删除的代码保留在 Git 历史中
