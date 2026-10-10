## Why

notes 的"股市分析 lab"（`/note/lab/stock/`）已经提供大涨股解读、板块轮动、板块排行，`/invest` 的"看行情"入口也已经指向它。主站自己的板块轮动（`SectorRotation.tsx`，2499 行）和涨停分析（`LimitUpAnalysis.tsx`，388 行）因此成了没有入口的重复实现，连同它们专用的后端（`/api/cls-plate`、Supabase 板块历史缓存）一起占着维护成本；而用户没有 Supabase，这套缓存在线上从未启用。以 notes 为准，只保留一套实现。

## What Changes

- 删除主站的板块轮动与涨停分析页面、它们的服务层（`limitUp`、`limitUpCache`、`sectorCache`、`useSectorRefresh`、`clsProxy`）、测试，以及不再被引用的类型。
- 删除专用后端：`/api/cls-plate`（`api/cls-plate.js`、`api/cls-plate.d.ts`、`functions/api/cls-plate.js`）、`server/sectorHistory.js`、Supabase 迁移 `202610020004_sector_history.sql` 与文档 `docs/sector-history-cache.md`。
- 旧路径 `/sector-rotation`、`/limit-up-analysis` 保留为跳转：Cloudflare 上继续由 `_redirects` 302 到 lab 对应工具；其他构建与本地开发由一个很小的前端兜底组件处理，行为与已有的网格 `GridMoved` 一致，避免旧书签变成"这一页不存在"。
- 清理引用：`App.tsx` 路由、`seo.ts`、站点地图脚本与 `sitemap.xml`、`check-functions.mjs`、开发代理中的 `/api/cls-plate`、`colorSemantics` 测试里对旧页面的断言、`App.test.tsx`，以及相关文档。
- **BREAKING**：`/api/cls-plate` 不再存在，请求返回 404。没有任何保留的前端代码调用它（热力图用的是 `/api/grid-market`）。
- 不影响：notes 的股市分析 lab 及其 Worker/D1、`/api/grid-market`、热力图、全球行情页、其他页面。Supabase 此后只剩章节评论使用。

## Capabilities

### New Capabilities
- `stock-tools-entry`: 主站对板块轮动、涨停分析的入口与旧路径处理——入口指向 notes 的股市分析 lab、旧路径跳转到对应工具、没有 notes 的构建显示迁移说明、主站不再包含旧实现与专用后端。

### Modified Capabilities
<!-- 无：现有主规格里没有涉及板块轮动、涨停分析或 cls-plate 的需求 -->

## Impact

- 代码删除约 3200 行（页面 2887 行、服务与测试若干、后端约 120 行），新增一个约 40 行的兜底组件及其测试。
- 受影响文件：`src/App.tsx`、`src/App.test.tsx`、`src/utils/seo.ts`、`src/styles/colorSemantics.test.ts`、`src/types/index.ts`、`scripts/check-functions.mjs`、`scripts/generate-sitemap.mjs`、`public/sitemap.xml`、`vite.config.js`、`docs/DEPLOYMENT.md`、`docs/cloudflare-pages.md`、`README.md`。
- 线上：部署后 `/sector-rotation`、`/limit-up-analysis` 仍 302 到 lab；`/api/cls-plate` 变为 404。无需任何平台配置变更。
- Supabase 里可能存在的表 `businessweb_sector_history` 不由本变更删除（用户没有 Supabase，线上从未配置）。
