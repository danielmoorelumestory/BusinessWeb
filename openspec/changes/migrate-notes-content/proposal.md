## Why

notes 站点的内容（3 篇行业研究笔记、2 份独立 HTML 报告、59 只行业 ETF 清单）现在只能通过 `/note/` 下的另一套 Astro 外壳访问，外观、导航与主站割裂，且和主站已有的"研究笔记"命名混淆。迁移路线的第三步是把这些内容并入主站，统一导航与外观；迁完后 notes 只保留真正需要它的网格交易与股市分析两个 lab。

## What Changes

- **新增笔记模块**：主站新增 `/notes`（列表，可按标签筛选）与 `/notes/:slug`（详情），3 篇笔记的 Markdown 放进 `public/notes/`，用主站已有的 Markdown 渲染与报告样式显示；带 `report` 字段的笔记在顶部显示"打开完整报告"。
- **迁移 2 份独立 HTML 报告**到 `public/research/`（文件名改成 ASCII），并纳入主站对静态报告的品牌约束（系统无衬线字体、无网络字体）。
- **新增行业 ETF 清单页** `/industry-etf`：7 个行业组、59 只 ETF，数据从 notes 的 JSON 迁入，用 React 重写展示。
- **入口与导航**：Header 的"笔记"改为指向主站 `/notes`（不再依赖 `VITE_NOTES_PATH`，所有构建都显示）；投资页"选标的"组新增"行业研究笔记"与"行业 ETF 清单"两个入口。
- **精简 notes 外壳**：删除 notes 的首页、笔记列表与详情、RSS、行业 ETF 组件、写作指南与文字计数 lab；只保留 `lab/grid-trading`、`lab/stock` 与 `lab` 索引；notes 页面的导航改为指向主站。
- **旧地址不失效**：Cloudflare 的 `_redirects` 把 `/note/`、`/note/notes`、`/note/notes/<id>`、`/note/reports/<旧文件名>`、`/note/rss.xml`、`/note/lab/text-count` 等跳转到主站对应页面（302）。
- **站点地图、SEO、预渲染**增加 `/notes`、`/notes/<slug>`、`/industry-etf`。
- **BREAKING**：notes 的 RSS 订阅地址 `/note/rss.xml` 不再提供（跳转到 `/notes`）；旧 GitHub Pages 的 notes 站点不受影响。
- 不在范围：用 React 重写 2 份 HTML 报告（原样迁移）；新增 RSS；notes 的写作流程；网格交易与股市分析 lab 本身。

## Capabilities

### New Capabilities
- `industry-notes`: 主站的行业研究笔记（列表、详情、标签筛选、完整报告入口）、独立 HTML 报告、行业 ETF 清单，以及来自 notes 旧地址的跳转。

### Modified Capabilities
- `notes-site-cohosting`: `/note/` 下不再提供 notes 首页、笔记、RSS，只提供网格交易与股市分析 lab；主站导航的"笔记"入口改为指向主站自己的 `/notes`。

## Impact

- 新增：`public/notes/*.md`、`public/research/` 下 2 份报告、`src/data/notes.ts`、`src/data/industryEtf.json`、`src/pages/Notes.tsx`、`NoteDetail.tsx`、`IndustryEtf.tsx` 及测试。
- 修改：`src/App.tsx`、`src/components/Header.tsx`（及测试）、`src/data/siteMap.ts`、`src/utils/seo.ts`、`scripts/generate-sitemap.mjs`、`scripts/prerender-routes.mjs`、`public/_redirects`、`vite.config.js`（开发代理）、`src/styles/brand.test.ts`、`scripts/check-note-links.mjs`、`docs/notes-cohosting.md`、`README.md`。
- 删除（notes-site 内）：`src/pages/index.astro`、`src/pages/notes/`、`rss.xml.ts`、`lab/text-count.astro`、`src/content/`、`src/components/IndustryETFSection.astro`、`src/lib/notes.ts`、`industry-etf.ts`、`src/data/industry-etf.json`、`public/reports/`。
- 线上：推送部署即生效，无需任何平台配置变更；Worker、D1 不受影响。
