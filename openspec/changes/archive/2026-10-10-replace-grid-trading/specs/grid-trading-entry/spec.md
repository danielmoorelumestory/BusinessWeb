## ADDED Requirements

### Requirement: 主站的网格交易入口指向 notes 的网格交易计算器
系统 SHALL 使主站内所有网格交易入口（站点地图、AI 实验室列表等）指向 notes 的网格交易计算器 `/note/lab/grid-trading/`，并 MUST 使用触发整页加载的普通链接，而不是前端路由的 `Link`。

#### Scenario: 从站内入口进入计算器
- **WHEN** 用户在 Cloudflare 构建的主站点击"网格交易"入口
- **THEN** 浏览器整页加载 `/note/lab/grid-trading/`，显示 notes 的网格交易计算器，而不是"这一页不存在"

#### Scenario: 没有 notes 的构建线上入口直接进入新页面
- **WHEN** 用户在 Vercel 或 GitHub Pages 构建的主站点击"网格交易"入口
- **THEN** 入口直接指向 `https://businessweb-c0u.pages.dev/note/lab/grid-trading/`，点击后整页跳转到那里，不经过中间页，也不是 404

### Requirement: 旧的网格路径跳转到 notes 的对应页面
系统 SHALL 把主站旧的网格路径跳转到 notes 的对应页面：`/grid-trading` 到 `/note/lab/grid-trading/`；`/grid-trading/records` 到 `/note/lab/grid-trading/saved/`；`/grid-trading/records/:id` 到 `/note/lab/grid-trading/detail/?id=:id`。Cloudflare 上 MUST 由静态托管层以 302 临时跳转完成，使用户无需先加载主站的前端应用。

#### Scenario: 旧计算器路径
- **WHEN** 客户端请求 `/grid-trading`
- **THEN** 响应为 302，目标为 `/note/lab/grid-trading/`

#### Scenario: 旧记录列表路径
- **WHEN** 客户端请求 `/grid-trading/records`
- **THEN** 响应为 302，目标为 `/note/lab/grid-trading/saved/`

#### Scenario: 旧记录详情路径保留记录 id
- **WHEN** 客户端请求 `/grid-trading/records/abc123`
- **THEN** 最终到达的页面是 `/note/lab/grid-trading/detail/?id=abc123`，记录 id 不丢失

### Requirement: 没有 notes 的构建线显示迁移说明而不是 404
系统 SHALL 在没有 `/note/` 的构建（Vercel、GitHub Pages）上，使旧的网格路径渲染"网格交易已迁移"的说明页，并给出指向 Cloudflare 站点上网格计算器的链接；在 Cloudflare 构建上，该路由 MUST 在前端兜底地跳转到对应的 `/note/` 页面。

#### Scenario: 其他构建线访问旧路径
- **WHEN** 用户在没有 `/note/` 的构建上访问 `/grid-trading`
- **THEN** 页面显示迁移说明与指向 `https://businessweb-c0u.pages.dev/note/lab/grid-trading/` 的链接，而不是"这一页不存在"

#### Scenario: Cloudflare 上服务端跳转不可用时的前端兜底
- **WHEN** 在 Cloudflare 构建里前端路由接到了 `/grid-trading/records/abc123`
- **THEN** 前端用 `window.location.replace` 跳到 `/note/lab/grid-trading/detail/?id=abc123`

### Requirement: 主站不再包含自己的网格实现与网格云同步
系统 SHALL 不再包含主站自己的网格交易页面、模拟与回测代码，以及 Supabase 网格同步接口 `/api/grid-sync`；系统 MUST 继续提供 `/api/grid-market`、`pulse-sync` 与 `candidates-sync`。

#### Scenario: 网格同步接口已移除
- **WHEN** 客户端请求 `/api/grid-sync`
- **THEN** 响应状态码为 404，且响应体是 JSON 而不是页面 HTML

#### Scenario: 行情代理与其他同步不受影响
- **WHEN** 客户端请求 `/api/grid-market?kind=quotes&symbols=sh510300`，或请求 `pulse-sync`、`candidates-sync`
- **THEN** 它们的行为与替换前一致

#### Scenario: 没有悬空引用
- **WHEN** 对主站源码、脚本、工作流、环境变量示例与文档搜索 `features/grid-trading`、`grid-sync`、`GRID_SYNC_TOKEN`
- **THEN** 除历史计划文档与已归档的变更外没有引用，类型检查与三种构建都通过

### Requirement: notes-site 的网格交易以 notes 最新版为准
系统 SHALL 使 `notes-site/` 的网格交易源码与 notes 仓库的最新提交一致（计算规则版本 5：跌破步长线后从极值反弹才成交），并包含同一提交带来的"股市分析 lab"与 Worker 源码；Cloudflare 构建产物 MUST 包含 `/note/lab/grid-trading/`、`saved`、`detail`、`minute` 与 `/note/lab/stock/`，并通过 notes 内部链接检查。

#### Scenario: 规则版本
- **WHEN** 读取 `notes-site/src/lib/grid-trading.ts` 中的计算规则版本
- **THEN** 其值为 5

#### Scenario: 构建产物包含全部页面
- **WHEN** 运行 `npm run build:cloudflare`
- **THEN** `dist/note/lab/grid-trading/`、`saved/`、`detail/`、`minute/` 与 `dist/note/lab/stock/` 都存在，链接检查通过

#### Scenario: 计算器可以回测
- **WHEN** 用户在浏览器打开 `/note/lab/grid-trading/` 并获取默认示例的历史行情
- **THEN** 页面能完成回测并显示结果
