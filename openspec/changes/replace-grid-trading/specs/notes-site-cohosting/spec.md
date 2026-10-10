## MODIFIED Requirements

### Requirement: 复制 notes 站点不得影响主站
系统 SHALL 保证 `/note/` 子树的加入不改变主站其余行为：非 `/note/` 且未匹配静态文件的路径仍回退到主站入口页，未知 `/api/*` 仍返回 404 的 JSON，已有 `/api/*` 接口行为不变；主站旧的网格路径 `/grid-trading*` 跳转到 `/note/` 下对应的网格页面（见 `grid-trading-entry`）。

#### Scenario: 主站路由刷新
- **WHEN** 用户在 `/invest` 刷新浏览器
- **THEN** 系统返回主站入口页，并显示主站的正念投资页面

#### Scenario: 未知接口仍为 404
- **WHEN** 客户端请求 `/api/does-not-exist`
- **THEN** 响应状态码为 404，且响应体不是 HTML 页面

#### Scenario: 旧的网格路径跳转到 notes
- **WHEN** 用户访问主站的 `/grid-trading`
- **THEN** 系统跳转到 `/note/lab/grid-trading/`，显示 notes 的网格交易计算器
