## MODIFIED Requirements

### Requirement: 主站的板块轮动与涨停分析入口指向 notes 的股市分析 lab
系统 SHALL 使主站内所有板块轮动、涨停分析的入口（投资页"观察盘"分组等）固定指向站内 notes 的股市分析 lab `/note/lab/stock/` 的对应工具——大涨股解读 `#stock-analysis`、板块轮动 `#sector-rotation`、板块排行 `#plate-ranking`，并 MUST 使用触发整页加载的普通链接。入口地址 MUST NOT 随构建环境变化。

#### Scenario: 从投资页进入板块工具
- **WHEN** 用户在主站投资页点击"板块轮动"
- **THEN** 浏览器整页加载 `/note/lab/stock/#sector-rotation` 并直接显示板块轮动，而不是 lab 首页

#### Scenario: 入口地址不随环境变化
- **WHEN** 在未设置任何 `VITE_NOTES_*` 环境变量的情况下构建主站
- **THEN** 产物中这些入口的地址都以 `/note/lab/stock/` 开头，不包含 `https://businessweb-c0u.pages.dev`

### Requirement: 旧的板块轮动与涨停分析路径跳转到 lab 的对应工具
系统 SHALL 把旧路径 `/sector-rotation` 跳转到 `/note/lab/stock/#sector-rotation`，`/limit-up-analysis` 跳转到 `/note/lab/stock/#stock-analysis`。Cloudflare 上 MUST 由静态托管层以 302 临时跳转完成；前端 MUST 对这两个路径提供兜底，用 `window.location.replace` 跳转，MUST NOT 显示"已迁移"说明页。

#### Scenario: 旧板块轮动路径
- **WHEN** 客户端请求 `/sector-rotation`
- **THEN** 响应为 302，目标为 `/note/lab/stock/#sector-rotation`

#### Scenario: 旧涨停分析路径
- **WHEN** 客户端请求 `/limit-up-analysis`
- **THEN** 响应为 302，目标为 `/note/lab/stock/#stock-analysis`

#### Scenario: 前端接到旧路径
- **WHEN** 服务端跳转未生效，前端路由接到 `/limit-up-analysis`
- **THEN** 前端用 `window.location.replace` 跳到 `/note/lab/stock/#stock-analysis`，跳转前只显示"正在跳转"的提示
