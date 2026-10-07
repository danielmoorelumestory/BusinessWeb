## Why

BusinessWeb 目前依赖 Vercel 托管前端和 `api/*` 无服务器函数，另有一份 GitHub Pages 降级构建。使用者主要在国外访问、主要自用，且不想自己运维服务器。Cloudflare（Pages + Workers）免运维、额度够个人使用，并且与后续要合并进来的 notes 项目（已在用 Worker + D1）属于同一平台，先迁过去可以为后续合并铺路。

## What Changes

- 第 1 步：把前端（Vite 构建产物 `dist/`）部署到 Cloudflare Pages，先使用 `*.pages.dev` 地址（自有域名后续再接入），保证 SPA 路由刷新可用。此阶段 `/api/*` 仍指向现有 Vercel 部署，不改后端。
- 第 2 步：把 `api/*` 逐个改写为 Cloudflare Workers，并让前端的 `/api/*` 切到 Workers。
  - 先迁 `china-stock`、`grid-market` 两个最简单的接口，验证写法与路由。
  - 再迁 Supabase 同步类（`grid-sync`、`pulse-sync`、`candidates-sync`）以及 `macro`、`sentiment`、`cls-plate`。
  - `knowledge` 接口是否迁移，取决于调研结果（见下）。
- 任务一为调研，先于任何改写：检查 `server/` 下实现是否使用 `fs` 等 Node 专有功能；`server/knowledge` 是否仅供本地使用；Workers 的 CPU 时间限制能否满足现有 `maxDuration: 30` 的函数（`macro`、`sentiment`）。
- 环境变量与密钥改为在 Cloudflare 配置，沿用服务端变量不加 `VITE_` 前缀的规则。
- 本提案不包含：合并 notes 项目的网格交易、分钟线、笔记；下线 Vercel 与 GitHub Pages；D1 与 Supabase 的取舍。

## Capabilities

### New Capabilities
- `cloudflare-pages-hosting`: 前端以静态站点形式部署到 Cloudflare Pages，包含构建配置、SPA 路由回退、自有域名，以及 `/api/*` 在过渡期指向 Vercel 的约定。
- `workers-api-runtime`: `api/*` 的各接口以 Cloudflare Workers 提供，保持现有请求/响应契约、鉴权方式与错误行为（未知 `/api/*` 返回 404 而不是页面 HTML），并从 Workers 的环境绑定读取密钥。

### Modified Capabilities
<!-- 本项目此前没有 openspec/specs，无已有能力需要修改。 -->

## Impact

- 代码：`api/*`（10 个文件，约 490 行）改写；`server/*.mjs`、`server/sectorHistory.js` 中被 `api/` 引用的逻辑可能需要适配；`vercel.json` 的路由与函数配置需要在 Cloudflare 侧有等价物。
- 新增配置：`wrangler` 配置文件、Pages 构建设置、Workers 环境变量（`SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`GRID_SYNC_TOKEN`、`PULSE_SYNC_TOKEN`、`KNOWLEDGE_*` 等）。
- 工作流：现有 `.github/workflows/pages.yml`、`macro-snapshot.yml`、`cloud-keepalive.yml` 在本阶段保持不变。
- 外部系统：Cloudflare 账号与域名；Supabase 保持不变。
- 风险：Workers 并非完整 Node 运行时，`node:crypto` 需开启 `nodejs_compat` 或改用 Web Crypto；新浪、腾讯行情接口从 Cloudflare 节点访问的稳定性需要实测。
- 不影响：知识库与估值工作台中依赖本地文件和本地 CLI 的部分，它们本来就不上公网。
