# 统一组件层与移动端适配 · 设计文档

日期：2026-10-11　状态：用户已授权直接执行（"你继续，需要做到比较完善的地步"）

整站体验优化的子项目 ②+③。① 工作台首页见 `2026-10-11-workbench-home-design.md`。

## 1. 现状（2026-10-11 实测）

用 headless Chromium 在 390×844 和 1280×900 两种视口逐页量过：

- **内容宽度和左边缘各页不同**。顶栏、面包屑在 1100px 容器里（左边缘 114px），各页内容却是：板块轮动 16→1264，全球行情 / 宏观温度 / 2026 计划 / 涨停分析 56→1224，公司估值 40→1240，DCF 70→1210，公司研究 176→1104。根因是各页在根节点用内联 `maxWidth` / `padding` 自定宽度，加上 `.page-tabs__inner` 用的是 1200px。切页面时内容左右跳。
- **语义**：全球行情、宏观温度、2026 计划、公司研究、公司详情没有 `<main>`，跳过导航链接落不到正文；「关于」没有 h1。
- **手机**：没有页面整页横向溢出（之前的适配有效）。但点击目标偏小：公司研究有 79 个控件高度不到 32px，全栈路线 100 个，国家队 10 个。
- **样式写法**：在用页面里，`style={{}}` 最多的是 ResearchNotes 122、CompanyDetail 103、Pulse 88、SectorRotation 86、InvestmentPlan2026 177、LimitUpAnalysis 48、FirstBook 56、FutureTrends 35；`components/pulse/*` 约 200，`CandidatePool` 25，`CompanyCombined` 22。同一种卡片、提示框、表格在各页各写一遍，圆角、阴影、间距都不同。全球行情还残留旧的蓝色按钮。
- **已舍弃 / 存档**：道与术 451、综合策略 73，宏观温度「旧版存档」8 个页签约 1900 处。只读存档，不迁移。

已有、可以沿用的基础：`src/index.css` 的色板 token；`.container`（16px / ≥768px 时 24px 边距，1100 宽）；`PageTabs` / `Segmented` / `PageTitle`（`src/components/ui/PageTabs.tsx`）；`.page-toolbar`、`.tool-btn`、`.seg__btn`、`.page-head`（`src/styles/shell.css`）。

## 2. 目标与成功标准

在用的页面看起来像同一个站：宽度对齐、同一套卡片、提示、表格、按钮；手机上点得准、表格看得全。

验收（全部在 390×844 与 1280×900 实测）：

1. 所有在用路由的正文左边缘与面包屑对齐（容差 ±1px），右边缘不超过 1100px 容器。
2. 每个路由恰好一个 `<main>`、恰好一个 h1（可以是视觉隐藏的）。
3. 390 宽下：`document.documentElement.scrollWidth === 390`；宽表格都在可横向滚动的容器里；`<button>`、表单控件以及非行内的链接，渲染高度都不小于 32px。在 `pointer: coarse` 设备上，主要按钮、胶囊切换和筛选标签不小于 44px。
4. 第 5 节列出的页面完成迁移：根节点用 `<Page>`；布局、间距、颜色类的内联样式换成共享类。剩下的内联样式只用于数据驱动的值（热力图颜色、进度宽度、计算出的涨跌色等）。
5. 在用页面不再出现色板以外的硬编码颜色。例外是数据可视化配色（热力图、图表线色），集中放在各自的配色常量里。
6. 内联样式和硬编码颜色用「棘轮」测试锁住：每个文件只能减少、不能增加。
7. `npm test`、`npm run typecheck`、`npm run build` 通过，现有测试不删，只在断言依赖旧内联样式时改写。

不在范围内：改业务逻辑和数据；重做信息架构；迁移已舍弃页面和「旧版存档」页签的内部（只给它们套上 `<Page>`）；深色模式。

## 3. 设计决定

- **一个宽度**：在用页面统一用 1100px 容器，与顶栏、面包屑对齐。数据密集的内容（板块轮动 7 列表、全球行情热力图）在自己的卡片里横向滚动，不再撑宽整页。
- **标题不重复**：沿用现有决定，页面名由面包屑显示，h1 用 `PageTitle` 视觉隐藏。页面顶部的一句话说明和操作按钮统一放进 `PageToolbar`（基于现有 `.page-toolbar`）。
- **组件薄、类为主**：共享的是 CSS 类（`src/styles/ui.css`），React 组件只是给类和 ARIA 结构套一层，不做复杂的 props。老代码可以直接用类名迁移，不必非得改成组件。
- **沿用已有命名**：按钮继续用 `.tool-btn` / `.tool-btn--primary`，切换继续用 `Segmented` / `.seg__btn`，不另造一套。

## 4. 组件层

新文件 `src/styles/ui.css`（在 `src/main.tsx` 里于 `index.css` 之后引入）和 `src/components/ui/` 下的组件：

