## Why

站点现在有「投资 / AI实验室 / 自由空间」三个栏目，但实际在用、在更新的只有投资一栏；AI 实验室、自由空间、投资页里的「AI 工具」和「已舍弃」分组不再需要，却仍占着导航、首页、SEO、站点地图、预渲染和测试。先把它们删掉，站点只剩一条主线，后续的部署统一（变更 `single-deploy`）要处理的面积也随之变小。

## What Changes

- **BREAKING** 删除 AI 实验室：`/ai`、`/ai/:slug`、`/ai/fullstack-roadmap`、`/ai/dev-team` 及其数据、组件、内容、样式、静态资源和「AI 试问」接口 `api/ask.ts`。
- **BREAKING** 删除自由空间：`/life`。
- **BREAKING** 删除投资页的「AI 工具」：`/invest/ai-tools` 及网站上的 Skill 下载包（`public/investment-skills/`、`public/ai-skills/`）。仓库里自己使用的技能（`.agents/skills/` 等）不动。
- **BREAKING** 删除「已舍弃」分组的 4 个页面：`/trading-philosophy`、`/investment-strategy`、`/mainland-investment-targets`、`/investment-targets`。
- **BREAKING** 首页改为投资页：`/` 直接显示原 `/invest` 的内容，原首页（书的横幅、三个栏目、名句）删除；`/invest` 跳转到 `/`。
- 顶部导航收为四项：投资（`/`）、笔记、博客、关于。
- 被删除的地址在 Cloudflare 上 302 到 `/`，前端路由不再认识它们。
- 博客保留；其中指向 AI 实验室、自由空间的引导链接改指向仍存在的页面。
- 关于页去掉两个已删栏目的介绍。

不在本变更内：Pulse 的旧 Gist 同步——核对后发现同步代码早已删除，`Pulse.tsx` 里只剩一行清理遗留 token 的代码，保留不动。

## Capabilities

### New Capabilities
- `site-navigation`: 站点的栏目结构——首页即投资页、顶部导航项、已删除栏目的跳转，以及站点地图与预渲染只收录仍存在的页面。

### Modified Capabilities

（无。`grid-trading-entry` 的需求文字里举例提到「AI 实验室列表」，那一条需求由变更 `single-deploy` 整体改写，届时一并去掉，本变更不重复修改，避免两个变更改同一条需求。）

## Impact

- 路由与导航：`src/App.tsx`、`src/data/siteMap.ts`、`src/components/Header.tsx`、`src/components/SectionChrome.tsx`。
- 删除的页面：`AiStudio`、`AiLabDirection`、`AiLearningPlan`、`DevTeamGuide`、`LifeLab`、`Home`、`InvestmentAiTools`、`TradingPhilosophy`、`InvestmentStrategy`、`MainlandInvestmentTargets`、`InvestmentTargetsPage` 及各自的测试。
- 删除的数据与组件：`src/data/aiLab.ts`、`investmentSkills.ts`、`writingSkills.ts`、`quotes.ts`，`src/components/lab/`、`components/skills/`、`components/AIDiffusion.tsx`、`components/home/`，`src/features/ai-learning/`，`src/content/dev-team-README.md`、`dropshipping-strategy.md`。
- 构建脚本：`scripts/generate-sitemap.mjs`（静态列表与读取 `aiLab.ts` 的正则）、`scripts/prerender-routes.mjs`（两条 `/ai/*`）、`src/utils/seo.ts`（导入 `aiLab`）、`scripts/check-functions.mjs`（导入 `ask`）、`package.json` 的 `skills:package`。
- 接口与环境变量：`api/ask.ts`、`src/services/ask.test.ts`、`docs/ai-ask-setup.md`、`public/ai-privacy.html`，`.env.example` 里的 `MINIMAX_*`、`ASK_*`、`VITE_SUPABASE_*`、`SUPABASE_ANON_KEY`（只有 ask 使用）。章节评论用的 `SUPABASE_URL`、`SUPABASE_SECRET_KEY` 不动。
- 静态资源：`public/ai-learning/`、`public/ai-skills/`、`public/investment-skills/`、`public/_redirects`（新增跳转）。
- 样式：`src/styles/shell.css` 的「AI 实验室」段与首页段中不再使用的规则。
- 文档：`README.md` 的栏目说明、dev-team、无货源电商、AI 投研 skills 下载相关段落。
- 外部链接：已收录或被分享过的上述地址会跳到首页，不再有原内容。
