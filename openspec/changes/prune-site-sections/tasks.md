## 1. 准备

- [x] 1.1 从 `main` 开分支 `chore/prune-site-sections`，运行 `npm ci`、`npm test -- --run`、`npm run typecheck`、`npm run build`，记录基线结果
- [x] 1.2 对每个待删模块再搜索一次引用方（`aiLab`、`AskLab`、`InvestmentAiTools`、`investmentSkills`、`writingSkills`、`AIDiffusion`、`home/InvestmentTargets`、`quotes`），与 proposal 的 Impact 清单比对，有出入先更新清单

## 2. 路由与导航：首页改为投资页

- [x] 2.1 `src/App.tsx`：`/` 渲染 `InvestHub`；`/invest` 改为 `<Navigate to="/" replace />`；删除 `Home` 的导入
- [x] 2.2 `src/data/siteMap.ts`：`NAV_ITEMS` 改为「投资（`/`）、笔记、博客、关于」；删除 `INVEST_GROUPS` 的 `archived` 分组与 `tools` 分组里的 `/invest/ai-tools`
- [x] 2.3 `src/data/siteMap.ts`：合并 `isNavActive` 对 `/` 与 `/invest` 的两段特殊处理，使 `/` 与投资页收纳的页面点亮「投资」，独立导航项只点亮自己
- [x] 2.4 `src/components/SectionChrome.tsx`：面包屑改为「投资 › 当前页」，「投资」指向 `/`；`HubLink.archived` 字段及对应的提示渲染一并删除
- [x] 2.5 更新 `siteMap.test.ts`、`Header.test.tsx`、`SectionChrome.test.tsx`、`Sections.test.tsx`、`App.test.tsx` 中与导航、面包屑、首页相关的断言
- [x] 2.6 运行测试与类型检查，确认通过

## 3. 断开构建脚本对已删内容的依赖

- [x] 3.1 `src/utils/seo.ts`：删除对 `aiLab` 的导入与 `/ai*`、`/life`、`/invest/ai-tools`、四个已舍弃页面的条目；`/` 的标题与描述改为投资页的
- [x] 3.2 `scripts/generate-sitemap.mjs`：从静态列表删除已删地址与 `/invest`；删除读取 `src/data/aiLab.ts` 的正则
- [x] 3.3 `scripts/prerender-routes.mjs`：删除 `/ai/dev-team`、`/ai/dropshipping` 两个分支，以及其他已删路由的预渲染项
- [x] 3.4 `scripts/check-functions.mjs`：删除对 `api/ask.js` 的导入与三条用例
- [x] 3.5 运行 `npm run build`，确认 `prebuild` 与预渲染都通过

## 4. 删除 AI 实验室与自由空间

- [x] 4.1 `src/App.tsx`：删除 `/ai`、`/ai/fullstack-roadmap`、`/ai/:slug`、`/ai/dev-team`、`/life` 路由与对应的导入
- [x] 4.2 删除页面及测试：`AiStudio`、`AiLabDirection`、`AiLearningPlan`、`DevTeamGuide`、`LifeLab`
- [x] 4.3 删除 `src/data/aiLab.ts`、`aiLab.test.ts`，`src/components/lab/`，`src/components/skills/`，`src/features/ai-learning/`，`src/content/dev-team-README.md`、`src/content/dropshipping-strategy.md`
- [x] 4.4 删除试问接口：`api/ask.ts`、`src/services/ask.test.ts`（连同只为它存在的 `src/services/ask*`）、`docs/ai-ask-setup.md`、`public/ai-privacy.html`
- [x] 4.5 `.env.example`：删除 `SUPABASE_ANON_KEY`、`MINIMAX_*`、`ASK_*`、`VITE_SUPABASE_*`；删除前再搜索一次，确认只有 ask 使用
- [x] 4.6 删除 `public/ai-learning/`、`public/ai-skills/`
- [x] 4.7 运行测试、类型检查与构建，确认通过

