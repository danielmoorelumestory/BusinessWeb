## Why

主站与 notes 站点合并后，前端已经随推送 `main` 一次发布，但 notes 的后端 Worker `grid-trading-sync` 仍要手动 `wrangler deploy`、手动应用 D1 表结构——忘了做，线上页面就会调用不存在的接口。同时仓库里还留着 Vercel、GitHub Pages 两条已停用构建线的分支逻辑，让"入口指向哪里"多出三个环境变量和两套说明页。本变更的目标是：**推一次 `main`，站点的所有部分都自动发布**，并且只保留 Cloudflare 一条构建线。

## What Changes

- 新增 GitHub Actions 工作流：`notes-site/workers/grid-trading-sync/**` 在 `main` 上有改动时，依次跑 Worker 测试、应用 `schema.sql`、部署 Worker；可手动触发。
- **BREAKING** 删除 GitHub Pages 构建线：`npm run build:pages`、`scripts/prepare-pages.mjs`、`.github/workflows/pages.yml`，以及只为它存在的行情直连开关 `VITE_MARKET_DIRECT`。
- **BREAKING** 网格交易、ETF 复盘、股市分析的入口固定为站内路径 `/note/...`，删除环境变量 `VITE_NOTES_PATH`、`VITE_NOTES_ORIGIN` 与"指向线上绝对地址"的分支；notes 页面回主站的链接默认用 `/`。
- `GridMoved`、`StockToolsMoved` 只保留前端兜底跳转，删除"已迁移"说明页。
- `notes-site/astro.config.mjs` 去掉 Vercel 与 GitHub Pages 分支，固定挂在 `/note`。
- 收尾：`package.json` 的包名、README 与 `.env.example` 里关于 Vercel / GitHub Pages / 上游仓库的过时说明，移除不再同步的 `upstream` 远端。

不在本变更内：把整站并成一个 Worker、合并两个 D1 数据库、统一两个同步密钥、把 notes 的页面重写为 React。

## Capabilities

### New Capabilities
- `worker-auto-deploy`: `grid-trading-sync` Worker 与其 D1 表结构随 `main` 的推送自动发布，包括触发条件、执行顺序、失败时的行为与所需凭据。

### Modified Capabilities
- `grid-trading-entry`: 入口不再区分"有没有 notes 的构建"，固定指向站内 `/note/lab/grid-trading/`；删除"没有 notes 的构建显示迁移说明"的需求，前端兜底跳转单独成为一条需求。
- `stock-tools-entry`: 同上，入口固定指向站内 `/note/lab/stock/`，旧路径只保留跳转。
- `site-visual-theme`: "三条构建线都能构建"改为只要求 `build` 与 `build:cloudflare`。

## Impact

- 工作流：新增 `.github/workflows/worker-deploy.yml`，删除 `pages.yml`。
- 凭据：仓库密钥 `CLOUDFLARE_API_TOKEN` 现在只有 D1 编辑权限（`note-analysis-sync.yml` 的注释如此说明），**需要使用者在 Cloudflare 后台给它加上 Workers 脚本的编辑权限**，否则部署步骤会失败。
- 构建：`package.json`（`build:pages`、`dev:notes`、包名）、`scripts/build-cloudflare.mjs`、`vite.config.js`、`scripts/prepare-pages.mjs` 及其测试。
- 前端：`src/data/notesLinks.ts`、`src/pages/GridMoved.tsx`、`StockToolsMoved.tsx` 及测试、`src/data/siteMap.test.ts`、`src/services/heatmapQuotes.ts`。
- notes 站点：`notes-site/astro.config.mjs`、`src/layouts/Base.astro`、`src/pages/lab/grid-trading/saved.astro`、`src/pages/lab/etf-review/index.astro`（`MAIN_SITE` 默认值）。
- 文档：`README.md`、`docs/notes-cohosting.md`、`docs/cloudflare-pages.md`、`docs/DEPLOYMENT.md`、`.env.example`。
- 使用方式变化：不带 notes 的 `npm run build` 产物里 `/note/...` 入口没有对应页面，只用于本地检查主站；发布一律用 `npm run build:cloudflare`。
