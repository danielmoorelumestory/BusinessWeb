## MODIFIED Requirements

### Requirement: notes 站点在 `/note/` 路径下与主站同域托管
系统 SHALL 在 Cloudflare 构建产物的 `dist/note/` 目录下提供 notes 站点保留的静态页面——网格交易 lab、股市分析 lab 与 lab 索引——使其可通过主站域名的 `/note/...` 路径访问；notes 的首页、笔记列表与详情、RSS 与独立报告已迁入主站（见 `industry-notes`），MUST NOT 再由 `/note/` 提供。

#### Scenario: 访问 notes 的功能页面
- **WHEN** 用户访问 `/note/lab/grid-trading`、`/note/lab/grid-trading/saved`、`/note/lab/grid-trading/minute`、`/note/lab/stock/` 或 `/note/lab/`
- **THEN** 系统返回对应的 notes 页面，而不是主站的"这一页不存在"页面

#### Scenario: 已迁移的页面跳转到主站
- **WHEN** 用户访问 `/note/`、`/note/notes` 或 `/note/rss.xml`
- **THEN** 系统 302 跳转到主站 `/notes`，而不是 404

#### Scenario: 站点地址随部署环境变化
- **WHEN** 在 Cloudflare Pages 环境中构建 notes
- **THEN** notes 页面的规范链接使用当前站点自己的地址，而不是 GitHub Pages 的地址

### Requirement: 主站提供进入 notes 的导航入口
系统 SHALL 在主站 Header 中提供"笔记"入口，指向主站自己的 `/notes`；notes 站点保留的网格交易与股市分析 lab 由投资页的入口通过触发整页加载的普通链接进入（见 `grid-trading-entry`、`stock-tools-entry`）。

#### Scenario: 从主站进入笔记
- **WHEN** 用户在主站点击 Header 中的"笔记"
- **THEN** 进入主站 `/notes`，由前端路由处理，不整页跳到 `/note/`

#### Scenario: notes 页面回到主站
- **WHEN** 用户在 notes 的 lab 页面点击页头的主站入口
- **THEN** 浏览器整页回到主站对应页面
