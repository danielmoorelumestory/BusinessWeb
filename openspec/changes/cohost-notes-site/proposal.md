## Why

用户有两个独立站点：BusinessWeb（React，已在 Cloudflare Pages）和 notes（Astro，在 GitHub Pages 的 `/note`，含笔记、行业专栏和一套带后端的网格交易）。目标是把 notes 逐步并入 BusinessWeb，其中重叠的业务功能以 notes 为准。直接重写 notes 的页面工作量大，且重写过程中容易悄悄改变网格计算结果。

本变更是"逐步合并"的第一阶段：先让 notes 的全部功能原样出现在 BusinessWeb 的同一个域名下，不改动 notes 的任何页面代码。完成后即得到一个随时可停的中间状态，后续重写哪一块、何时重写都成为可选项。

## What Changes

- 把 `/Users/train/Documents/notes` 的源码一次性整体复制进 BusinessWeb 的 `notes-site/`（含 `src/`、`public/`、`workers/grid-trading-sync/` 源码、配置与说明文档），此后只在 BusinessWeb 里维护，notes 仓库后续归档。
- 新增 Cloudflare 专用构建脚本：先构建 BusinessWeb，再构建 `notes-site`，再把 `notes-site/dist/` 复制到 `dist/note/`。线上地址为 `https://<站点>/note/...`，与现有 GitHub Pages 的 `/note` 路径一致。
- `notes-site/astro.config.mjs` 增加 Cloudflare Pages 分支：`base` 保持 `/note`，`site` 使用站点自己的地址（影响 RSS 与规范链接）。
- BusinessWeb 的 Header 增加指向 `/note/` 的入口，使用普通 `<a href>`，不使用 React Router 的 `Link`。
- 把 notes 的 7 个主规格和 4 个已归档变更搬入 BusinessWeb 的 `openspec/`，使规格与代码同处一个仓库。
- 网格后端不动：独立 Worker `grid-trading-sync` + D1 + 定时任务继续在 `workers.dev` 手动部署，notes 前端沿用跨域直连。
- 使用者需在 Cloudflare 后台把构建命令改为新脚本；GitHub Pages 的 `pages.yml` 构建线保持不变。
- 本变更不包含：把任何页面重写成 React；替换或删除 BusinessWeb 现有的网格交易页面（后续变更 `replace-grid-trading`）；笔记与行业 ETF 内容整合（更后续的 `migrate-notes-content`）；下线 GitHub Pages 旧站；把 Worker 纳入自动部署；为 notes 补测试。

## Capabilities

### New Capabilities
- `notes-site-cohosting`: notes 站点的静态产物在 BusinessWeb 的 `/note/` 路径下与主站同域托管，包括构建集成、路径与链接、主站导航入口、对主站路由与 `/api/*` 的非干扰，以及从旧域名迁移时的本地数据说明。

### Modified Capabilities
<!-- 无。`cloudflare-pages-hosting` 描述的 SPA 回退与 /api/* 行为本身不变，本变更只是在其之上新增一个静态子树。 -->

## Impact

- 代码：新增 `notes-site/`（约 0.7 MB 源码，不含 `node_modules`、`dist`、`.astro`）；新增构建脚本与 `package.json` 脚本；`Header` 组件增加一个入口；`notes-site/astro.config.mjs` 改一处环境分支。
- 规格：`openspec/specs/` 新增 notes 的 7 个主规格（`daily-bar-client`、`daily-bar-store`、`four-year-extremes`、`local-cache-eviction`、`minute-bar-health`、`minute-bar-sync`、`records-sync`），`openspec/changes/archive/` 新增 4 个归档变更。均为原样迁入，名称与现有的 `cloudflare-pages-hosting`、`workers-api-runtime` 不冲突。
- 构建：Cloudflare 构建需要对 `notes-site` 单独安装依赖（Astro 7、Tailwind 4），构建时间增加；Node 要求 notes ≥ 22.12，BusinessWeb 为 24.x，无冲突。
- 外部系统：Cloudflare Pages 的构建命令需要使用者修改；`grid-trading-sync` Worker 与 D1 不变，仍手动部署。
- 风险：localStorage 按域名隔离，notes 的"已保存标的"与同步密钥存放在旧域名 `danielmoorelumestory.github.io` 下，新域名初始为空（见设计）。
- 不影响：BusinessWeb 现有页面与 `/api/*`、GitHub Pages 构建线、Worker 与 D1 中已有数据。
