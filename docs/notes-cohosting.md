# notes 站点同域托管

notes（Astro 站点：笔记、行业专栏、网格交易计算器）已整体复制到本仓库的 `notes-site/`，Cloudflare 构建时把它的静态产物放进 `dist/note/`，所以它与主站在同一个域名下：

- 主站：`https://businessweb-c0u.pages.dev/`
- notes：`https://businessweb-c0u.pages.dev/note/`（路径与旧站 `https://danielmoorelumestory.github.io/note/` 一致）

这是"把 notes 逐步并入 BusinessWeb"的第一阶段：**原样托管，不改 notes 的任何页面代码**。设计与取舍见 `openspec/changes/cohost-notes-site/`（归档后在 `openspec/changes/archive/`）。

## 目录结构

```
notes-site/                      notes 的完整源码（来源：notes 仓库 main 的 35f3747；最初复制自 902f04b，见下方"同步记录"）
├── src/ public/ docs/           页面、静态资源与说明
├── astro.config.mjs             增加了 Cloudflare 分支（见下）
├── workers/grid-trading-sync/   网格后端 Worker 的源码（仍手动部署，见下）
└── package.json                 独立的依赖，与根目录互不影响
scripts/build-cloudflare.mjs     Cloudflare 构建脚本
scripts/check-note-links.mjs     notes 内部链接检查
```

`notes-site/` 不包含 notes 仓库的 `.git`、`.github` 和 `openspec`。notes 的 7 个主规格与 4 个归档变更已迁入根目录的 `openspec/`。

## 构建

```bash
npm run build:cloudflare
```

依次执行：

1. `npm run build`（主站，设置 `VITE_NOTES_PATH=/note/`，让 Header 出现"笔记"入口）
2. 在 `notes-site/` 内 `npm ci` 并构建
3. 把 `notes-site/dist/` 复制为 `dist/note/`（先清掉旧的 `dist/note/`，不动 `dist` 里的其他文件）
4. 检查 `dist/note/` 下所有以 `/note/` 开头的内部链接与资源是否存在

任一步失败都会以非零状态退出。**构建失败时 Cloudflare 会保留上一个正常的部署**，线上站点不会被半成品替换。

普通的 `npm run build`、`npm run build:pages`（GitHub Pages）和 Vercel 构建**不受影响**：它们不构建 notes，主站 Header 也不会出现"笔记"入口（那些环境没有 `/note/`）。

## Cloudflare 配置

| 项目 | 值 |
|---|---|
| 构建命令 | `npm run build:cloudflare` |
| `NODE_VERSION`（构建变量） | `24`（保持不变） |
| `SITE_URL`（构建变量，建议设置） | `https://businessweb-c0u.pages.dev`，用于 notes 的 RSS 链接。不设置时会使用每次部署各不相同的临时地址 |

修改构建变量后需要 **Retry deployment** 才会生效。

## 本地调试

```bash
npm run build:cloudflare
npx wrangler pages dev dist --compatibility-date=2026-10-07 --compatibility-flag=nodejs_compat
# 打开 http://localhost:8788/note/
```

本地联调主站和 notes（入口留在 `localhost:5173` 同域，和线上一样）：开两个终端，先 `npm run dev:notes`（构建并预览 notes-site，端口 4322），再 `npm run dev`；开发服务器把 `/note/` 代理到 4322，并默认设置 `VITE_NOTES_PATH=/note/`。改了 notes 代码需重跑 `dev:notes`。

只调 notes：`cd notes-site && npm run dev`（Astro 开发服务器，地址 `http://localhost:4321/note/`）。

## 搬家前必读：浏览器里的本地数据按域名隔离

notes 的"已保存标的"和**同步密钥**存放在浏览器的 `localStorage`，而 `localStorage` 按域名隔离。从旧域名 `danielmoorelumestory.github.io` 迁到 `businessweb-c0u.pages.dev` 后，新域名下是空的，不会自动带过去。

已经同步到云端（D1）的记录不会丢，只要在新站点用同一个同步密钥再同步就能恢复；**只存在本地、从未同步过的记录会丢失**。

### 搬家前

1. 打开旧站点的"已保存标的"页：`https://danielmoorelumestory.github.io/note/lab/grid-trading/saved`
2. 填入同步密钥并点击同步，确认记录已上传（同步成功的提示）。如果页面提供导出，也导出一份备份。
3. **记下同步密钥**。它只存在旧域名的浏览器里，新域名需要重新填写。

### 搬家后

1. 打开新站点的"已保存标的"页：`https://businessweb-c0u.pages.dev/note/lab/grid-trading/saved`
2. 填入**同一个**同步密钥并同步，此前已同步的记录会出现。
3. 核对记录数量与旧站点一致。

