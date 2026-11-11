## Context

线上有两个部署单元：

| 单元 | 内容 | 现在怎么发布 |
|---|---|---|
| Cloudflare Pages 项目 | 主站 + `/note/` 静态产物 + `/api/*`（Pages Functions），D1 `businessweb` | 推 `main` 自动构建（`npm run build:cloudflare`） |
| Worker `grid-trading-sync` | notes 三个工具的接口、定时任务，D1 `grid-trading-sync` | 手动 `wrangler deploy`，表结构手动应用 |

使用者的目标是"只部署一次"，不要求只剩一套代码；ETF 复盘仍在高频修改，前端不重写。

已有条件：

- `main` 上的 `.github/workflows/note-analysis-sync.yml` 已经在用仓库密钥 `CLOUDFLARE_API_TOKEN` 写线上 D1，账号 ID 写在工作流里。该密钥目前只有 D1 编辑权限。
- Worker 目录（`main`）有自己的 `tsconfig.json` 与测试（`index.test.ts`、`review-store.test.ts` 等），根目录的 vitest 配置已包含 `notes-site/workers/**/*.test.ts`。
- `schema.sql` 全部是 `CREATE TABLE IF NOT EXISTS`，重复执行不清空数据。
- Vercel 已停用并删除配置；GitHub Pages 的工作流只剩手动触发。不再与上游仓库同步。

## Goals / Non-Goals

**Goals:**

- 推 `main` 后，Worker 代码与 D1 表结构自动发布，不需要任何手动命令。
- 仓库只保留 Cloudflare 一条构建线，入口地址不再随环境变化。
- 部署失败能被看见，不会静默跳过。

**Non-Goals:**

- 不把整站并成一个 Worker。那样可以把两个单元合成一个，但站点地址会从 `*.pages.dev` 变成另一个地址，浏览器本地数据要再迁一次，`functions/` 的文件路由也要改写；留到接入自有域名时再做。
- 不合并两个 D1 数据库，不统一两个同步密钥。
- 不重写 notes 的页面，不移动 `notes-site/` 的目录位置。
- 不建立通用的"推送即跑全部测试"的 CI；只在 Worker 部署前跑 Worker 的测试。

## Decisions

### 1. 保留两个部署单元，用工作流把 Worker 接到同一次推送上

新增 `worker-deploy.yml`：`push` 到 `main` 且路径命中 `notes-site/workers/grid-trading-sync/**` 时运行，另加 `workflow_dispatch`。

备选一：整站迁到带静态资源的单个 Worker（Cloudflare 有官方迁移指南）。能真正合成一个单元，但代价见 Non-Goals。
备选二：用 Cloudflare 的 Workers Builds 让 Worker 自己连 Git。没有采用——表结构应用和测试没法放进同一个流程里，且凭据已经在 GitHub 这边。

### 2. 步骤顺序：测试 → 表结构 → 部署

1. 安装根目录与 `notes-site/` 的依赖（Worker 的 tsconfig 继承 Astro 的配置，需要后者）。
2. 只跑 Worker 目录的测试。
3. `wrangler d1 execute grid-trading-sync --remote --file=schema.sql`。
4. `wrangler deploy`。

表结构在部署之前：新代码可能读写新表，先有表再上代码；`IF NOT EXISTS` 保证对旧代码无影响。任一步失败即停止，后面的步骤不执行。

限制：`schema.sql` 只能表达"新建表"。改列、加索引这类变更它表达不了，仍需手动执行并在文档里说明。

### 3. 缺少凭据时失败，而不是告警后跳过

`note-analysis-sync.yml` 在没有密钥时只告警并正常结束。部署工作流不能这样：静默跳过等于回到"以为发了其实没发"。没有密钥或权限不足时任务直接失败。

### 4. wrangler 固定版本

把 `wrangler` 加进根目录 `devDependencies`，工作流用 `npx wrangler`，避免每次拉取最新版导致行为漂移。

### 5. 并发与顺序

`concurrency` 设为同一分组、不取消进行中的任务，保证两次连续推送按顺序发布。

