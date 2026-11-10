# gupiaoWS / BusinessWeb

个人投资研究与网格交易工作台。覆盖 **沪深 A 股 + 美股标普 500**，把多智能体投研流水线（A 股买/卖决策、美股深度覆盖）与网格交易工具（notes 站点，`/note/lab/grid-trading/`）整合在一个站点里。

## 这是什么


- **公司估值工作台**：`/valuation`支持本地Pi/Codex/Claude/OpenCode及具体模型版本选择、财务采集、六方法三情景估值、参数复算和报告导出。启动方法见[本地估值说明](docs/valuation-local-setup.md)。

- **行业研究笔记与行业 ETF 清单**：`/notes`（3 篇行业笔记，另含 2 份独立 HTML 完整报告，位于 `public/research/`）与 `/industry-etf`（7 个行业组、59 只 ETF），内容由原 notes 站点迁入；新增笔记的方法见 [docs/notes-cohosting.md](docs/notes-cohosting.md)。
- **网格交易**：由 notes 站点的网格交易计算器提供（`notes-site/`，部署后在 `/note/lab/grid-trading/`），包含回测、已保存标的、详情与分钟线；云同步走自己的 Cloudflare Worker + D1，不依赖 Supabase。主站旧的 `/grid-trading*` 路径会 302 跳转到那里。
- **AI 投研**：项目自带统一股票分析与交易分析 skill（见 [AI 投研 skills](#ai-投研-skills)），支持深度研究、圆桌观点与交易风险分析。
- **多市场数据**：通过 `src/services/api.ts` 的本地封装，覆盖美股行情、A 股行情、ETF 实时数据、AkShare 数据字典。
- **每日分析**：`/daily-analysis` 自动获取 A 股指数、涨跌停、连板梯队和榜单，保存交易日快照；原手工记录保留在「历史旧版」。数据口径与定时归档见[每日分析说明](docs/daily-analysis.md)。

栈：React 18 · Vite 5 · TypeScript · React Router 6 · Vitest · Node 24。

## 目录结构

```
BusinessWeb/
├── src/
│   ├── pages/              路由页面（InvestHub / ResearchNotes / GridMoved 等）
│   ├── features/
│   ├── components/         复用组件（Header / Footer / 各市场卡片）
│   ├── data/               标普500 / 沪深 / 概念板块数据源
│   ├── services/           API 封装（akshare / 行情代理）
│   └── hooks/, utils/, types/
├── api/                    接口处理函数（由 functions/api/ 经适配器接入 Cloudflare Pages Functions）
├── functions/              Cloudflare Pages Functions 入口（调用 api/ 与 server/edge 适配器）
├── server/                 Vite dev 中间件（行情代理）
├── d1/schema.sql           复盘与候选池云同步的 D1 表结构
├── supabase/migrations/    评论的 Supabase 表结构
├── docs/
│   ├── DEPLOYMENT.md       复盘/候选池云同步（D1）与评论（Supabase）配置
│   ├── AKSHARE.md          AKTools 接入说明
│   ├── design/             ETF 网格设计文档
│   ├── research/           已完成的圆桌报告样例
│   └── superpowers/        计划与设计 spec
```

## 快速开始

```bash
cd BusinessWeb
npm ci
npm run dev          # http://localhost:5173
```

需要 **Node 24**（已在 `package.json` 的 `engines` 中声明）。开发服务器自带 `/api/grid-market` 行情代理（热力图使用）；`/api/pulse-sync`、`/api/candidates-sync` 需要 D1，开发服务器把它们代理到线上的 Cloudflare 站点。

## 验证

```bash
npm test -- --run
npm run test:functions
npm run typecheck
npm run build
```

`typecheck` 覆盖新增的 notes 入口组件、估值与同步服务端；历史页面暂不在该检查范围内。`test:functions` 检查接口处理函数的加载与未配置时的响应。

## Orca 开发团队 dev_team

项目内置 [dev-team 技能](.agents/skills/dev-team/SKILL.md)：当前 agent 作为唯一管理入口，通过 Orca 协调 Codex、Claude、Kimi、Antigravity 与 OpenCode MiniMax M3。Android、Web 前端、后端分别生成需求、设计与测试流程，全栈按契约组织并行；按场景加载文档，支持额度不足时交接与替补。

在项目对话中输入 `$dev-team <开发目标>`（Claude Code 用 `/dev-team`，Kimi 用 `/skill:dev-team`）。[操作与迁移说明](.agents/skills/dev-team/references/operations.md) 包含初始化、路由、真实派工、M3 兼容启动和恢复步骤。在其他项目安装：

```bash
node /path/to/dev-team/scripts/dev-team.mjs init --project /path/to/other-project
```

依赖 Node 20+、支持 orchestration 的 Orca 和至少一个可用执行器；需在 Orca 打开目标项目后派工。项目运行记录与凭据不随技能分发。

## AI 投研 skills

项目以 `stock-analysis` 融合研究方法、股票研究专家、腾讯自选股投研专家团与 Public Markets Investing。新增商业模式驱动树、核心假设、预测归因、行业周期及证据追溯；回测与组合风险按需启用。交易分析团队保留独立入口；旧两套名称转入融合版。

从 BusinessWeb 目录启动工具。股票分析已安装到以下项目目录：

| 工具 | 股票分析入口 |
| --- | --- |
| Codex / Antigravity CLI | `.agents/skills/stock-analysis/SKILL.md` |
| Claude Code | `.claude/skills/stock-analysis/SKILL.md` |
| OpenCode | `.opencode/skills/stock-analysis/SKILL.md` |
| CodeBuddy Code | `.codebuddy/skills/stock-analysis/SKILL.md` |

执行 `npm run skills:package` 会从 `.agents/skills/` 同步融合版股票分析及旧两套兼容入口到其他三个目录（网站不再提供下载包）。重新打开会话后确认 Skill 列表；普通分析一个 agent 即可，多视角不强制多 agent。

| Skill | 用途 | 何时触发 |
|---|---|---|
| **stock-analysis** | 五步流程：商业模式 / 核心假设 / 盈利预测 / 三情景与盈亏比 / 六专家 / 证据与验证；按需回测与组合风险 | 「用股票分析研究 XX」「商业模式」「核心假设」「估值」「财报解读」「圆桌」 |
| **trading-analysis-team** | 12 角色流水线：技术 / 基本面 / 新闻 / 情绪并行采集 → 多空辩论 → 风险三派挑战 → 拍板 BUY/SELL/HOLD | 「X 该不该买」「多空辩论」「风险诊断」 |

每个 skill 内置研究纪律：数据可追溯、缺失标 `[MISSING]`，研究区间与情景价标明条件，结尾声明不构成投资建议。股票分析优先研究约 2:1 及以上的情景盈亏比，同时核实悲观压力、期限与证据；初筛数字不能直接认证。用户要求更新网站时，可将结果同步到 `src/data/companies.ts` 并显示在 `/research-notes`。

## 部署

只有 Cloudflare 一条发布线，推送 `main` 就是发布：

- **站点（Cloudflare Pages）**：推送 `main` 自动构建，构建命令 `npm run build:cloudflare`（主站 + `notes-site/` 的三个工具，后者放进 `/note/`）。前端与 `/api/*`（`functions/api/`）都在 Cloudflare。构建设置、变量、验证命令与回退办法见 [docs/cloudflare-pages.md](docs/cloudflare-pages.md)。
- **网格后端（Cloudflare Worker `grid-trading-sync`）**：`notes-site/workers/grid-trading-sync/` 有改动推到 `main` 时，由 [.github/workflows/worker-deploy.yml](.github/workflows/worker-deploy.yml) 自动跑测试、应用表结构并部署，不需要在本机执行 `wrangler deploy`。限制与回退方法见 [docs/notes-cohosting.md](docs/notes-cohosting.md)。

## 限制与边界

明确**没有**做、也**不在**路线图里立刻做的事：

- 没有 R2 / S3 文件上传；当前没有附件业务（PDF、图片、模型输出等需要文件存储时再接入）
- 不做多用户登录与权限系统；云同步用专用 token，按单用户多设备设计
- A 股行情仍依赖公共代理（东方财富、腾讯），不保证长期稳定
- AKTools 需 Python 服务，未自动部署；如需使用请配置 `VITE_AKTOOLS_BASE_URL`
- 投研 skill 的所有产出是研究材料，**不构成投资建议**

## 相关文档

- [docs/data-maintenance.md](docs/data-maintenance.md) — 数据过期盘点、更新台账、维护周期与验收方法
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — 云同步（D1）与评论（Supabase）配置
- [docs/AKSHARE.md](docs/AKSHARE.md) — AKTools 接入
- [docs/design/ETF_GRID_TRADING.md](docs/design/ETF_GRID_TRADING.md) — 网格交易设计
- [docs/research/](docs/research/) — 圆桌报告样例
- [docs/superpowers/plans/2026-10-02-free-cloud-foundation.md](docs/superpowers/plans/2026-10-02-free-cloud-foundation.md) — 免费云同步实施计划
- [docs/superpowers/specs/2026-10-02-free-cloud-design.md](docs/superpowers/specs/2026-10-02-free-cloud-design.md) — 设计 spec
