## MODIFIED Requirements

### Requirement: 主站的网格交易入口指向 notes 的网格交易计算器
系统 SHALL 使主站内所有网格交易入口（投资页、站点地图等）固定指向站内的 notes 网格交易计算器 `/note/lab/grid-trading/`，并 MUST 使用触发整页加载的普通链接，而不是前端路由的 `Link`。入口地址 MUST NOT 随构建环境变化，MUST NOT 依赖环境变量。

#### Scenario: 从站内入口进入计算器
- **WHEN** 用户在主站点击"网格交易"入口
- **THEN** 浏览器整页加载 `/note/lab/grid-trading/`，显示 notes 的网格交易计算器，而不是"这一页不存在"

#### Scenario: 入口地址不随环境变化
- **WHEN** 在未设置任何 `VITE_NOTES_*` 环境变量的情况下运行 `npm run build` 或 `npm run build:cloudflare`
- **THEN** 产物中网格交易入口的地址都是 `/note/lab/grid-trading/`，不包含 `https://businessweb-c0u.pages.dev`

## REMOVED Requirements

### Requirement: 没有 notes 的构建线显示迁移说明而不是 404
**Reason**: Vercel 与 GitHub Pages 两条构建线已删除，只保留 Cloudflare 构建，不再存在"没有 `/note/` 的构建"。
**Migration**: 旧的网格路径由 Cloudflare 的 `_redirects` 跳转，前端兜底见新增需求"旧的网格路径在前端兜底跳转"。

## ADDED Requirements

### Requirement: 旧的网格路径在前端兜底跳转
系统 SHALL 在前端路由接到旧的网格路径（服务端跳转未生效时）时，用 `window.location.replace` 跳到 `/note/` 下对应的页面，并保留记录 id；MUST NOT 显示"已迁移"说明页。

#### Scenario: 前端接到旧的记录详情路径
- **WHEN** 前端路由接到 `/grid-trading/records/abc123`
- **THEN** 前端用 `window.location.replace` 跳到 `/note/lab/grid-trading/detail/?id=abc123`

#### Scenario: 前端接到旧的计算器路径
- **WHEN** 前端路由接到 `/grid-trading`
- **THEN** 前端跳到 `/note/lab/grid-trading/`，跳转前只显示"正在跳转"的提示
