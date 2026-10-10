## Context

`/invest` 的"看行情"入口已经指向 notes 的股市分析 lab（上一个变更完成，并加了 `#stock-analysis`/`#sector-rotation`/`#plate-ranking` 深链接）。主站旧页面因此没有任何入口，只剩直接访问旧地址才能到达。

旧实现的依赖关系（已用引用搜索确认）：
- `SectorRotation.tsx` 使用 `sectorCache`、`useSectorRefresh`、`limitUp`；`LimitUpAnalysis.tsx` 使用 `limitUp`、`limitUpCache`；`limitUp.ts` 和 `sectorCache.ts` 通过 `clsProxy.ts` 请求同源 `/api/cls-plate`。
- `/api/cls-plate` 由 `api/cls-plate.js` 实现，读写 Supabase 表 `businessweb_sector_history`（`server/sectorHistory.js`、迁移 `202610020004`）。线上从未配置 Supabase，这套缓存从未生效。
- 这些模块与热力图（`heatmapQuotes.ts`，走 `/api/grid-market`）、全球行情页、其他页面没有共享代码；`shanghaiDate` 等日期工具只被旧页面使用。
- 已有的 `GridMoved` 提供了"旧路径兜底"的模式：有 notes 的构建前端跳转，没有的显示迁移说明。

## Goals / Non-Goals

**Goals:**
- 删除全部旧板块工具代码与专用后端，只保留 notes 的一套。
- 旧路径不变成 404：Cloudflare 服务端 302，其他构建前端兜底。
- 保持其余页面、热力图、接口、构建全部不受影响；仍有代码引用被删除模块时构建失败。

**Non-Goals:**
- 修改 notes 的股市分析 lab 本身（功能、样式、Worker）。
- 删除 Supabase 里可能存在的 `businessweb_sector_history` 表（用户没有 Supabase）。
- 删除评论所需的 Supabase 支持。
- 把 lab 重写成 React。

## Decisions

**1. 先删代码，再用类型检查和构建兜底，而不是先列清单再逐个改。**
先列出旧模块与唯一的使用方（见 Context），一次性删除后运行 `tsc`、测试与三种构建；任何遗漏的引用都会让其中之一失败。备选：逐文件迁移——没有可迁移的内容，只有删除。

**2. 旧路径兜底：新增 `StockToolsMoved`，沿用 `GridMoved` 的模式，不泛化 `GridMoved`。**
两个组件各自只有几十行，目标映射也不同（路径到锚点 vs 路径到子页面），强行合并要改已验证的网格组件及其测试。`StockToolsMoved` 把 `/sector-rotation` 映射到 `lab/stock/#sector-rotation`、`/limit-up-analysis`（含子路径）映射到 `lab/stock/#stock-analysis`；有 `VITE_NOTES_PATH`（含本地开发的默认值）时 `window.location.replace`，否则显示说明与指向 `NOTES_ORIGIN` 的链接。备选：直接删掉路由——开发服务器和 GitHub Pages 上旧书签会显示"这一页不存在"，不友好。

**3. `_redirects` 保持不变。**
`/sector-rotation`、`/limit-up-analysis`（含尾斜杠）的 302 已在上一个变更里加好并验证。

**4. 目标路径常量复用 `notesLinks.ts`。**
`SECTOR_ROTATION_PATH`、`STOCK_ANALYSIS_PATH` 已存在；兜底组件需要"相对 `/note/` 的路径"，在组件里用 `STOCK_LAB_BASE` 之外的小函数拼出，不新增环境变量。

**5. 站点地图与 SEO。**
从 `generate-sitemap.mjs` 的路由列表中移除两个旧路径并重新生成 `sitemap.xml`；`seo.ts` 里这两项改为 `{ title: '已迁移', noindex: true }`（与网格兜底页一致），避免旧页面继续被索引。

**6. 旧后端：整体删除而不保留接口。**
`/api/cls-plate` 没有任何保留的调用方，保留只会继续占用 Supabase 配置与维护。`check-functions.mjs` 中对应的用例一并删除；开发代理里的 `/api/cls-plate` 条目删除。

**7. 对"新旧功能是否等价"不做数据迁移，也不做功能对照测试。**
旧页面的用户数据只有浏览器本地的视图偏好与缓存（`localStorage`/`sessionStorage`），没有云端数据；用户已确认以 notes 为准。

## Risks / Trade-offs

- [旧页面里还有 lab 没有的功能] → 以 notes 为准是用户的既定决定；本变更不补功能。若用户发现缺失，另开变更在 notes 里补。
- [删除后遗漏引用，构建在某条构建线上失败] → 类型检查、全部测试、`build`、`build:pages`、`build:cloudflare` 三种构建全部运行；检查 `dist` 中不再出现 `cls-plate`。
- [旧链接（书签、外站）指向 `/sector-rotation`] → Cloudflare 302、前端兜底两层覆盖，部署后在线上逐一验证。
- [GitHub Pages 构建里没有 `/note/`，旧路径只显示说明页] → 与网格一致，链接指向 Cloudflare 上的 lab；可接受。
- [删除约 3200 行] → 全部在 git 历史中，需要时可以恢复。

## Migration Plan

1. 删除代码与后端，新增兜底组件与测试，清理引用。
2. 本地：测试、类型检查、三种构建、浏览器验证旧路径与入口。
3. 推送（向用户确认）。部署后验证：两个旧路径 302 目标、`/api/cls-plate` 为 404、热力图与其他接口正常、`/invest` 入口。
回退：`git revert` 本次提交即可恢复旧页面与接口。

## Open Questions

- 无。
