# gupiaoWS / BusinessWeb

个人投资研究与网格交易工作台。覆盖 **沪深 A 股 + 美股标普 500**，把多智能体投研流水线（A 股买/卖决策、美股深度覆盖）与本地化网格交易工具整合在一个静态站点里。

## 这是什么

- **个人知识中心**：顶层 `/knowledge` 默认打开蒲公英知识网络，与 Obsidian 共用真实 Markdown，支持每日 Inbox、编辑、搜索和双向链接。本地 stdio MCP 支持 Agent 读写；只读 HTTP MCP 提供带认证及目录范围的第三方 AI 访问。运行 `npm run knowledge:app`，详见[本地说明](docs/knowledge-local-setup.md)和[HTTP MCP 接入](docs/knowledge-garden-and-http-mcp.md)。私人数据不会发布到静态网站；远程托管、OAuth、向量索引及 R2 为后续阶段。

- **公司估值工作台**：`/valuation`支持本地Pi/Codex/Claude/OpenCode及具体模型版本选择、财务采集、六方法三情景估值、参数复算和报告导出。启动方法见[本地估值说明](docs/valuation-local-setup.md)。

- **网格交易**：`src/features/grid-trading/` 实现了完整的 ETF / 个股网格模拟器——行情接入、参数求解、回测、记录、导入导出、可选 Supabase 同步。记录默认保存在浏览器，云同步只在手动配置独立 Supabase + token 后才启用。
- **多智能体投研**：项目自带三个研究 skill（见 [AI 投研 skills](#ai-投研-skills)），可由 Claude Code 或 opencode 调用，跑出首次覆盖报告、圆桌观点或交易决策流水线。
- **多市场数据**：通过 MCP（yahoo-finance、baostock）和 `src/services/api.ts` 的本地封装，覆盖美股行情、A 股行情、ETF 实时数据、AkShare 数据字典。

栈：React 18 · Vite 5 · TypeScript · React Router 6 · Vitest · Node 24。

## 目录结构

```
BusinessWeb/
├── src/
│   ├── pages/              路由页面（Home / ResearchNotes / GridCalculator / GridRecords 等）
│   ├── features/
│   │   └── grid-trading/   网格交易模块（自包含：模拟、回测、记录、同步、导入导出）
│   ├── components/         复用组件（Header / Footer / 各市场卡片）
│   ├── data/               标普500 / 沪深 / 概念板块数据源
│   ├── services/           API 封装（akshare / 行情代理）
│   └── hooks/, utils/, types/
├── api/                    接口处理函数（Vercel 与 Cloudflare 共用）
├── functions/              Cloudflare Pages Functions 入口（调用 api/ 与 server/edge 适配器）
├── server/                 Vite dev 中间件（行情代理）
├── supabase/migrations/    网格记录云同步表结构
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

需要 **Node 24**（已在 `package.json` 的 `engines` 中声明）。开发服务器自带 `/api/grid-market` 行情代理；`/api/grid-sync` 仅在 `vercel dev` 下运行。

## 验证

```bash
npm test -- --run
npm run test:functions
npm run typecheck
npm run build
```

`typecheck` 覆盖网格交易、估值、个人知识中心与新增同步服务端；历史页面暂不在该检查范围内。`test:functions` 检查 Vercel Function 的 schema 与环境变量使用。

## AI 投研 skills

项目自带三个项目本地 skill（`BusinessWeb/.claude/skills/` 下是 Claude Code 版本，`BusinessWeb/.opencode/skills/` 下是 opencode 版本，两份内容平行维护），用于辅助研究员和交易员角色：

| Skill | 用途 | 何时触发 |
|---|---|---|
| **stock-research-expert** | 单公司深度研究：首次覆盖 / DCF / 三情景估值 / 投资备忘录 / 财报前瞻与解读 | 「分析一下 XX」「估值」「财报解读」 |
| **tencent-stock-research-team** | 6 位风格不同的投研专家圆桌：多视角并存，不给买卖指令 | 「圆桌」「几位专家怎么看 X」「多空观点对比」 |
| **trading-analysis-team** | 12 角色流水线：技术 / 基本面 / 新闻 / 情绪并行采集 → 多空辩论 → 风险三派挑战 → 拍板 BUY/SELL/HOLD | 「X 该不该买」「多空辩论」「风险诊断」 |

每个 skill 内置研究纪律：数据可追溯、缺失标 `[MISSING]`、预期盈亏比 ≥ 约 2:1 才算首次介入赔率成立、所有买卖区间是条件化研究区间不是交易指令、结尾声明不构成投资建议。运行 `stock-research-expert` 后可将结果同步到 `src/data/companies.ts` 自动出现在 `/research-notes`。

## MCP 数据源

在仓库根的 `opencode.jsonc` 中配置：

- **yahoo-finance**（`yahoo-finance-mcp-server`）：美股行情 / 财报 / 基本面
- **baostock**（`/Users/hassan/AndroidStudioProjects/gupiaoWS/.mcp-servers/mcp-baostock-server`）：A 股行情与财务数据（baostock 0.8.9）

## 部署

- **Cloudflare Pages（当前线上）**：推送 `main` 自动构建，前端与 `/api/*`（`functions/api/`）都在 Cloudflare。构建设置、变量、验证命令与回退办法见 [docs/cloudflare-pages.md](docs/cloudflare-pages.md)。
- **Vercel（回退）**：默认 `npm run build` 输出到根路径；Serverless Functions 处理 `/api/grid-market` 与 `/api/grid-sync`。完整步骤见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)，包括 Vercel 免费项目额度、可选 Supabase 同步与环境变量。
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
