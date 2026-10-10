## Why

主站有一套自己的 React 网格交易（计算器、记录、记录详情），notes 站点里还有另一套带后端的网格交易，两套已经分叉：notes 的计算规则更新（规则版本 5：反弹买入、回落卖出要求跌破步长线后从极值反弹才成交），数据来源是自己的 Worker 与 D1（定时抓取分钟线、日线、前复权偏移），而主站的实现更旧，云同步依赖使用者从未启用过的 Supabase。使用者的决定是网格交易"以 notes 为准"，只保留一套实现，所以要用 notes 的网格交易计算器替换主站原来的。

notes 仓库在合并之后又有了 4 个新提交（规则 v5、删除成交的二次确认、新的"股市分析 lab"、板块日数据定时入库），`notes-site` 里的副本已经落后。"以 notes 为准"意味着要先把最新版同步过来，再做替换，否则替换成的是一个已过时的版本。

## What Changes

**第 1 部分：把 notes 最新版同步进 `notes-site`**
- 对 notes 仓库的 `902f04b..35f3747`（排除 `openspec/`）生成补丁，应用到 `notes-site/`，涉及 27 个文件：网格计算库与三个网格页面、Vue 3 写成的"股市分析 lab"（`/lab/stock`）、`@astrojs/vue` 集成与新依赖、Worker 源码与 D1 表结构。
- `astro.config.mjs` 与此前加的 Cloudflare 分支（`CF_PAGES`、`SITE_URL`）会冲突，手工合并并保留两边。
- 把 notes 的 `rebound-pullback-trigger` 变更（4 组任务已全部完成）迁入 BusinessWeb 的 `openspec/` 并归档，其增量规格 `grid-trigger-rules` 同步为主规格。
- 更新迁移文档，写明来源提交号与新增的 Vue 依赖。

**第 2 部分：替换主站网格交易**
- 站内入口（`siteMap`、`aiLab`）改指向 `/note/lab/grid-trading/`，使用普通链接而不是前端路由的 `Link`。
- 旧路径 `/grid-trading`、`/grid-trading/records`、`/grid-trading/records/:id` 跳转到 notes 对应页面（计算器、已保存标的、详情页 `?id=`）。Cloudflare 用 `public/_redirects` 做 302 临时跳转；其他构建线（Vercel、GitHub Pages）没有 `/note/`，保留一个很小的"已迁移"路由组件，避免出现 404。
- 删除主站自己的网格实现：3 个页面、`src/features/grid-trading/`、对应测试、`seo` 条目。
- 删除 Supabase 网格同步：`api/grid-sync.ts`、`functions/api/grid-sync.js`、迁移脚本 `202610020001_grid_sync.sql`、检查脚本与环境变量示例里的相关项、相关文档；保活工作流改为读取 `pulse-sync`。
- **保留** `api/grid-market`（热力图仍在使用）以及 Pulse 与候选池的 Supabase 同步（`pulse-sync`、`candidates-sync`）。
- 修改两条已有规格：`workers-api-runtime` 的同步接口鉴权需求不再包含 `grid-sync`；`notes-site-cohosting` 中"主站网格交易页面保持不变"的场景改为旧路径跳转。
- 不包含：用 React 重写 notes 的网格页；用 notes 的"股市分析 lab"替换主站的板块轮动、涨停分析与 `api/cls-plate`（功能重叠，留给后续单独的变更）；笔记、报告、行业 ETF 内容整合；Worker 自动部署；为 notes 补测试。

## Capabilities

### New Capabilities
- `grid-trading-entry`: 主站的网格交易入口指向 notes 的网格交易计算器；旧路径按映射跳转；其他构建线显示迁移说明；主站不再包含自己的网格实现与 Supabase 网格同步；`notes-site` 的网格以 notes 最新版为准。

### Modified Capabilities
- `workers-api-runtime`: 需求"同步接口的 token 鉴权保持不变"不再覆盖 `grid-sync`，只覆盖 `pulse-sync` 与 `candidates-sync`。
- `notes-site-cohosting`: 需求"复制 notes 站点不得影响主站"里关于主站网格页面与路由刷新的场景，随网格迁移而改变。

## Impact

- 代码：删除约 3100 行（含测试）的主站网格实现；`notes-site/` 新增约 8700 行（其中 Vue 组件约 5000 行）；`App.tsx`、`seo.ts`、`siteMap.ts`、`aiLab.ts` 小改；新增 `GridMoved` 组件与 `public/_redirects`。
- 依赖：`notes-site` 新增 `vue`、`@astrojs/vue`；构建时间与 `dist/note` 体积会增加。主站根目录的依赖不变。
- 接口：删除 `/api/grid-sync`；其余接口不变。
- 数据与外部系统：**Worker `grid-trading-sync` 与 D1 需要使用者自行更新**——应用 `schema.sql` 新增的 `cls_plate_day` 表并重新部署 Worker，否则新页面会调用不存在的接口；这一点无法从外部验证（Worker 对未授权请求统一返回 401）。主站浏览器里旧的网格记录已确认无价值，不迁移；notes 的记录在 D1 中，不受影响。
- 工作流：`cloud-keepalive.yml` 的读取目标改为 `pulse-sync`（该工作流在 GitHub 上从未运行过）。
- 风险：规则 v5 会改变网格的计算结果；Vue 与 Astro 的构建集成可能带来新的构建问题；notes 没有测试，同步后只能靠构建、链接检查与浏览器实测验证；主站目前还有约 53 个未推送的提交（含使用者合并的上游提交），本变更的推送需等使用者确认。
