## Context

notes-site 现在是一个完整的 Astro 站点：笔记集合（`src/content/notes/`，3 篇已发布 + 2 篇写作指南 + 1 个模板）、2 份独立 HTML 报告（`public/reports/`，一份 112 KB 带图表、一份 23 KB，都从 jsDelivr 加载 ECharts）、行业 ETF 清单（`src/data/industry-etf.json`，7 组 59 只，由 344 行的 `IndustryETFSection.astro` 展示）、RSS、首页，以及 3 个 lab（网格交易、股市分析、文字计数）。前两步已把网格与股市分析并入主站的入口体系，本变更处理剩下的"内容"。

主站已有可复用的基础设施：
- Markdown 渲染：`FirstBook.tsx` 的 `renderMarkdown`（章节从 `public/first-book/*.md` 运行时 `fetch`），列表由手写的 `PARTS` 数组维护——与"笔记"几乎同构。
- 静态报告：`public/research/*.html`，由 `brand.test.ts` 约束不加载网络字体、不用衬线字体。
- 页面骨架：`report.css` 报告组件、`SectionChrome`、`SmartLink`、`usePageSeo`。
- 旧路径兜底：`_redirects`（Cloudflare）加前端兜底组件的模式。

一个已发现的陷阱：开发服务器的代理键 `'/note'` 是前缀匹配，会把新增的 `/notes` 也代理走。

## Goals / Non-Goals

**Goals:**
- 3 篇笔记、2 份报告、行业 ETF 清单在主站内以主站的外观与导航提供，旧地址不失效。
- notes 站点精简到只剩网格交易与股市分析两个 lab。
- 不改变任何已有主站页面的行为；构建、测试、类型检查保持全绿。

**Non-Goals:**
- 重写 2 份 HTML 报告（原样迁移，仅检查字体约束）。
- 新增 RSS、全文搜索、评论。
- 保留 notes 的写作流程（新笔记以后直接在主站 `public/notes/` 加文件并登记）。
- 修改网格交易与股市分析 lab。

## Decisions

**1. 笔记内容放 `public/notes/*.md`，索引放 `src/data/notes.ts`，运行时 `fetch` 渲染。**
与 `FirstBook` 的做法一致，不引入 Markdown 构建管线；索引手写（slug、标题、日期、摘要、标签、可选 `report`），测试断言每个索引项都有对应文件、slug 唯一、日期有效。Markdown 文件去掉 front matter（元数据在索引里），避免运行时再解析 YAML。备选：构建时用 Vite 的 `import.meta.glob ?raw` 打进包里——3 篇共约 33 KB，也可行，但会让首页相关 chunk 变大且和现有章节读取方式不一致，否决。

**2. 把 `renderMarkdown` 从 `FirstBook.tsx` 抽成共享模块，而不是复制。**
`FirstBook.tsx` 里的函数（约 200 行，用到页面内的样式对象）抽到 `src/components/MarkdownView.tsx`，`FirstBook` 与笔记详情共用；抽取前先确认它的依赖（样式对象、`Link`）并保持 `FirstBook` 的输出不变（现有测试覆盖）。若抽取牵连过大，退一步在笔记详情里用 `marked`（已是依赖）加受控的样式类，不动 `FirstBook`。该取舍在实施时按实际依赖决定，并把结论写回本文件。

**3. 报告原样迁入 `public/research/`，文件名改成 ASCII，并让 `brand.test.ts` 覆盖它们。**
`ETF网格交易总方案-20260923.html` → `etf-grid-master-plan-2026-09-23.html`；`2027核心主线前瞻_六张网与候选主题_20260927.html` → `core-themes-2027-2026-09-27.html`。迁入后用现有的品牌断言检查字体；若报告里有衬线或网络字体则最小化修改 CSS 字体栈使之通过（不改内容）。ECharts 仍从 jsDelivr 加载，与 notes 现状一致；这是外部脚本依赖，在文档里注明，不在本变更里改成自托管。

**4. 行业 ETF 清单用 React 重写，数据 JSON 原样迁入 `src/data/industryEtf.json`。**
344 行 Astro 组件里大部分是样式与交互；主站版本做成按行业分组的表格（桌面）与卡片（窄屏），沿用 `report.css` 组件与 `--ok/--warn/--bad` 之外的中性配色，不使用涨跌红绿。测试断言总数 59、分组数 7、各组 `count` 与 `items.length` 一致。

