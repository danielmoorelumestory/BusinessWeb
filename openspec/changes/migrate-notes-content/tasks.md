## 1. 内容与数据迁入

- [x] 1.1 把 3 篇已发布笔记（去掉 front matter）迁入 `public/notes/`，新增 `src/data/notes.ts` 索引（slug、标题、日期、摘要、标签、可选 `report`），并写测试：slug 唯一、日期有效、每个索引项有对应 Markdown 文件、`report` 指向的文件存在
- [x] 1.2 把 2 份 HTML 报告迁入 `public/research/`（`etf-grid-master-plan-2026-09-23.html`、`core-themes-2027-2026-09-27.html`），把它们加入 `brand.test.ts` 的静态报告字体断言；若不满足（网络字体、衬线字体）则最小化修改字体栈使其通过，不改内容
- [x] 1.3 把行业 ETF 数据迁入 `src/data/industryEtf.json` 与 `src/data/industryEtf.ts`（类型与汇总），并写测试：7 组、59 只、各组 `count` 与条目数一致、代码非空

## 2. 主站页面

- [x] 2.1 评估并抽取 `FirstBook.tsx` 的 `renderMarkdown` 为共享组件（决策 2）；`FirstBook` 的渲染保持不变（现有测试通过），结论：函数自包含（只依赖 React），已原样抽成 `src/components/MarkdownView.tsx` 的 `renderMarkdown`，`FirstBook` 改为导入，现有测试通过；另给行内渲染增加 `<br>` 支持（猪周期笔记的表格单元格用到）。结论写回 design.md
- [x] 2.2 新增 `src/pages/Notes.tsx`：按日期倒序的列表、标签筛选与清除，沿用主站的页头与报告样式；写测试
- [x] 2.3 新增 `src/pages/NoteDetail.tsx`：读取并渲染 Markdown，显示标题、日期、标签，有 `report` 时显示"打开完整报告"，slug 不存在或文件缺失时显示"这一页不存在"；写测试（含不存在的 slug、加载失败）
- [x] 2.4 新增 `src/pages/IndustryEtf.tsx`：7 组 59 只 ETF 的展示（桌面表格、窄屏卡片）、总数与各组数量、参考链接新标签页加 `rel="noopener noreferrer"`、研究参考提示；写测试
- [x] 2.5 修改 `src/App.tsx` 加入 `/notes`、`/notes/:slug`、`/industry-etf` 路由（懒加载），同步 `App.test.tsx`；`src/utils/seo.ts` 增加三类页面的标题与描述

## 3. 入口与导航

- [x] 3.1 修改 `src/components/Header.tsx`：桌面与移动导航的"笔记"改为站内 `Link` 指向 `/notes`，所有构建显示；更新 `Header.test.tsx` 中依赖 `VITE_NOTES_PATH` 的断言
- [x] 3.2 修改 `src/data/siteMap.ts`：投资页"选标的"组新增"行业研究笔记"（`/notes`）与"行业 ETF 清单"（`/industry-etf`），同步 `siteMap.test.ts`、`Sections.test.tsx` 中的计数与路径
- [x] 3.3 修改 `vite.config.js`：开发代理键 `'/note'` 改为 `'^/note/'`，确保 `/notes` 不被代理；用测试或脚本断言配置里没有会匹配 `/notes` 的代理键
- [x] 3.4 修改 `scripts/generate-sitemap.mjs` 与 `scripts/prerender-routes.mjs`（以及 `prepare-pages.mjs` 的路由表，如需要）加入 `/notes`、每篇笔记、`/industry-etf`，重新生成 `public/sitemap.xml`

## 4. 精简 notes 站点与旧地址

- [x] 4.1（`@astrojs/rss` 本来就不在 `notes-site/package.json` 里，无需移除）删除 notes-site 内的首页、`pages/notes/`、`rss.xml.ts`、`lab/text-count.astro`、`src/content/`、`content.config.ts`、`IndustryETFSection.astro`、`lib/notes.ts`、`lib/industry-etf.ts`、`data/industry-etf.json`、`public/reports/`；更新 `lib/labs.ts`；`@astrojs/rss` 不再使用则从 `notes-site/package.json` 移除并更新锁文件
- [x] 4.2 修改 `notes-site/src/layouts/Base.astro`：品牌与导航改为"返回主站 / 网格交易 / 股市分析"，指向主站的链接用整页 `<a>`，去掉 RSS 链接与页脚的 GitHub、RSS；确认剩余页面里没有指向已删除页面的链接
- [x] 4.3 修改 `public/_redirects`：`/note/`、`/note/notes`、`/note/rss.xml`、`/note/lab/text-count`（含尾斜杠）到 `/notes`；`/note/notes/:id` 到 `/notes/:id`，两个写作指南 id 到 `/notes`；两份报告的旧中文文件名（含 URL 编码）到新地址；更具体的规则写在通配规则之前
- [x] 4.4 更新 `scripts/check-note-links.mjs` 与其测试（如有）使之适配精简后的页面集合；`npm run build:cloudflare` 的链接检查通过
- [x] 4.5 更新文档：`docs/notes-cohosting.md`（精简后的结构、旧地址对照表、RSS 不再提供）、`README.md`

## 5. 验证

- [x] 5.1 `npm test -- --run`、`npm run test:scripts`、`npm run test:edge`、`npm run test:functions`、`npm run typecheck` 全部通过
- [x] 5.2 `npm run build`、`npm run build:pages`、`npm run build:cloudflare` 三种构建都成功
- [x] 5.3 用 `wrangler pages dev` 本地实测旧地址（结果：全部 302 目标正确，两份报告的中文旧地址（URL 编码）也命中；`/note/lab/`、`grid-trading/`、`stock/` 为 200；构建后主站路由 `/notes`、`/notes/<slug>`、`/industry-etf` 会 308 加斜杠，与其他页面一致）：`/note/`、`/note/notes`、`/note/notes/<3 篇的 id>`、两个写作指南 id、`/note/rss.xml`、`/note/lab/text-count`、两份报告的旧中文地址的 302 目标；`/note/lab/grid-trading/`、`/note/lab/stock/`、`/note/lab/` 仍为 200
- [x] 5.4 在真实浏览器里逐页核对（结果：`/notes` 三篇倒序、标签筛选；三篇详情的表格行数与原 Markdown 一致（机器人 6 表 33 行、猪周期 3 表 25 行含 3 个 `<br>`）；ETF 清单页 7 表 59 行、两个站内参考链接正确；375px 宽度三个新页都无横向滚动；两份报告正常显示，ETF 报告的 ECharts 加载成功；notes lab 页头改为指回主站；`/invest` → 行业研究笔记 → 详情 → 全部笔记 的站内导航正常）：`/notes` 列表与标签筛选、3 篇笔记详情与 notes 原页面对照（表格、引用、emoji、代码块不丢）、"打开完整报告"、`/industry-etf`、Header 与投资页入口、窄屏布局；两份报告的图表正常显示

## 6. 上线（需要使用者确认）

- [ ] 6.1 **（需使用者确认）** 推送代码
- [ ] 6.2 部署后验证线上：新页面、旧地址 302、`/note/lab/*` 不受影响、站点地图含新页面、其他接口与页面正常