Pages 与 Worker 是各自独立发布的，无法保证谁先完成。因此约定：**Worker 的接口改动必须向后兼容一个版本**（新增接口或字段，不在同一次提交里删除页面还在用的旧接口）。页面对接口失败已有"显示 —"的降级。

### 6. 入口地址改为常量

`src/data/notesLinks.ts` 里 `GRID_TRADING_PATH` 等改为以 `/note/` 开头的常量，删除 `NOTES_PATH`、`NOTES_ORIGIN` 及两个环境变量；`isNotesPath`、`isAbsoluteUrl` 保留（`SmartLink` 依赖它们决定整页加载）。`build-cloudflare.mjs` 不再传 `VITE_NOTES_PATH`，`vite.config.js` 去掉开发模式下的默认赋值，`/note/` 的开发代理保留。

notes 一侧：`MAIN_SITE` 的默认值由线上绝对地址改为 `/`，`astro.config.mjs` 固定 `base: '/note'`，`site` 取 `SITE_URL`，其次 `CF_PAGES_URL`。

本地联调方式不变：先 `npm run dev:notes`，再 `npm run dev`。

### 7. 两个"已迁移"页面只保留兜底跳转

`GridMoved`、`StockToolsMoved` 删除说明页分支，只做 `window.location.replace`。它们仍有存在的理由：`_redirects` 是服务端跳转，本地开发服务器和个别边缘情况下前端路由会直接接到旧路径。

### 8. 删除 `VITE_MARKET_DIRECT`

这个开关只在 GitHub Pages（没有后端接口）时让热力图由浏览器直连行情源。删除 Pages 构建线后它恒为假，`heatmapQuotes.ts` 的分支随之删除。`VITE_BASE_PATH` 是 Vite 通用的基路径设置，保留。

### 9. 与 `prune-site-sections` 的关系

两个变更互不依赖，建议先做 `prune-site-sections`。`grid-trading-entry` 第一条需求的文字里举例提到"AI 实验室列表"，由本变更改写该需求时去掉，`prune-site-sections` 不改这一条，避免两个变更改同一条需求。

## Risks / Trade-offs

- [密钥权限不够，首次运行失败] → 任务里把"给密钥加 Workers 脚本编辑权限"列为使用者的前置步骤，并先用 `workflow_dispatch` 手动跑一次验证。
- [表结构步骤对线上 D1 执行了意料之外的语句] → 工作流只执行仓库里的 `schema.sql`；任务里要求实施前通读该文件，确认只有 `CREATE TABLE IF NOT EXISTS` 与 `CREATE INDEX IF NOT EXISTS` 一类幂等语句。
- [Pages 先于 Worker 上线，新页面调到旧接口] → 决策 5 的向后兼容约定，写入 `docs/notes-cohosting.md`。
- [有人仍用不带 notes 的 `npm run build` 产物发布，`/note/` 入口 404] → README 与 `docs/cloudflare-pages.md` 写明发布只用 `build:cloudflare`；Cloudflare 后台的构建命令已是它。
- [删除 Pages 构建线后失去一个不依赖 Cloudflare 的备用站点] → 接受。旧的 GitHub Pages 站点本来就没有后端接口，且已停用。

## Migration Plan

1. 使用者在 Cloudflare 后台更新 API 令牌权限（D1 编辑 + Workers 脚本编辑），仓库密钥名不变。
2. 合并工作流后，先手动触发一次，确认测试、表结构、部署三步都成功，线上 `/note/lab/etf-review/` 与网格页面正常。
3. 合并其余清理项，推 `main`，确认 Cloudflare Pages 构建成功。
4. 回退：工作流出问题时在 GitHub 上停用它，恢复手动 `wrangler deploy`；清理项用 `git revert`。Worker 的上一版可用 `wrangler rollback` 恢复。

## Open Questions

- 当前仓库密钥对应的 Cloudflare 令牌具体有哪些权限，只有使用者能在后台确认。
- Worker 的定时任务在重新部署后是否有短暂空窗，需要在第一次自动部署后观察一个交易日。