**5. 路由与命名：`/notes`、`/notes/:slug`、`/industry-etf`。**
`/notes` 与已有的 `/research-notes`（公司库）并存，二者在导航里用不同名字区分："行业研究笔记"与"公司研究"。slug 沿用 notes 的文件名（`etf-grid-trading-master-plan`、`robotics-industry-research`、`swine-poultry-research`），使旧 `/note/notes/<id>` 可以一一对应。

**6. Header 的"笔记"改为站内 `Link` 指向 `/notes`，在所有构建显示。**
去掉对 `VITE_NOTES_PATH` 的依赖（原来是为了避免没有 `/note/` 的构建点进 404；现在 `/notes` 是主站自己的路由，不会 404）。相应修改 Header 测试里对环境变量的断言。网格与股市分析入口仍通过 `notesLinks.ts` 的常量指向 `/note/`。

**7. 开发代理键改为只匹配 `/note/`。**
把 `vite.config.js` 的 `'/note'` 改为正则键 `'^/note/'`，确保 `/notes` 不被代理；并加测试或脚本断言（读取配置检查键）。

**8. notes-site 精简：删除而不是隐藏。**
删除首页、`notes/`、`rss.xml.ts`、`lab/text-count.astro`、`src/content/`、`content.config.ts`、`IndustryETFSection.astro`、`lib/notes.ts`、`lib/industry-etf.ts`、`data/industry-etf.json`、`public/reports/`；`labs.ts` 去掉文字计数；`Base.astro` 的品牌与导航改为指向主站（"返回主站"、"网格交易"、"股市分析"），去掉 RSS 链接与页脚的 GitHub/RSS；`@astrojs/rss` 若不再使用则从 `notes-site/package.json` 移除。`scripts/check-note-links.mjs` 与其测试按新的页面集合更新。

**9. 旧地址的跳转全部放在 `public/_redirects`，不在前端兜底。**
被删除的 notes 页面在 `dist/note/` 里不存在，所以 `_redirects` 的 302 一定生效（不会被同名静态文件抢先）。映射：`/note/`、`/note/notes`、`/note/notes/`、`/note/rss.xml`、`/note/lab/text-count`（含尾斜杠）到 `/notes`；`/note/notes/:id` 到 `/notes/:id`；两个写作指南 id 到 `/notes`（先写在 `:id` 通配之前，使用更具体的规则优先）；两份报告的旧中文文件名（URL 编码）到新地址。因为这些是 `/note/` 下的旧地址，其他构建线没有 `/note/`，不需要兜底。

**10. 站点地图、SEO、预渲染。**
`generate-sitemap.mjs` 与 `prerender-routes.mjs` 增加 `/notes`、每篇笔记、`/industry-etf`；`seo.ts` 为三类页面提供标题与描述；GitHub Pages 的 `prepare-pages.mjs` 路由表按需加入 `notes`、`industry-etf`。

## Risks / Trade-offs

- [抽取 `renderMarkdown` 可能改变书稿渲染] → 抽取前后用现有 FirstBook 测试加一个渲染快照比对；不一致则退回决策 2 的备选。
- [3 篇笔记里有主站 Markdown 渲染器不支持的语法（表格、HTML 块、emoji 标题）] → 迁入后逐篇在浏览器里对照 notes 原页面检查；不支持的语法在渲染器里补最小支持或改写 Markdown，不丢内容。
- [旧链接丢失（外站、书签、RSS 订阅者）] → 302 覆盖全部旧页面；RSS 订阅者会得到跳转到 `/notes` 的页面而不是订阅源，已在提案标记 BREAKING。
- [报告里 ECharts 来自 CDN，离线或被墙时图表不显示] → 与 notes 现状相同，不在本变更解决，文档注明。
- [`/notes` 与 `/research-notes` 命名相近，用户混淆] → 导航文案分别写"行业研究笔记"和"公司研究"，列表页开头一句话说明区别。
- [notes-site 删除的内容在其他地方仍有链接（notes lab 页的页头/页脚）] → 更新 `Base.astro`，并让 `check-note-links` 在构建时发现断链。

## Migration Plan

1. 建主站页面与数据（笔记、报告、行业 ETF），本地验证渲染。
2. 抽取或复用 Markdown 渲染，更新 Header、入口、站点地图、SEO、预渲染、开发代理。
3. 精简 notes-site，更新 `_redirects` 与链接检查脚本。
4. 本地三种构建、`wrangler pages dev` 实测旧地址跳转、浏览器逐页核对。
5. 推送（需用户确认），线上验证旧地址 302、新页面、lab 页面不受影响。
回退：`git revert`，notes 原站点（GitHub Pages）一直保留，内容不会丢。

## Open Questions

- 无。
