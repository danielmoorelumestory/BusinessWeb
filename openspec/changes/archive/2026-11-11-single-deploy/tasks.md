## 1. 前置条件（需要使用者操作）

- [x] 1.1 使用者在 Cloudflare 后台确认仓库密钥 `CLOUDFLARE_API_TOKEN` 对应的令牌权限，补上「Workers 脚本：编辑」（保留「D1：编辑」）；密钥名与值的存放位置不变
- [x] 1.2 从 `main` 开分支 `chore/single-deploy`，运行 `npm ci`、`npm test -- --run`、`npm run typecheck`、`npm run build:cloudflare`，记录基线结果

## 2. Worker 自动部署

- [x] 2.1 通读 `notes-site/workers/grid-trading-sync/schema.sql`，确认只包含可重复执行的语句（`CREATE TABLE IF NOT EXISTS`、`CREATE INDEX IF NOT EXISTS`）；发现其他语句先停下来与使用者确认
- [x] 2.2 根目录 `package.json` 的 `devDependencies` 加入固定版本的 `wrangler`，更新 lock 文件
- [x] 2.3 新增 `.github/workflows/worker-deploy.yml`：`push` 到 `main` 且路径为 `notes-site/workers/grid-trading-sync/**` 时触发，另加 `workflow_dispatch`；`permissions: contents: read`；`concurrency` 同组且不取消进行中的任务
- [x] 2.4 工作流步骤：检出 → Node 24 → 根目录与 `notes-site/` 分别 `npm ci` → 只跑 Worker 目录的测试 → 检查密钥是否存在（缺失则失败并说明）→ `wrangler d1 execute grid-trading-sync --remote --file=schema.sql` → `wrangler deploy`（工作目录为 Worker 目录）
- [x] 2.5 合并工作流到 `main` 后手动触发一次，确认三步都成功；失败则根据日志修正（权限不足回到 1.1）
- [x] 2.6 部署后在线上核对：`/note/lab/grid-trading/` 能回测、`/note/lab/grid-trading/saved` 能用同步密钥同步、`/note/lab/etf-review/` 与 `/note/lab/stock/` 正常加载数据

## 3. 入口地址固定为站内路径

- [x] 3.1 `src/data/notesLinks.ts`：`GRID_TRADING_PATH`、`GRID_SAVED_PATH`、`ETF_REVIEW_PATH`、`STOCK_LAB_BASE` 改为以 `/note/` 开头的常量；删除 `NOTES_PATH`、`NOTES_ORIGIN` 与对 `import.meta.env` 的读取；保留 `isNotesPath`、`isAbsoluteUrl`
- [x] 3.2 `src/pages/GridMoved.tsx`、`StockToolsMoved.tsx`：删除说明页分支，只保留 `window.location.replace` 与"正在跳转"提示；更新两者的测试
- [x] 3.3 更新 `src/data/siteMap.test.ts` 等用 `stubEnv('VITE_NOTES_PATH', …)` 的测试
- [x] 3.4 `scripts/build-cloudflare.mjs`：不再传 `VITE_NOTES_PATH`；`vite.config.js`：删除开发模式下对 `VITE_NOTES_PATH` 的默认赋值，保留 `^/note/` 代理
- [x] 3.5 notes 一侧：`Base.astro`、`lab/grid-trading/saved.astro`、`lab/etf-review/index.astro` 里 `MAIN_SITE` 的默认值改为 `/`；`package.json` 的 `dev:notes` 与 `build-cloudflare.mjs` 不再需要显式传 `MAIN_SITE=/`
- [x] 3.6 `notes-site/astro.config.mjs`：删除 Vercel 与 GitHub Pages 分支，`base` 固定 `/note`，`site` 取 `SITE_URL`，其次 `CF_PAGES_URL`
- [x] 3.7 运行测试、类型检查与 `npm run build:cloudflare`；在产物里搜索 `businessweb-c0u.pages.dev`，确认入口链接中不再出现

## 4. 删除 GitHub Pages 构建线

- [x] 4.1 删除 `.github/workflows/pages.yml`、`scripts/prepare-pages.mjs`、`scripts/prepare-pages.test.mjs`，以及 `package.json` 的 `build:pages`
- [x] 4.2 `src/services/heatmapQuotes.ts`：删除 `VITE_MARKET_DIRECT` 分支，只保留走 `/api/grid-market` 的路径；更新相关测试
- [x] 4.3 `.env.example`：删除 `VITE_MARKET_DIRECT`、`VITE_NOTES_ORIGIN` 的说明与关于 Vercel 的注释
- [x] 4.4 在仓库（排除 `openspec/changes/archive/`、`docs/superpowers/`）搜索 `build:pages`、`prepare-pages`、`VITE_MARKET_DIRECT`、`VITE_NOTES_PATH`、`VITE_NOTES_ORIGIN`、`NOTES_ORIGIN`，确认没有残留

## 5. 文档与收尾

- [x] 5.1 `docs/notes-cohosting.md`：把「网格后端仍手动部署」改写为自动发布的说明，写明"改列需手动""接口向后兼容一个版本"两条限制与 `wrangler rollback` 回退方法；删除关于 Vercel、GitHub Pages 构建不受影响的段落
- [x] 5.2 `docs/cloudflare-pages.md`、`docs/DEPLOYMENT.md`、`README.md`：部署一节只保留 Cloudflare，写明发布只用 `npm run build:cloudflare`；删除 README 里指向他人机器路径的 MCP 配置说明
- [x] 5.3 `package.json` 的 `name` 改为 `businessweb`，同步 lock 文件
- [x] 5.4 使用者确认后执行 `git remote remove upstream`（仅本地配置，不影响远端仓库）

## 6. 验收

- [x] 6.1 运行 `npm test -- --run`、`npm run test:functions`、`npm run typecheck`、`npm run build`、`npm run build:cloudflare`，全部通过
- [x] 6.2 做一次端到端验证：在 Worker 里做一个无害改动（如注释）推到 `main`，确认工作流自动运行并成功，Cloudflare Pages 同时构建成功
- [x] 6.3 第一次自动部署后观察一个交易日，确认定时任务照常写入分钟线与板块日数据