| 组件 / 类 | 用途 | 结构 |
|---|---|---|
| `Page` / `.page` | 页面根节点 | `<main id="main-content" className="container page …">`；`variant="reading"` 时为 760px 居中的阅读宽度（公司详情、书稿目录）。不接受 `style` |
| `PageToolbar` / `.page-toolbar` | 页顶说明 + 操作 | 左边是 `note`（说明或数据日期），右边是 `children`（按钮） |
| `Card` / `.ui-card` | 统一卡片 | 可选 `title`、`icon`、`actions`、`description`；`as="section"` 时用 `aria-labelledby` 关联标题；`flush` 表示内容贴边（用于表格） |
| `Callout` / `.ui-callout` | 提示框 | `tone`：`info`（绿底）、`warn`（暖橙）、`danger`（红）、`muted`（灰）；可选 `title`、`icon` |
| `Stat` / `.ui-stat`，`StatGrid` / `.ui-stat-grid` | 指标块 | `label`、`value`、`sub`（可传节点）；grid 用 `auto-fill, minmax(160px, 1fr)` |
| `Badge` / `.ui-badge` | 标签 | `tone`：`neutral`、`accent`、`warm`、`up`、`down`、`muted` |
| `TableWrap` / `.ui-table-wrap` + `.ui-table` | 表格 | 外层横向滚动、`role="region"`、`tabIndex=0`、`aria-label`；`stickyFirst` 时首列吸附；`.ui-table` 统一表头底色、行高、数字列 `.num` 右对齐等宽 |
| `EmptyState` / `.ui-empty` | 空状态 / 错误 | 图标 + 一句话 + 可选操作 |
| `.ui-grid`、`.ui-grid--2/3/4` | 响应式栅格 | 手机 1 列，≥768px 2 列，≥1024px 按修饰类 |
| `.ui-stack`、`.ui-cluster` | 纵向间距 / 横向成组换行 | gap 用 `--space-*` |
| `.ui-chip`（并入 `.seg__btn`） | 筛选标签 | 与 `Segmented` 同样式，带计数 `.ui-chip__count` |

新增 token（只加尺寸，不加颜色）：`--space-1..8`（4/8/12/16/20/24/32/40px）、`--page-max: 1100px`、`--page-reading: 760px`、`--tap: 44px`。

`.page-tabs__inner` 的 `max-width` 改为 `var(--page-max)`，padding 与 `.container` 一致，页签和正文才能对齐。

触控：`@media (pointer: coarse)` 下 `.tool-btn`、`.seg__btn`、`.ui-chip`、`.page-tab` 的 `min-height: var(--tap)`。

## 5. 迁移范围（按使用频率）

| 批次 | 文件 | 要点 |
|---|---|---|
| A 外壳 | `src/pages/` 下全部路由页面 | 根节点换成 `<Page>`；删掉根节点上的宽度、边距内联样式；补 `PageTitle`；「关于」补 h1 |
| B 公司研究 | `ResearchNotes.tsx`、`CompanyDetail.tsx`、`components/CandidatePool.tsx`、`components/CompanyCombined.tsx` | 卡片、提示、筛选标签、表格换成共享类；公司列表表格首列吸附；筛选标签手机上横向滚动 |
| C 行情 | `Pulse.tsx`、`components/pulse/*` | 去掉蓝色按钮；卡片、工具栏统一；热力图配色保留在 `IndexHeatmap` 的常量里 |
| D 计划 | `InvestmentPlan2026.tsx` | 换掉 `grid()` 辅助函数和 `TableStyles`，改用 `.ui-grid` 和 `TableWrap` |
| E A 股 | `LimitUpAnalysis.tsx`、`SectorRotation.tsx` | 工具栏、卡片、表格统一；板块轮动表在卡片内横向滚动，首列（排名）吸附 |
| F 其他 | `FirstBook.tsx`（目录页）、`MyBooks.tsx`、`About.tsx`、`FutureTrends.tsx`、`ThemeCards.tsx`、`Dcf.tsx`、`Monitor.tsx` | 剩余的布局内联样式 |

已舍弃页面（`TradingPhilosophy`、`InvestmentStrategy`、`MainlandInvestmentTargets`、`InvestmentTargetsPage`）和 `components/monitor/*`（旧版存档）只做批次 A。

## 6. 防回退

- `src/styles/inlineStyleRatchet.test.ts`：扫描 `src/**/*.tsx`（不含测试），统计每个文件的 `style={{` 次数和硬编码颜色次数（`#rgb`、`#rrggbb`、`rgb(a)(…)`、`'white'`、`'black'`），与 `src/styles/inlineStyleBaseline.json` 比较：超过基线就失败；低于基线时提示更新基线（不失败）。新文件的基线为 0，除非写进基线并说明原因。
- `src/pages/pageShell.test.ts`：静态检查 `src/pages/*.tsx`（不含测试），每个路由组件文件都使用 `<Page`（或者 `FirstBook` 阅读器自带的 `<main className="reader-layout">`）。在 `App.tsx` 里直接作为路由元素的页面都要覆盖到。
- 组件单测：`Page`、`Card`、`Callout`、`TableWrap`、`Stat`、`Badge`、`EmptyState` 的结构和 ARIA。

## 7. 验收方式

开发时用 headless Chromium 脚本（放在 scratchpad，不进仓库，因为项目不依赖 Playwright）逐路由量：正文左边缘、`<main>` 和 h1 数量、`scrollWidth`、32px 以下的控件、不在滚动容器里的宽表格。所有在用路由都要满足第 2 节第 1–3 条。批次 B–F 各自在完成时截图对比。
