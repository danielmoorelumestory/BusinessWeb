## ADDED Requirements

### Requirement: 主站提供行业研究笔记的列表与详情
系统 SHALL 在主站提供 `/notes` 笔记列表与 `/notes/:slug` 笔记详情：列表按日期倒序显示全部已发布笔记的标题、日期、摘要与标签，并支持按标签筛选；详情页渲染笔记的 Markdown 正文，不存在的 slug MUST 显示"这一页不存在"而不是空白页。

#### Scenario: 打开笔记列表
- **WHEN** 用户访问 `/notes`
- **THEN** 页面按日期倒序列出 3 篇笔记，每篇显示标题、日期、摘要与标签

#### Scenario: 按标签筛选
- **WHEN** 用户在列表中点击标签"行业研究"
- **THEN** 列表只显示带该标签的笔记，并可清除筛选回到全部

#### Scenario: 打开笔记详情
- **WHEN** 用户访问 `/notes/robotics-industry-research`
- **THEN** 页面显示该笔记的标题、日期、标签与渲染后的正文

#### Scenario: 笔记不存在
- **WHEN** 用户访问 `/notes/does-not-exist`
- **THEN** 页面显示"这一页不存在"，且不发出对不存在文件的无限重试

### Requirement: 带完整报告的笔记提供报告入口
系统 SHALL 在笔记带有完整报告（独立 HTML）时，于详情页顶部显示"打开完整报告"链接，指向主站 `public/research/` 下对应的静态报告；报告 MUST 与主站其他静态研究报告一样不加载网络字体、不使用衬线字体。

#### Scenario: 从笔记打开完整报告
- **WHEN** 用户在"ETF网格交易总方案"笔记详情页点击"打开完整报告"
- **THEN** 浏览器打开主站 `/research/` 下该报告的 HTML，页面完整显示

#### Scenario: 报告遵守品牌约束
- **WHEN** 检查迁入的 HTML 报告
- **THEN** 其中没有 `fonts.googleapis.com`、`fonts.gstatic.com`，也没有衬线字体名

### Requirement: 主站提供行业 ETF 清单
系统 SHALL 在 `/industry-etf` 提供行业 ETF 清单：7 个行业组共 59 只 ETF，每只显示代码、名称、市场、子主题与备注，有参考链接的 MUST 提供链接；页面 MUST 显示总数与各组数量，并提示仅作研究参考、不构成投资建议。

#### Scenario: 浏览行业 ETF 清单
- **WHEN** 用户访问 `/industry-etf`
- **THEN** 页面显示 7 个行业组与 59 只 ETF，总数与各组数量与数据一致

#### Scenario: 参考链接
- **WHEN** 某只 ETF 有参考链接
- **THEN** 页面用新标签页链接并带 `rel="noopener noreferrer"`

### Requirement: 主站入口与导航指向主站自己的笔记
系统 SHALL 使 Header 的"笔记"入口在所有构建中指向主站 `/notes`，并在投资页"选标的"组提供"行业研究笔记"（`/notes`）与"行业 ETF 清单"（`/industry-etf`）两个入口；这些页面 MUST 被收入站点地图。

#### Scenario: Header 入口
- **WHEN** 用户在任一构建（含 GitHub Pages 与本地开发）点击 Header 的"笔记"
- **THEN** 进入主站 `/notes`，不整页跳到 `/note/`

#### Scenario: 站点地图收录
- **WHEN** 生成站点地图
- **THEN** 包含 `/notes`、`/industry-etf` 与每篇笔记的 `/notes/<slug>`

### Requirement: notes 的旧地址跳转到主站对应页面
系统 SHALL 在 Cloudflare 上用 302 把 notes 的旧地址跳转到主站对应页面：`/note/`、`/note/notes`、`/note/rss.xml`、`/note/lab/text-count` 到 `/notes`；`/note/notes/<id>` 到 `/notes/<id>`（写作指南类已删除的笔记到 `/notes`）；`/note/reports/<旧文件名>` 到迁入后的新报告地址。

#### Scenario: 旧笔记详情
- **WHEN** 客户端请求 `/note/notes/swine-poultry-research`
- **THEN** 响应为 302，目标为 `/notes/swine-poultry-research`

#### Scenario: 旧报告地址
- **WHEN** 客户端请求 `/note/reports/ETF网格交易总方案-20260923.html`
- **THEN** 响应为 302，目标为迁入后的新报告地址

#### Scenario: 旧首页与 RSS
- **WHEN** 客户端请求 `/note/` 或 `/note/rss.xml`
- **THEN** 响应为 302，目标为 `/notes`
