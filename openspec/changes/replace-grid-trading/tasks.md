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

- [ ] 3.1 运行 `npm run build:cloudflare`，确认通过，`dist/note/lab/grid-trading/`、`saved/`、`detail/`、`minute/` 与 `dist/note/lab/stock/` 都存在，链接检查通过；记录新的文件数、体积与构建耗时，与 1.2 对比
- [ ] 3.2 用 `npx wrangler pages dev dist --compatibility-date=2026-10-07 --compatibility-flag=nodejs_compat` 提供产物，在浏览器里打开 `/note/lab/grid-trading/`，获取默认示例行情并回测，确认能出数据；打开 `/note/lab/stock/` 确认页面能渲染（行情接口依赖 Worker，失败属预期，只记录）
- [ ] 3.3 更新 `docs/notes-cohosting.md`：来源提交号改为 `35f3747`，写明新增的 Vue 依赖、Worker 源码有更新（`/cls` 转发、`/stock/*` 接口、`cls_plate_day` 表、收盘 cron 写入）以及"Worker 与 D1 需要使用者自行部署"
- [ ] 3.4 **（需使用者操作）** 使用者确认或完成：把 `notes-site/workers/grid-trading-sync/schema.sql` 新增的 `cls_plate_day` 表应用到 D1，并重新部署 Worker；如果 notes 的 GitHub Pages 站点已经在使用新版 Worker，只需告知"已是最新"

## 4. 替换主站入口与路径

- [ ] 4.1 找出渲染 `siteMap` 与 `aiLab` 入口的组件，使以 `/note/` 开头的路径使用普通 `<a href>`；为这一行为补组件测试（普通链接，点击不被前端路由拦截）
- [ ] 4.2 修改 `src/data/siteMap.ts` 与 `src/data/aiLab.ts`：设置了 `VITE_NOTES_PATH` 时入口指向 `/note/lab/grid-trading/`，否则指向 `/grid-trading`（由 `GridMoved` 显示迁移说明）
- [ ] 4.3 新增 `GridMoved` 路由组件并为其写测试：`/grid-trading` → `/note/lab/grid-trading/`、`/grid-trading/records` → `.../saved/`、`/grid-trading/records/:id` → `.../detail/?id=:id`；设置了 `VITE_NOTES_PATH` 时用 `window.location.replace` 跳转，否则显示迁移说明与指向 `https://businessweb-c0u.pages.dev/note/lab/grid-trading/` 的链接
- [ ] 4.4 修改 `src/App.tsx`：去掉三个网格路由与对应的懒加载导入，加入匹配 `/grid-trading/*` 的 `GridMoved` 路由
- [ ] 4.5 修改 `src/utils/seo.ts`：`/grid-trading` 与 `/grid-trading/records` 的条目改为迁移页的 `noindex`（或移除），并检查站点地图生成脚本是否列出了 `/grid-trading`，同步修改
- [ ] 4.6 新增 `public/_redirects`：三条旧路径的 302 跳转（`/grid-trading/records/:id` 目标带 `?id=:id`）；注意 `public/` 的内容会进入所有构建线的产物，Vercel 与 GitHub Pages 会忽略该文件

## 5. 删除旧的网格实现与 Supabase 网格同步

- [ ] 5.1 用全局搜索列出所有对 `features/grid-trading`、`GridCalculator`、`GridRecords`、`GridRecordDetail`、`gridSync`、`grid-sync`、`GRID_SYNC_TOKEN` 的引用，记录每一处的处理方式；**确认 `api/grid-market`、`functions/api/grid-market.js`、`server/market.mjs` 与 `src/services/heatmapQuotes.ts` 不在删除范围内**
- [ ] 5.2 删除 `src/pages/GridCalculator*`、`GridRecords*`、`GridRecordDetail*`（含测试）与 `src/features/grid-trading/`（含 `parityFixture.json` 与测试）
- [ ] 5.3 删除 `src/services/gridSyncApi.test.ts` 及其对应的服务文件（先确认它只服务于网格同步，被 Pulse 等其他模块使用的部分要保留）
- [ ] 5.4 删除 `api/grid-sync.ts`、`functions/api/grid-sync.js`、`supabase/migrations/202610020001_grid_sync.sql`；从 `scripts/check-functions.mjs` 与 `scripts/check-deployment.mjs` 中移除 `grid-sync` 相关项；从 `.env.example` 移除 `GRID_SYNC_TOKEN`
- [ ] 5.5 修改 `.github/workflows/cloud-keepalive.yml`：读取目标改为 `/api/pulse-sync`，令牌改为 `PULSE_SYNC_TOKEN`，并相应调整说明文字
- [ ] 5.6 更新文档：`docs/DEPLOYMENT.md`、`README.md`、`docs/cloudflare-pages.md` 中关于网格同步、`GRID_SYNC_TOKEN`、网格页面的段落；`docs/superpowers/plans/` 下的历史计划文档保持不变
- [ ] 5.7 全局搜索残留：`features/grid-trading`、`grid-sync`、`gridSync`、`GRID_SYNC_TOKEN`、`/grid-trading`，每一处都要有明确结论（保留的有理由），然后运行类型检查与构建，任何悬空引用都必须报错

## 6. 验证

- [ ] 6.1 运行 `npm test -- --run`、`npm run test:scripts`、`npm run test:edge`、`npm run test:knowledge`、`npm run test:functions`、`npm run typecheck`，全部通过
- [ ] 6.2 分别运行 `npm run build`、`npm run build:cloudflare`、`npm run build:pages`，三者都成功；普通构建与 `build:pages` 的产物里没有 `/note/` 入口
- [ ] 6.3 用本地 wrangler 实测 `/grid-trading`、`/grid-trading/records`、`/grid-trading/records/abc123` 的 302 目标与带参数的 `?id=abc123`；若 `_redirects` 不支持查询参数占位符，改由 `GridMoved` 补上并把结论写回设计
- [ ] 6.4 实测 `/api/grid-sync` 返回 404 JSON，`/api/grid-market`、`/api/pulse-sync`、`/api/candidates-sync` 行为不变
- [ ] 6.5 在浏览器里验证 `/` 与 `/invest`、AI 实验室里的"网格交易"入口能进入 `/note/lab/grid-trading/`（Cloudflare 构建），在普通构建的开发服务器里入口进入迁移说明页
- [ ] 6.6 记录替换前后的变化：主站 bundle 体积、`dist` 文件数、`build:cloudflare` 耗时

## 7. 上线

- [ ] 7.1 **（需使用者确认）** 推送前说明：主站有约 53 个未推送的提交（含合并的上游提交）加本变更的提交，将触发 Cloudflare、Vercel、GitHub Pages 各构建一次；使用者确认后再推送
- [ ] 7.2 推送后验证线上：`/grid-trading*` 的跳转目标、`/note/lab/grid-trading/` 回测、`/note/lab/stock/` 页面、`/api/grid-sync` 为 404、`/api/grid-market`、`pulse-sync`、`candidates-sync` 不受影响
- [ ] 7.3 **（需使用者操作）** 使用者在 `/note/lab/grid-trading/saved/` 填入同步密钥并同步，确认能从 D1 取回此前的记录，并确认新规则下的计算结果符合预期
- [ ] 7.4 确认回退办法：去掉 `public/_redirects` 并回退相关提交即可恢复入口，302 不会被长期缓存（只在文档中确认，不实际回退线上）
