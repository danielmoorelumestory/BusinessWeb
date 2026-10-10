## ADDED Requirements

### Requirement: 主站的板块轮动与涨停分析入口指向 notes 的股市分析 lab
系统 SHALL 使主站内所有板块轮动、涨停分析的入口（投资页"看行情"等）指向 notes 的股市分析 lab `/note/lab/stock/` 的对应工具——大涨股解读 `#stock-analysis`、板块轮动 `#sector-rotation`、板块排行 `#plate-ranking`，并 MUST 使用触发整页加载的普通链接。

#### Scenario: 从投资页进入板块工具
- **WHEN** 用户在主站 `/invest` 点击"板块轮动"
- **THEN** 浏览器整页加载 `/note/lab/stock/#sector-rotation` 并直接显示板块轮动，而不是 lab 首页

#### Scenario: 没有 notes 的构建
- **WHEN** 用户在没有 `/note/` 的构建（GitHub Pages）点击这些入口
- **THEN** 入口指向 `https://businessweb-c0u.pages.dev/note/lab/stock/` 的对应锚点，不是 404

### Requirement: 旧的板块轮动与涨停分析路径跳转到 lab 的对应工具
系统 SHALL 把旧路径 `/sector-rotation` 跳转到 `/note/lab/stock/#sector-rotation`，`/limit-up-analysis` 跳转到 `/note/lab/stock/#stock-analysis`。Cloudflare 上 MUST 由静态托管层以 302 临时跳转完成；前端 MUST 对这两个路径提供兜底：有 notes 的构建用 `window.location.replace` 跳转，没有 notes 的构建显示迁移说明与指向线上 lab 的链接。

#### Scenario: 旧板块轮动路径
- **WHEN** 客户端请求 `/sector-rotation`
- **THEN** 响应为 302，目标为 `/note/lab/stock/#sector-rotation`

#### Scenario: 旧涨停分析路径
- **WHEN** 客户端请求 `/limit-up-analysis`
- **THEN** 响应为 302，目标为 `/note/lab/stock/#stock-analysis`

#### Scenario: 没有 notes 的构建访问旧路径
- **WHEN** 用户在没有 `/note/` 的构建访问 `/limit-up-analysis`
- **THEN** 页面显示"已迁移"说明与指向 `https://businessweb-c0u.pages.dev/note/lab/stock/#stock-analysis` 的链接，而不是"这一页不存在"

### Requirement: 主站不再包含自己的板块工具实现与专用后端
系统 SHALL 不再包含主站自己的板块轮动、涨停分析页面与服务代码，也 MUST NOT 再提供 `/api/cls-plate` 与 Supabase 板块历史缓存；系统 MUST 继续提供 `/api/grid-market`、`pulse-sync`、`candidates-sync` 与 `comments`。

#### Scenario: 专用接口已移除
- **WHEN** 客户端请求 `/api/cls-plate?date=20260930&up_limit=0`
- **THEN** 响应状态码为 404，且响应体是 JSON 而不是页面 HTML

#### Scenario: 行情热力图不受影响
- **WHEN** 客户端请求 `/api/grid-market?kind=quotes&symbols=sh510300`
- **THEN** 接口照常返回行情，热力图正常显示

#### Scenario: 站点地图不再收录旧路径
- **WHEN** 生成站点地图
- **THEN** 不包含 `/sector-rotation` 与 `/limit-up-analysis`