## 5. 删除「AI 工具」与网站下载包

- [x] 5.1 `src/App.tsx`：删除 `/invest/ai-tools` 路由；删除 `InvestmentAiTools.tsx`、`src/data/investmentSkills.ts`、`src/data/writingSkills.ts`
- [x] 5.2 把 `scripts/package-investment-skills.py` 改为只做技能目录同步（去掉打 ZIP 的部分），改名为 `scripts/sync-skills.py`；删除 `scripts/package-writing-skills.py`
- [x] 5.3 `package.json`：`skills:package` 改为两个生成脚本加新的同步脚本
- [x] 5.4 删除 `public/investment-skills/`
- [x] 5.5 运行 `npm run skills:package`，确认只更新各工具的技能目录、`public/` 下没有新文件（`git status` 核对）

## 6. 删除「已舍弃」页面与原首页

- [x] 6.1 `src/App.tsx`：删除 `/trading-philosophy`、`/investment-strategy`、`/mainland-investment-targets`、`/investment-targets` 路由与导入
- [x] 6.2 删除页面 `TradingPhilosophy`、`InvestmentStrategy`、`MainlandInvestmentTargets`、`InvestmentTargetsPage`，以及只被它们使用的 `src/components/AIDiffusion.tsx`、`src/components/home/`
- [x] 6.3 删除 `src/pages/Home.tsx`、`Home.test.tsx`、`src/data/quotes.ts`；保留 `RecentUpdates` 与 changelog 生成（关于页在用）
- [x] 6.4 运行测试、类型检查与构建，确认通过

## 7. 保留页面里的残留链接

- [x] 7.1 `src/pages/About.tsx`：删除 AI实验室、自由空间两条栏目介绍，更新 `About.test.tsx`
- [x] 7.2 `src/pages/BlogIndex.tsx`：空状态里「探索 AI 实验室」的链接删除，更新测试
- [x] 7.3 `src/pages/BlogArticle.tsx`：文末引导表里「AI」「生活」两类改指向仍存在的页面或去掉，更新测试
- [x] 7.4 在 `src/` 搜索 `to="/ai`、`to="/life`、`'/ai'`、`'/life'`、`/invest'`，确认没有残留

## 8. 跳转

- [x] 8.1 `public/_redirects`：新增 `/invest`、`/ai`、`/ai/*`、`/life`、`/invest/ai-tools` 与四个已舍弃地址到 `/` 的 302（含带尾斜杠的写法），具体规则写在通配规则之前
- [x] 8.2 运行 `npm run build:cloudflare`，用 `npx wrangler pages dev dist` 在本地 `curl -I` 核对每条旧地址返回 302 且目标为 `/`

## 9. 样式与文档

- [x] 9.1 `src/styles/shell.css`：对「AI 实验室」段与「首页」段的每个类名搜索使用方，删除无人使用的规则；`labContrast.test.ts` 随之删除或改写
- [x] 9.2 `README.md`：删除 dev-team 网站入口、无货源电商、Skill 下载相关段落，栏目说明改为现状
- [x] 9.3 `docs/data-maintenance.md` 与 `.csv`：删除已删页面对应的条目

## 10. 验收

- [x] 10.1 按规格 `site-navigation` 的「没有悬空引用」场景执行搜索，确认无匹配
- [x] 10.2 运行 `npm test -- --run`、`npm run test:functions`、`npm run typecheck`、`npm run build`、`npm run build:cloudflare`，全部通过
- [x] 10.3 本地预览逐项核对：`/` 显示投资页；导航四项；`/notes`、`/blog`、`/about`、`/first-book`、`/valuation`、`/watch` 正常；`/note/lab/grid-trading/`、`/note/lab/etf-review/`、`/note/lab/stock/` 正常
- [ ] 10.4 合并到 `main`，部署后在线上抽查旧地址的 302 与首页
