# gupiaoWS / BusinessWeb

个人投资研究与网格交易工作台。覆盖 **沪深 A 股 + 美股标普 500**，把多智能体投研流水线（A 股买/卖决策、美股深度覆盖）与网格交易工具（notes 站点，`/note/lab/grid-trading/`）整合在一个站点里。

## 这是什么


- **公司估值工作台**：`/valuation`支持本地Pi/Codex/Claude/OpenCode及具体模型版本选择、财务采集、六方法三情景估值、参数复算和报告导出。启动方法见[本地估值说明](docs/valuation-local-setup.md)。

- **网格交易**：由 notes 站点的网格交易计算器提供（`notes-site/`，部署后在 `/note/lab/grid-trading/`），包含回测、已保存标的、详情与分钟线；云同步走自己的 Cloudflare Worker + D1，不依赖 Supabase。主站旧的 `/grid-trading*` 路径会跳转到那里（Cloudflare 上 302，其他构建显示迁移说明）。
- **AI 投研**：项目自带统一股票分析与交易分析 skill（见 [AI 投研 skills](#ai-投研-skills)），支持深度研究、圆桌观点与交易风险分析。
- **多市场数据**：通过 MCP（yahoo-finance、baostock）和 `src/services/api.ts` 的本地封装，覆盖美股行情、A 股行情、ETF 实时数据、AkShare 数据字典。

栈：React 18 · Vite 5 · TypeScript · React Router 6 · Vitest · Node 24。

## 目录结构

```
BusinessWeb/
├── src/
│   ├── pages/              路由页面（Home / ResearchNotes / GridMoved 等）
│   ├── features/
│   ├── components/         复用组件（Header / Footer / 各市场卡片）
│   ├── data/               标普500 / 沪深 / 概念板块数据源
│   ├── services/           API 封装（akshare / 行情代理）
│   └── hooks/, utils/, types/
├── api/                    接口处理函数（Vercel 与 Cloudflare 共用）
├── functions/              Cloudflare Pages Functions 入口（调用 api/ 与 server/edge 适配器）
├── server/                 Vite dev 中间件（行情代理）
├── supabase/migrations/    云同步表结构（脉搏、候选池、评论、资料库等）
├── docs/
│   ├── DEPLOYMENT.md       Vercel + Supabase 部署细节
│   ├── AKSHARE.md          AKTools 接入说明
│   ├── design/             ETF 网格设计文档
│   ├── research/           已完成的圆桌报告样例
│   └── superpowers/        计划与设计 spec
└── opencode.jsonc          opencode 配置（含 MCP servers）
```

## 快速开始

```bash
cd BusinessWeb
npm ci
npm run dev          # http://localhost:5173
```

需要 **Node 24**（已在 `package.json` 的 `engines` 中声明）。开发服务器自带 `/api/grid-market` 行情代理（热力图使用）；`/api/pulse-sync` 等同步接口仅在 `vercel dev` 下运行。

## 验证

```bash
npm test -- --run
npm run test:functions
npm run typecheck
npm run build
```

`typecheck` 覆盖新增的 notes 入口组件、估值与同步服务端；历史页面暂不在该检查范围内。`test:functions` 检查 Vercel Function 的 schema 与环境变量使用。

## AI 投研 skills

项目以 `stock-analysis` 融合研究方法、股票研究专家、腾讯自选股投研专家团与 Public Markets Investing，位于「AI 工具」第一项。新增商业模式驱动树、核心假设、预测归因、行业周期及证据追溯；回测与组合风险按需启用。交易分析团队保留独立入口；旧两套名称转入融合版。

从 BusinessWeb 目录启动工具。股票分析已安装到以下项目目录：

| 工具 | 股票分析入口 |
| --- | --- |
| Codex / Antigravity CLI | `.agents/skills/stock-analysis/SKILL.md` |
| Claude Code | `.claude/skills/stock-analysis/SKILL.md` |
| OpenCode | `.opencode/skills/stock-analysis/SKILL.md` |
| CodeBuddy Code | `.codebuddy/skills/stock-analysis/SKILL.md` |

执行 `npm run skills:package` 会从 `.agents/skills/` 同步融合版股票分析及旧两套兼容入口到其他三个目录，并更新下载包。旧名称 ZIP 包含同级 `stock-analysis`，解压后可直接读取融合版。重新打开会话后确认 Skill 列表；普通分析一个 agent 即可，多视角不强制多 agent。

| Skill | 用途 | 何时触发 |
|---|---|---|
| **stock-analysis** | 五步流程：商业模式 / 核心假设 / 盈利预测 / 三情景与盈亏比 / 六专家 / 证据与验证；按需回测与组合风险 | 「用股票分析研究 XX」「商业模式」「核心假设」「估值」「财报解读」「圆桌」 |
| **trading-analysis-team** | 12 角色流水线：技术 / 基本面 / 新闻 / 情绪并行采集 → 多空辩论 → 风险三派挑战 → 拍板 BUY/SELL/HOLD | 「X 该不该买」「多空辩论」「风险诊断」 |

每个 skill 内置研究纪律：数据可追溯、缺失标 `[MISSING]`，研究区间与情景价标明条件，结尾声明不构成投资建议。股票分析优先研究约 2:1 及以上的情景盈亏比，同时核实悲观压力、期限与证据；初筛数字不能直接认证。用户要求更新网站时，可将结果同步到 `src/data/companies.ts` 并显示在 `/research-notes`。

## MCP 数据源

在仓库根的 `opencode.jsonc` 中配置：

- **yahoo-finance**（`yahoo-finance-mcp-server`）：美股行情 / 财报 / 基本面
- **baostock**（`/Users/hassan/AndroidStudioProjects/gupiaoWS/.mcp-servers/mcp-baostock-server`）：A 股行情与财务数据（baostock 0.8.9）

## 部署

- **Cloudflare Pages（当前线上）**：推送 `main` 自动构建，前端与 `/api/*`（`functions/api/`）都在 Cloudflare。构建设置、变量、验证命令与回退办法见 [docs/cloudflare-pages.md](docs/cloudflare-pages.md)。
  - **notes 站点同域托管**：`notes-site/`（Astro）在构建时放进 `/note/`，用 `npm run build:cloudflare` 构建；只影响 Cloudflare 构建，Vercel 与 GitHub Pages 不受影响。搬家前必读的本地数据说明见 [docs/notes-cohosting.md](docs/notes-cohosting.md)。
- **Vercel（回退）**：默认 `npm run build` 输出到根路径；Serverless Functions 处理 `/api/grid-market`、`/api/pulse-sync` 等接口。完整步骤见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)，包括 Vercel 免费项目额度、可选 Supabase 同步与环境变量。
- **GitHub Pages**：由 [.github/workflows/pages.yml](.github/workflows/pages.yml) 在推送 `main` 时自动测试、构建并发布，也可在 Actions 中手动运行。首次迁移需在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**；若 `github-pages` 环境限制了部署分支，需允许 `main`。不要将 Pages 的来源直接设成 `main` 分支静态目录，React 源码需要先构建。Pages 不运行 Functions，API 继续使用配置的 Vercel 服务。
  - 本地验证：`npm run build:pages`；构建产物上传为 Pages artifact，不提交到 `gh-pages`。`deploy` 脚本与 `gh-pages` 依赖已移除。
  - 确认新工作流部署成功后，才可以删除旧 `gh-pages` 分支。
  - **Vercel 独立配置**：Production Branch 设为 `main`、Root Directory 清空、Build Command 为 `npm run build`、Output Directory 为 `dist`。修改 Pages 工作流不会自动修正 Vercel 项目设置。

## 限制与边界

明确**没有**做、也**不在**路线图里立刻做的事：

- 没有 R2 / S3 文件上传；当前没有附件业务（PDF、图片、模型输出等需要文件存储时再接入）
- 不做多用户登录与权限系统；Supabase 同步用专用 token，按单用户多设备设计
- A 股行情仍依赖公共代理（东方财富、腾讯），不保证长期稳定
- AKTools 需 Python 服务，未自动部署；如需使用请配置 `VITE_AKTOOLS_BASE_URL`
- 投研 skill 的所有产出是研究材料，**不构成投资建议**

## 相关文档

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel + Supabase 部署
- [docs/AKSHARE.md](docs/AKSHARE.md) — AKTools 接入
- [docs/design/ETF_GRID_TRADING.md](docs/design/ETF_GRID_TRADING.md) — 网格交易设计
- [docs/research/](docs/research/) — 圆桌报告样例
- [docs/superpowers/plans/2026-10-02-free-cloud-foundation.md](docs/superpowers/plans/2026-10-02-free-cloud-foundation.md) — 免费云同步实施计划
- [docs/superpowers/specs/2026-10-02-free-cloud-design.md](docs/superpowers/specs/2026-10-02-free-cloud-design.md) — 设计 spec
