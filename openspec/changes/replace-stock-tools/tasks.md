## 1. 兜底组件

- [x] 1.1 新增 `src/pages/StockToolsMoved.tsx`：`/sector-rotation` 到 `lab/stock/#sector-rotation`，`/limit-up-analysis`（含尾斜杠与子路径）到 `lab/stock/#stock-analysis`；有 `NOTES_PATH` 时 `window.location.replace`，否则显示"已迁移"说明与指向 `NOTES_ORIGIN` 的链接
- [x] 1.2 为 `StockToolsMoved` 写测试：两个路径的目标映射、尾斜杠、有无 `VITE_NOTES_PATH` 两种构建的行为，参照 `GridMoved.test.tsx`

## 2. 删除旧页面与服务

- [x] 2.1 用全局搜索列出对 `SectorRotation`、`LimitUpAnalysis`、`limitUp`、`limitUpCache`、`sectorCache`、`useSectorRefresh`、`clsProxy`、`cls-plate`、`sectorHistory`、`LimitUpConcept` 的全部引用，记录每一处的处理方式；确认热力图（`heatmapQuotes.ts` 与 `/api/grid-market`）、`comments`、`pulse-sync`、`candidates-sync` 不在删除范围。结果：旧页面只被 `App.tsx` 引用；`limitUp`/`sectorCache`/`useSectorRefresh`/`clsProxy` 只被旧页面与彼此引用；`LimitUpStock` 与 `LimitUpConcept` 删页面后无人使用，一并删除；`colorSemantics` 里唯一断言旧页面的用例随页面删除（其余涨跌色断言保留）
- [x] 2.2 删除 `src/pages/SectorRotation.tsx`、`SectorRotation.cache.test.tsx`、`LimitUpAnalysis.tsx`、`LimitUpAnalysis.test.tsx`
- [x] 2.3 删除 `src/services/` 下的 `limitUp.ts`(+test)、`limitUpCache.ts`、`sectorCache.ts`(+test)、`useSectorRefresh.ts`(+test)、`clsProxy.ts`、`clsPlate.test.ts`；`src/types/index.ts` 中不再被引用的 `LimitUpConcept` 一并删除
- [x] 2.4 修改 `src/App.tsx`：去掉两个懒加载导入与路由，加入 `StockToolsMoved` 的 `/sector-rotation` 与 `/limit-up-analysis/*` 路由；同步 `src/App.test.tsx` 的懒加载列表
- [x] 2.5 修改 `src/utils/seo.ts` 两个旧路径为 `{ title: '已迁移', noindex: true }`；修改 `src/styles/colorSemantics.test.ts` 中对 `pages/SectorRotation.tsx` 的断言（改为仍存在的涨跌色用法或删除该断言并说明）

## 3. 删除专用后端与配置

- [x] 3.1 删除 `api/cls-plate.js`、`api/cls-plate.d.ts`、`functions/api/cls-plate.js`、`server/sectorHistory.js`、`supabase/migrations/202610020004_sector_history.sql`、`docs/sector-history-cache.md`
- [x] 3.2 修改 `scripts/check-functions.mjs`：去掉 `cls-plate` 与 `sectorHistory` 的复制、导入与用例
- [x] 3.3 修改 `vite.config.js`：删除 `/api/cls-plate` 开发代理
- [x] 3.4 修改 `scripts/generate-sitemap.mjs` 去掉两个旧路径并重新生成 `public/sitemap.xml`；确认 `scripts/prerender-routes.mjs` 与 `prepare-pages.mjs` 没有引用它们
- [x] 3.5 更新文档：`docs/DEPLOYMENT.md`（Supabase 迁移列表去掉板块历史缓存）、`docs/cloudflare-pages.md`（接口清单与验证命令里去掉 `cls-plate`，增加旧路径跳转说明）、`README.md`

## 4. 验证

- [x] 4.1 `npm test -- --run`、`npm run test:scripts`、`npm run test:edge`、`npm run test:functions`、`npm run typecheck` 全部通过
- [x] 4.2 `npm run build`、`npm run build:pages`、`npm run build:cloudflare` 三种构建都成功；确认 `dist` 中不再有 `cls-plate`，仍有任何代码引用已删除模块则构建失败
- [x] 4.3 用 `wrangler pages dev` 本地实测（结果：`/sector-rotation`、`/limit-up-analysis` 含尾斜杠均 302 到正确锚点，`/api/cls-plate` 为 404 的 JSON `{"error":"接口不存在"}`，`/api/grid-market` 200，网格 302 不受影响；`dist` 里只有自动生成的 `changelog.json` 因提交说明含 cls-plate 字样）：`/sector-rotation`、`/limit-up-analysis` 的 302 目标正确，`/api/cls-plate` 为 404 的 JSON，`/api/grid-market` 仍正常
- [x] 4.4 在真实浏览器里验证（结果：开发服务器上 `/sector-rotation`、`/limit-up-analysis` 分别跳到 lab 的板块轮动与大涨股解读并显示数据，`/invest` 入口链接正确且无控制台错误；`/pulse` 的 `ERR_NAME_NOT_RESOLVED` 请求失败在线上旧版本同样出现，属本机无法解析部分外部行情域名，与本变更无关）：`/invest` 三个行情入口直达各工具；普通构建的开发服务器里访问 `/sector-rotation` 跳到 lab 对应工具；热力图仍有数据

## 5. 上线（需要使用者确认）

- [ ] 5.1 **（需使用者确认）** 推送代码
- [ ] 5.2 部署后验证线上：两个旧路径 302 目标、`/api/cls-plate` 为 404、`/api/grid-market` 与热力图正常、`/invest` 入口与 lab 三个工具可用
