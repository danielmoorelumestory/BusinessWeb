## Context

主站是 React 18 + Vite 的单页应用，路由集中在 `src/App.tsx`，导航与投资页分组集中在 `src/data/siteMap.ts`。要删的栏目除了页面本身，还通过四条隐性路径被引用：

- `src/utils/seo.ts` 直接导入 `aiLab` 的 `findDirection`；
- `scripts/generate-sitemap.mjs` 有一份写死的路径列表，并用正则从 `aiLab.ts` 里提取 slug；
- `scripts/prerender-routes.mjs` 写死了 `/ai/dev-team`、`/ai/dropshipping`；
- `scripts/check-functions.mjs` 导入 `api/ask.js`。

`api/ask.ts` 在 `functions/api/` 下没有对应入口，Cloudflare 线上并没有提供这个接口，它只在源码、测试和检查脚本里存在。

本变更从 `main` 开分支实施。`main` 比 `sync/upstream` 多 39 个提交，但这些提交不涉及本变更要改的文件（已用 `git diff --stat sync/upstream main` 核对，差异只在 Worker 与一个工作流）。

## Goals / Non-Goals

**Goals:**

- 删掉列出的栏目和页面，仓库里不留悬空引用。
- 首页就是投资页，导航只剩四项。
- 旧地址不出现「这一页不存在」，统一回到首页。
- 测试、类型检查、`build`、`build:cloudflare` 全部通过。

**Non-Goals:**

- 不动 `/note/` 下的三个工具，不动 Worker。
- 不删博客、关于页、书、估值、DCF、观察盘等保留页面的功能。
- 不清理 `docs/superpowers/` 与 `openspec/changes/archive/` 里的历史文档，它们是记录。
- 不删仓库自用的技能目录（`.agents/skills/`、`.claude/skills/` 等）。
- 不处理非 Cloudflare 构建线，那是 `single-deploy` 的范围。

## Decisions

### 1. `/` 渲染投资页，`/invest` 跳转到 `/`

`InvestHub` 挂到 `/`；`/invest` 在 `_redirects` 里 302 到 `/`，前端路由再加一条 `<Navigate replace>` 兜底。投资页下的子路径（`/invest/etf`、`/invest/national-team`）**保持不变**。

备选：把所有 `/invest/*` 子路径也提到根下。没有采用——这会多出一批跳转和测试改动，对"只剩一条主线"没有额外帮助。

### 2. 导航标签用「投资」，不用「首页」

导航变为「投资（`/`）、笔记、博客、关于」。`NAV_ITEMS` 里删掉原来的 `/` 首页项，把投资项的路径改成 `/`。`isNavActive` 目前对 `/` 和 `/invest` 各有一段特殊处理，需要合并成一段：路径是 `/`、或命中 `findInvestEntry` 且不是其他导航项自己的页面时，点亮「投资」。

面包屑由「Live › 投资 › 当前页」改为「投资 › 当前页」，「投资」指向 `/`。

### 3. 已删地址统一 302 到 `/`

沿用 `_redirects` 里已有的做法（已删除的知识图谱页面就是 302 到首页）。`/ai/*` 用通配规则。前端路由不为这些地址保留任何页面，万一服务端跳转没生效，由现有的 `NotFound` 处理。

继续用 302 而不是 301：与文件里现有约定一致，方便回退。

### 4. 原首页的内容全部删除，「最近更新」保留在关于页

`Home.tsx`、`quotes.ts` 只有首页使用，删除。`RecentUpdates` 还被关于页使用，它依赖的 `generate-changelog.mjs` 与 `public/changelog.json` 保留不动。

### 5. 技能打包脚本：只去掉网站下载包，保留对自用技能的同步

`npm run skills:package` 现在做三件事：

1. `generate-investment-method.mjs`、`generate-future-trends-skill.mjs`：把研究方法和未来趋势写进 `.agents/skills/stock-analysis/references/`——这是自用技能的内容，**保留**。
2. `package-investment-skills.py` 的前半段：把 `.agents/skills/` 同步到 `.claude`、`.opencode`、`.codebuddy`——**保留**。
3. 同一脚本的后半段：打 ZIP 到 `public/investment-skills/`——**删除**。

做法是把脚本改成只做同步（并改名为 `sync-skills.py`），`package-writing-skills.py` 只产出下载包，整个删除。

### 6. 删除顺序：先断引用，再删文件

先改路由、导航、SEO、站点地图、预渲染这些"引用方"，让类型检查在每一步都能指出下一个悬空引用；再删页面、数据、组件、静态资源；最后清样式和文档。这样每一组任务结束时仓库都是可构建的。

## Risks / Trade-offs

- [`seo.ts` 或站点地图脚本漏改，构建在 `prebuild` 阶段失败] → 任务里把这两处排在最前，并在每组任务后运行 `npm run build`。
- [`shell.css` 里「AI 实验室」段的类名被别的页面复用，删掉后样式丢失] → 删之前对每个类名在 `src/` 里搜索，只删确认无人使用的规则；`labContrast.test.ts` 随之删除或改写。
- [`.env.example` 里 `SUPABASE_ANON_KEY`、`VITE_SUPABASE_*` 被章节评论使用] → 已核对源码，只有 `api/ask.ts` 与 `AskLab` 引用；删除前再搜索一次确认。
- [被搜索引擎收录的旧地址跳到首页，内容不再存在] → 这是有意为之；站点地图同步去掉这些地址。
- [`isNavActive` 合并后，`/notes`、`/blog` 等页面误点亮「投资」] → `siteMap.test.ts` 已有对应用例，改写后保留这些断言。

## Migration Plan

1. 从 `main` 开分支，按 `tasks.md` 顺序实施，每组结束跑一次测试与构建。
2. 合并到 `main` 后 Cloudflare 自动部署。
3. 部署后用 `curl -I` 抽查几个旧地址是否 302 到 `/`，以及 `/` 是否显示投资页。
4. 回退：`git revert` 合并提交并重新部署；本变更不涉及数据库和浏览器本地数据。

## Open Questions

- 关于页现有的两条栏目介绍删掉后，是否需要补一句新的站点定位？实施时先只删，不新写文案。
