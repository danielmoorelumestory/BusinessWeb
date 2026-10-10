# site-visual-theme Specification

## Purpose
站点视觉主题：集中的设计令牌与冷色商务色板、状态色与行情涨跌色分离、全站系统无衬线字体、可复用的报告组件样式、文字对比度、窄屏无横向溢出、旧变量名兼容，以及品牌文件与主题一致。

## Requirements
### Requirement: 设计令牌集中定义，色板为冷色数据报告风格
系统 SHALL 在 `src/index.css` 的 `:root` 中集中定义设计令牌，页面底色为冷灰蓝，卡片为白色并带 1px 浅边框、极淡阴影与 12px 圆角，主色为蓝色，按钮与标签为圆角矩形而不是胶囊，正文与次要文字为深灰蓝色系；站内组件的颜色 MUST 通过这些令牌取得，而不是各自写死。

#### Scenario: 核心令牌取值
- **WHEN** 读取 `src/index.css` 的 `:root`
- **THEN** `--bg-primary` 为 `#f5f7fa`，`--bg-card` 为 `#ffffff`，`--text-primary` 为 `#172033`，`--accent` 为 `#1d4ed8`，`--border-subtle` 为 `#dde3ec`，`--radius-card` 为 `12px`，`--radius-btn` 为 `8px`，`--radius-chip` 为 `6px`

#### Scenario: 页面使用新底色
- **WHEN** 用户打开任一主站页面
- **THEN** 页面背景为冷灰蓝底，卡片为白色，而不是暖米色

### Requirement: 旧变量名保持可用并映射到新色板
系统 SHALL 保留既有的旧变量名（例如 `--system-blue`、`--system-red`、`--system-green`、`--system-gray*`、`--bg-secondary`、`--text-tertiary`、`--accent-warm`），并使其映射到新色板，使仍然引用它们的页面自动呈现新风格，且 MUST NOT 出现未定义的变量。

#### Scenario: 旧变量映射到主色
- **WHEN** 读取 `--system-blue`
- **THEN** 它解析为新的主色，而不是旧的绿色

#### Scenario: 没有未定义变量
- **WHEN** 对站内 CSS 与 TSX 中所有 `var(--…)` 引用逐个检查
- **THEN** 每个被引用的变量都在 `:root` 中有定义

### Requirement: 状态色与涨跌色相互独立
系统 SHALL 提供与涨跌色相互独立的状态色令牌 `--ok`、`--warn`、`--bad`（各自带文字色与浅底色），用于"保留、减仓、退出"一类的状态表达；涨跌色 `--up`、`--down` MUST 仅用于行情涨跌，并继续遵循 A 股红涨绿跌的习惯。

#### Scenario: 状态胶囊不使用涨跌色
- **WHEN** 渲染"退出"状态的胶囊
- **THEN** 它使用 `--bad` 系列令牌，而不是 `--up` 或 `--down`

#### Scenario: 涨跌语义保持不变
- **WHEN** 页面展示一只上涨的股票或指数
- **THEN** 涨幅以红色显示，下跌以绿色显示，与换肤前一致

#### Scenario: 热力图的涨跌色开关保留
- **WHEN** 热力图的 `greenUp` 开关切换
- **THEN** 涨跌颜色随之在红涨绿跌与绿涨红跌之间切换，行为与换肤前一致

### Requirement: 全站只使用系统无衬线字体
系统 SHALL 在全站（包括首页大标题与知识图谱页）只使用系统无衬线字体栈（`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`），正文字号 15px、行高 1.65；系统 MUST NOT 加载任何 Web 字体，也 MUST NOT 再依赖 `@fontsource/noto-serif-sc`。

#### Scenario: 不再请求字体文件
- **WHEN** 加载任一主站页面并查看网络请求
- **THEN** 没有任何字体文件请求，包括 Noto Serif SC

#### Scenario: 标题不再使用衬线
- **WHEN** 渲染首页、`/invest`、`/knowledge` 等页面的标题
- **THEN** 标题的字体栈为系统无衬线字体

#### Scenario: 构建产物不含衬线字体
- **WHEN** 构建完成
- **THEN** `dist/` 中不包含 Noto Serif SC 的字体文件，`package.json` 不再依赖 `@fontsource/noto-serif-sc`

