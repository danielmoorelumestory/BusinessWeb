# notes 站点同域托管

notes（Astro 站点）已复制到本仓库的 `notes-site/`；其中的笔记、报告与行业 ETF 清单已并入主站（见下文"内容迁入主站"），`/note/` 现在只提供网格交易计算器与股市分析两个实验页，Cloudflare 构建时把它的静态产物放进 `dist/note/`，所以它与主站在同一个域名下：

- 主站：`https://businessweb-c0u.pages.dev/`
- notes：`https://businessweb-c0u.pages.dev/note/`

这是"把 notes 逐步并入 BusinessWeb"的第一阶段：**原样托管，不改 notes 的任何页面代码**。设计与取舍见 `openspec/changes/cohost-notes-site/`（归档后在 `openspec/changes/archive/`）。

## 目录结构

```
notes-site/                      notes 的完整源码（来源：notes 仓库 main 的 35f3747；最初复制自 902f04b，见下方"同步记录"）
├── src/ public/ docs/           页面、静态资源与说明
├── astro.config.mjs             base 固定为 /note，只有 Cloudflare 一条构建线
├── workers/grid-trading-sync/   网格后端 Worker 的源码（推送 main 自动部署，见下）
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

1. `npm run build`（主站；网格交易、ETF 复盘、股市分析的入口固定指向站内的 `/note/`）
2. 在 `notes-site/` 内 `npm ci` 并构建
3. 把 `notes-site/dist/` 复制为 `dist/note/`（先清掉旧的 `dist/note/`，不动 `dist` 里的其他文件）
4. 检查 `dist/note/` 下所有以 `/note/` 开头的内部链接与资源是否存在

任一步失败都会以非零状态退出。**构建失败时 Cloudflare 会保留上一个正常的部署**，线上站点不会被半成品替换。

发布只用 `npm run build:cloudflare`。单独的 `npm run build` 只构建主站、不含 `/note/`，仅用于本地检查主站本身。

## Cloudflare 配置

| 项目 | 值 |
|---|---|
| 构建命令 | `npm run build:cloudflare` |
| `NODE_VERSION`（构建变量） | `24`（保持不变） |
| `SITE_URL`（构建变量，建议设置） | `https://businessweb-c0u.pages.dev`，用于 notes 页面的规范链接。不设置时会使用每次部署各不相同的临时地址 |

修改构建变量后需要 **Retry deployment** 才会生效。

## 本地调试

```bash
npm run build:cloudflare
npx wrangler pages dev dist --compatibility-date=2026-10-07 --compatibility-flag=nodejs_compat
# 打开 http://localhost:8788/note/
```

本地联调主站和 notes（入口留在 `localhost:5173` 同域，和线上一样）：开两个终端，先 `npm run dev:notes`（构建并预览 notes-site，端口 4322），再 `npm run dev`；开发服务器把 `/note/` 代理到 4322。改了 notes 代码需重跑 `dev:notes`。

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

## 网格后端（Worker）自动发布

notes 的三个工具依赖独立的 Cloudflare Worker `grid-trading-sync`（D1 数据库 `grid-trading-sync` + 交易日的定时抓取）。它不属于 Pages，但同样是推送 `main` 就发布：

- **触发**：`notes-site/workers/grid-trading-sync/` 下有改动推到 `main`，或在 GitHub Actions 页面手动运行 `Deploy grid-trading-sync Worker`（`.github/workflows/worker-deploy.yml`）。
- **步骤**：安装依赖 → 只跑 Worker 目录的测试 → 对线上 D1 应用 `schema.sql` → `wrangler deploy`。任一步失败就停止，线上保持上一个版本。
- **凭证**：仓库密钥 `CLOUDFLARE_API_TOKEN`，令牌需要「D1：编辑」与「Workers 脚本：编辑」两项权限（与 `note-analysis-sync.yml` 共用同一个密钥）。缺密钥时工作流失败并说明原因。Worker 自己的密钥（如 `GITHUB_DISPATCH_TOKEN`）存放在 Cloudflare，部署不会清掉它们。
- **wrangler 版本**：固定在根目录 `package.json` 的 `devDependencies` 里，升级时改那里。

两条限制：

