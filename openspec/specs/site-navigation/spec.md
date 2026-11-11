# site-navigation Specification

## Purpose
TBD - created by archiving change prune-site-sections. Update Purpose after archive.
## Requirements
### Requirement: 首页即投资页
系统 SHALL 在站点根路径 `/` 显示投资页（按「读这本书、定规则、观察盘、分析筛选、工具与参考」分组的入口卡片），MUST NOT 再提供独立的首页；`/invest` MUST 跳转到 `/`，投资页下的子路径（`/invest/etf`、`/invest/national-team`）保持原地址不变。

#### Scenario: 打开根路径
- **WHEN** 用户访问 `/`
- **THEN** 页面显示投资页的分组入口，标题为「投资」，不出现「三个栏目」与名句区块

#### Scenario: 旧的投资页地址
- **WHEN** 客户端请求 `/invest`
- **THEN** 响应为 302，目标为 `/`

#### Scenario: 前端路由接到旧的投资页地址
- **WHEN** 服务端跳转未生效，前端路由接到 `/invest`
- **THEN** 前端把地址替换为 `/` 并显示投资页，而不是「这一页不存在」

#### Scenario: 投资页的子路径不变
- **WHEN** 用户访问 `/invest/etf` 或 `/invest/national-team`
- **THEN** 页面照常显示 ETF 流派地图或国家队持仓

### Requirement: 顶部导航只有投资、笔记、博客、关于
系统 SHALL 在 Header 与移动端抽屉中只提供四个导航项，依次为「投资」（`/`）、「笔记」（`/notes`）、「博客」（`/blog`）、「关于」（`/about`）；MUST NOT 出现「首页」「AI实验室」「自由空间」。收纳在投资页里的页面 MUST 点亮「投资」，同时又是独立导航项的页面（如 `/notes`）只点亮它自己那一项。

#### Scenario: 导航项
- **WHEN** 渲染 Header
- **THEN** 主导航恰好有四个链接，文字与顺序为「投资、笔记、博客、关于」

#### Scenario: 投资页内的页面点亮投资
- **WHEN** 用户位于 `/`、`/watch`、`/valuation` 或 `/invest/etf`
- **THEN** 「投资」带有当前页标记，其他三项没有

#### Scenario: 独立导航项只点亮自己
- **WHEN** 用户位于 `/notes` 或 `/notes/<id>`
- **THEN** 「笔记」带有当前页标记，「投资」没有

#### Scenario: 面包屑
- **WHEN** 用户位于投资页收纳的子页面，例如 `/monitor`
- **THEN** 面包屑为「投资 › 宏观温度」，其中「投资」指向 `/`

### Requirement: 已删除的栏目与页面跳转到首页
系统 SHALL 不再提供 AI 实验室、自由空间、投资页的「AI 工具」与「已舍弃」分组的页面，并 MUST 在 Cloudflare 上由静态托管层把它们的旧地址以 302 跳转到 `/`：`/ai`、`/ai/*`、`/life`、`/invest/ai-tools`、`/trading-philosophy`、`/investment-strategy`、`/mainland-investment-targets`、`/investment-targets`。投资页 MUST NOT 再显示「已舍弃」分组与「AI 工具」入口。

#### Scenario: AI 实验室的旧地址
- **WHEN** 客户端请求 `/ai`、`/ai/dev-team` 或 `/ai/ai-skills`
- **THEN** 响应为 302，目标为 `/`

#### Scenario: 自由空间与 AI 工具的旧地址
- **WHEN** 客户端请求 `/life` 或 `/invest/ai-tools`
- **THEN** 响应为 302，目标为 `/`

#### Scenario: 已舍弃页面的旧地址
- **WHEN** 客户端请求 `/trading-philosophy`
- **THEN** 响应为 302，目标为 `/`

#### Scenario: 投资页不再列出已删入口
- **WHEN** 渲染投资页
- **THEN** 页面中没有「已舍弃」分组，也没有指向 `/invest/ai-tools` 的入口

#### Scenario: 保留的页面不再指向已删栏目
- **WHEN** 渲染关于页、博客列表（含空状态）与任一博客文章
- **THEN** 页面中没有指向 `/ai`、`/life` 的链接

### Requirement: 站点地图、预渲染与 SEO 只收录仍存在的页面
系统 SHALL 使 `sitemap.xml`、预渲染的路由与路由 SEO 表只包含仍然存在的页面；MUST NOT 包含 `/ai`、`/ai/*`、`/life`、`/invest`、`/invest/ai-tools` 与四个已舍弃页面的地址。构建脚本 MUST NOT 依赖已删除的数据文件。

#### Scenario: 站点地图
- **WHEN** 运行 `npm run build` 生成 `public/sitemap.xml`
- **THEN** 其中没有以 `/ai`、`/life`、`/invest/ai-tools`、`/trading-philosophy`、`/investment-strategy`、`/mainland-investment-targets`、`/investment-targets` 结尾或为前缀的地址，且包含 `/`

#### Scenario: 构建不依赖已删文件
- **WHEN** `src/data/aiLab.ts` 已删除后运行 `npm run build` 与 `npm run build:cloudflare`
- **THEN** 两者都构建成功

### Requirement: 仓库中没有已删栏目的悬空引用
系统 SHALL 在删除后不残留对已删页面、数据、组件、接口与静态资源的引用；`/api/ask` MUST NOT 作为接口存在。仓库自用的技能目录（`.agents/skills/` 等）MUST 保持不变，`npm run skills:package` MUST 继续把 `.agents/skills/` 里的股票分析技能同步到其他工具的技能目录。

#### Scenario: 没有悬空引用
- **WHEN** 对 `src/`、`scripts/`、`api/`、`functions/`、`package.json`、`.env.example` 与 `README.md` 搜索 `aiLab`、`AiStudio`、`LifeLab`、`InvestmentAiTools`、`AskLab`、`api/ask`、`MINIMAX_`、`investment-skills`、`ai-skills`
- **THEN** 没有匹配，测试、类型检查与构建都通过

#### Scenario: 试问接口不存在
- **WHEN** 客户端请求 `/api/ask`
- **THEN** 响应状态码为 404，且响应体是 JSON 而不是页面 HTML

#### Scenario: 自用技能不受影响
- **WHEN** 运行 `npm run skills:package`
- **THEN** `.claude/skills/stock-analysis/`、`.opencode/skills/stock-analysis/` 与 `.codebuddy/skills/stock-analysis/` 的内容与 `.agents/skills/stock-analysis/` 一致，且不在 `public/` 下产生任何文件