### Requirement: 提供可复用的报告组件样式
系统 SHALL 提供一套报告组件样式：`report-card`（白色卡片）、`report-hero`（浅蓝渐变首屏卡片）、`pill`（`pill--ok`、`pill--warn`、`pill--bad` 三种状态胶囊）、`callout`（`callout--info`、`callout--warn`、`callout--bad` 三种左侧色条提示块）、`report-table`（紧凑表格）、`report-section-label`（蓝色小节标签）和 `report-note`（注释文字）。

#### Scenario: 胶囊使用状态色
- **WHEN** 元素带有 `pill pill--ok`
- **THEN** 它以绿色文字、浅绿底、6px 圆角矩形和粗体 12px 字号显示

#### Scenario: 提示块的左侧色条
- **WHEN** 元素带有 `callout callout--warn`
- **THEN** 它左侧有 5px 橙色色条与浅橙底，圆角为 8px

#### Scenario: 按钮与标签不是胶囊
- **WHEN** 渲染主按钮、次按钮、标签、分段按钮与状态徽章
- **THEN** 按钮的圆角为 8px，标签与徽章的圆角为 6px；仅圆点、头像、加载圈等圆形元素保持 `50%`

#### Scenario: 窄屏表格内部滚动
- **WHEN** 视口宽度不超过 700px，页面里有 `report-table`
- **THEN** 表格在自身内部横向滚动，页面整体不出现横向滚动条

### Requirement: 文字对比度满足 WCAG AA
系统 SHALL 保证正文与次要文字在白色卡片和页面底色上、三种状态胶囊文字在各自浅底上，文字与背景的对比度至少为 4.5:1；不满足时 MUST 调整令牌取值，而不是放宽标准。

#### Scenario: 次要文字在页面底色上
- **WHEN** 用令牌值计算 `--text-secondary` 对 `--bg-primary` 与 `--bg-card` 的对比度
- **THEN** 两者都不低于 4.5:1

#### Scenario: 状态胶囊文字
- **WHEN** 用令牌值计算 `--ok`、`--warn`、`--bad` 的文字色对其浅底色的对比度
- **THEN** 三者都不低于 4.5:1

### Requirement: 窄屏与宽屏均无意外的横向溢出
系统 SHALL 保证关键页面在 375px 与 1280px 视口宽度下页面整体不出现横向溢出；宽表格 MUST 在其容器内部滚动。

#### Scenario: 手机宽度
- **WHEN** 视口宽度为 375px，打开首页、`/invest`、`/monitor`、`/grid-trading`、`/research-notes`、`/knowledge`、`/about`
- **THEN** 页面的 `scrollWidth` 不大于视口宽度

### Requirement: 品牌文件与站点主题一致
系统 SHALL 使 `manifest.webmanifest` 的 `theme_color` 与 `background_color`、`favicon.svg`、`favicon-32.svg` 的底色与叶片色与新色板一致，不再出现旧色板的纸色与暗绿。

#### Scenario: manifest 主题色
- **WHEN** 读取 `public/manifest.webmanifest`
- **THEN** `theme_color` 与 `background_color` 均为 `#f5f7fa`

#### Scenario: 图标颜色
- **WHEN** 读取 `public/favicon.svg` 与 `public/favicon-32.svg`
- **THEN** 它们不包含旧的 `#FAF6EE` 与 `#5B7B65`，并使用新色板中的浅底和蓝色

### Requirement: 换肤不改变功能与数据
系统 SHALL 保证本次换肤不改变任何页面的功能、接口、数据与路由；所有现有自动化测试在更新与新色板相关的断言之后 MUST 通过，且 Cloudflare、Vercel、GitHub Pages 三条构建线的产物都能成功构建。

#### Scenario: 功能回归
- **WHEN** 运行前端测试、类型检查与构建
- **THEN** 全部通过，没有功能性测试因换肤而失败

#### Scenario: 三条构建线
- **WHEN** 分别运行 `npm run build`、`npm run build:cloudflare` 与 `npm run build:pages`
- **THEN** 三者都构建成功