### 以后接入自有域名时

`localStorage` 会再换一次，需要再做一遍"搬家前、搬家后"。已同步的数据不受影响。这也是尽早确定最终域名的一个理由。

## 同步记录

| 日期 | 来源提交 | 内容 |
|---|---|---|
| 2026-10-07 | `902f04b` | 一次性整体复制进 `notes-site/`（变更 `cohost-notes-site`） |
| 2026-10-10 | `35f3747` | 同步 notes 的 4 个新提交（变更 `replace-grid-trading`）：网格计算规则 v5（跌破步长线后从极值反弹才成交）、恢复删除成交的二次确认、新增"股市分析 lab"（`/note/lab/stock/`）、板块日数据收盘入库 |

同步方式是对 notes 仓库的 `902f04b..35f3747`（排除 `openspec/`）生成补丁，以 `notes-site/` 为根应用；除 `astro.config.mjs` 外与 notes `35f3747` 逐文件一致，`astro.config.mjs` 在 notes 的版本基础上保留了本仓库的 Cloudflare 分支。notes 的 `rebound-pullback-trigger` 变更已迁入 `openspec/changes/archive/2026-10-09-rebound-pullback-trigger/`，其规格 `grid-trigger-rules` 已成为主规格。

**新增的 Vue 依赖**：股市分析 lab 用 Vue 3 写成，`notes-site/package.json` 新增 `vue` 与 `@astrojs/vue`，`astro.config.mjs` 里启用了 `vue()` 集成。它们只在 `notes-site/` 内部，不影响主站根目录的依赖；`build:cloudflare` 每次会在 `notes-site/` 里 `npm ci`。

## 网格后端（Worker）仍手动部署

notes 的网格交易依赖独立的 Cloudflare Worker `grid-trading-sync`（D1 数据库 + 每个交易日 3 次的分钟线定时抓取）。**它不随 Pages 部署，同步 notes 最新版时只更新了它的源码，没有重新部署它。**

**同步到 `35f3747` 之后，Worker 与 D1 需要你自行更新**，否则新页面会调用不存在的接口：
1. **D1 新表**：应用 `notes-site/workers/grid-trading-sync/schema.sql`，其中新增了 `cls_plate_day` 表（财联社板块日数据，按交易日与是否只看涨停缓存）。`schema.sql` 全部使用 `CREATE TABLE IF NOT EXISTS`，重复执行不会清空已有数据。
2. **重新部署 Worker**：新版 Worker 增加了 `/cls`（财联社转发与缓存）、`/stock/plate`、`/stock/plates`、`/stock/plate/dates`、`/stock/sync` 接口，以及收盘 cron 把板块日数据写入 `cls_plate_day`。`wrangler.jsonc` 里的 cron 触发时间没有变化。
3. 网格计算器、已保存标的与分钟线主要使用原有接口；受影响最大的是新的"股市分析 lab"。

- 前端直接访问 `https://grid-trading-sync.danielmoore-b0c.workers.dev`（写在 notes 的前端代码里）。Worker 对所有来源开放跨域，所以新域名可以直接使用，已实测预检通过。
- Worker 源码现在位于 `notes-site/workers/grid-trading-sync/`。需要修改并重新部署时，进入该目录，使用 wrangler 部署（配置在其中的 `wrangler.jsonc`）。我没有核实你以前具体用哪条命令部署，请以你之前的做法为准。
- 定时任务必须留在独立 Worker：Cloudflare 文档中没有提到 Pages Functions 支持定时触发。

## 新旧站点的关系

- **旧的 GitHub Pages 站点保持不动**：`https://danielmoorelumestory.github.io/note/` 仍然可以访问，notes 仓库也没有被改动。
- RSS 的订阅地址随站点变化，新站点是一份新的订阅源；旧站点的订阅者不受影响。
- 迁移稳定后再决定旧站点的去留（例如在旧站放跳转或"已搬家"提示），不在本阶段。

## 回退

在 Cloudflare 后台把构建命令改回 `npm run build` 并重新部署：`/note/` 随之消失，主站不受影响，Header 的"笔记"入口也一并消失。旧的 GitHub Pages 站点一直可用。

## 已知限制与后续

- notes 没有任何测试文件。本阶段是原样托管，不放大这个问题；后续重写网格页面时需要先补测试，才能证明重写没有改变计算结果。
- 两套前端技术栈（React 与 Astro + Tailwind）并存，视觉不统一。后续按价值逐块重写为 React，重写完一块就把对应的 `/note` 页面下线。
- 主站自带的 `/grid-trading` 页面本阶段保持不变；以 notes 为准替换它们属于后续变更。