1. **改列需手动**。`schema.sql` 只含 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`，重复执行不会动已有数据，所以自动发布只能**新增**表和索引。给已有表加列、改列、删列不会生效，需要手动执行一次性语句（`npx wrangler d1 execute grid-trading-sync --remote --command "ALTER TABLE …"`），并先于依赖该列的 Worker 代码完成。不要往 `schema.sql` 里写 `DROP`、`ALTER`、`DELETE` 之类不可重复执行的语句。
2. **接口向后兼容一个版本**。站点（Pages）与 Worker 分别构建，上线时间差在几分钟内，且浏览器里可能还开着旧页面。改 Worker 接口时先保留旧的请求与响应格式，等新页面上线稳定后的下一次改动再删。

回退：

```bash
cd notes-site/workers/grid-trading-sync
npx wrangler deployments list     # 找到上一个正常的版本
npx wrangler rollback             # 回到上一个版本（或指定版本 ID）
```

回退只换 Worker 代码，不动 D1 里的数据。之后记得把 `main` 上的问题提交修掉或还原，否则下一次推送又会把它部署上去。

其他事实：

- 前端直接访问 `https://grid-trading-sync.danielmoore-b0c.workers.dev`（写在 notes 的前端代码里）。`/cls`、`/stock/*` 等接口只接受白名单来源（`clsOriginAllowed`），已包含 `businessweb-c0u.pages.dev`。
- 定时任务必须留在独立 Worker：Cloudflare 文档中没有提到 Pages Functions 支持定时触发。cron 时间写在 `wrangler.jsonc`。

## 旧站点

- 旧的 GitHub Pages 站点 `https://danielmoorelumestory.github.io/note/` 属于独立的 notes 仓库，本仓库不再与它同步，也不再有 GitHub Pages 或 Vercel 的构建线。
- RSS 不再提供：`/note/rss.xml` 302 到主站 `/notes`。

## 回退

站点：在 Cloudflare Pages 后台的 Deployments 里对上一个正常的部署点 **Rollback**。Worker：见上文 `wrangler rollback`。

## 已知限制与后续

- notes 没有任何测试文件。本阶段是原样托管，不放大这个问题；后续重写网格页面时需要先补测试，才能证明重写没有改变计算结果。
- 两套前端技术栈（React 与 Astro + Tailwind）并存，视觉不统一。后续按价值逐块重写为 React，重写完一块就把对应的 `/note` 页面下线。
- 主站自带的 `/grid-trading` 页面本阶段保持不变；以 notes 为准替换它们属于后续变更。

## 内容迁入主站（`migrate-notes-content`）

notes 的内容已并入主站，外观与导航统一；`notes-site/` 里对应的页面已删除。

| 原 notes 地址 | 现在 |
|---|---|
| `/note/`、`/note/notes`、`/note/rss.xml`、`/note/lab/text-count` | 302 到主站 `/notes` |
| `/note/notes/<id>`（3 篇行业笔记） | 302 到 `/notes/<id>`，id 不变 |
| `/note/notes/how-to-write`、`/note/notes/how-to-add-a-page`（写作指南，已删除） | 302 到 `/notes` |
| `/note/reports/ETF网格交易总方案-20260923.html` | 302 到 `/research/etf-grid-master-plan-2026-09-23.html` |
| `/note/reports/2027核心主线前瞻_六张网与候选主题_20260927.html` | 302 到 `/research/core-themes-2027-2026-09-27.html` |
| notes 的行业 ETF 清单（原在笔记页的"行业专栏"） | 主站 `/industry-etf` |

- 新增笔记：在 `public/notes/` 放 Markdown（不含 front matter），并在 `src/data/notes.ts` 按日期倒序登记；`notes.test.ts` 会检查文件存在、slug 与日期。
- 两份报告原样迁入 `public/research/`，仍从 jsDelivr 加载 ECharts（外部脚本依赖，离线时图表不显示）。
- 精简后 `/note/` 只保留 `lab/grid-trading`、`lab/stock` 与 `lab` 索引；`build-cloudflare` 以 `lab/index.html` 判断产物是否完整，notes 页面里指回主站的链接前缀默认是站点根 `/`（同域托管），需要指向别处时可用环境变量 `MAIN_SITE` 覆盖。
- 开发服务器的代理键是 `^/note/`（不是 `/note`），否则会把主站的 `/notes` 也代理走。

## 笔记结论入库（`note-analysis-columns`）

「已保存标的」页的「短期判断」「中期判断」两列，数据来自云端 D1 的 `note_analysis` 表，由脚本从各标的分析笔记的「## 一、结论速览」表里提取：

- 取第一列以「短期」开头的行、以「中期（」开头的行的「最终判断」列；标的代码取文件名开头的 6 位数字，数据基准日取正文「数据基准：YYYY-MM-DD」；同一代码有多篇笔记时取基准日最新的一篇。
- **笔记推送到 `main` 后自动同步**：由 `.github/workflows/note-analysis-sync.yml` 写入线上 D1，需要仓库密钥 `CLOUDFLARE_API_TOKEN`（与 Worker 自动发布共用）；未配置时只预览。也可手动运行：`npm run sync:analysis` 先预览（不改数据库），确认后 `npm run sync:analysis -- --write` 写入（需要已登录 wrangler）。脚本幂等，重复运行只会覆盖，不会产生重复行；结构不符（缺短期或中期行）的笔记会被跳过并列出。
- Worker 的 `GET /analysis?codes=…`（需要同步密钥）读取这些数据；Worker 随 `main` 自动发布（见上文「网格后端（Worker）自动发布」）。页面读取失败或没有对应笔记时显示「—」，不影响其他功能。
