## Why

使用者不喜欢 BusinessWeb 当前的页面风格（暖米色底、衬线标题、绿色主色的"纸书茶室"），更喜欢参考页 `etf-portfolio-review-20261004.html` 的"冷色数据报告"风格：冷灰蓝底、白色卡片、系统无衬线字体、蓝色主色、绿橙红三色状态胶囊。站点以研究报告和数据页面为主，这种风格更贴合内容。

当前颜色已经由设计令牌驱动：`src/index.css` 的 `:root` 定义整套色板，组件里引用 `var(--…)` 约 3621 处，且旧变量名都映射到新色板。因此可以通过替换令牌、补一小套报告组件样式完成换肤，不需要引入新依赖，也不需要改动数千处引用。

## What Changes

- 以参考页的设计语言为基础、取偏商务的"B 版"替换 `:root` 令牌：页面底色 `#f5f7fa`、白色卡片、1px `#dde3ec` 边框与极淡阴影、卡片 12px 圆角、主色 `#1d4ed8`、正文 `#172033`、次要文字 `#667085`；按钮为 8px 圆角矩形、标签与胶囊为 6px 圆角矩形（不再是全圆角）；旧变量名（`--system-*`、`--bg-secondary`、`--accent-warm` 等）保留并映射到新色板。实施中已做过 A / B 两版对比（A 为参考页原样的 `#2563eb`、16px 圆角、胶囊按钮），使用者选定 B。
- 把状态语义与涨跌语义拆成两套独立变量：新增 `--ok`、`--warn`、`--bad`（各带浅底色）用于"保留 / 减仓 / 退出"类状态；`--up`、`--down` 继续表示 A 股的红涨绿跌，热力图、涨跌幅沿用，`greenUp` 开关保留。
- 全站只用系统无衬线字体，与参考页一致：所有标题不再用衬线，移除 `@fontsource/noto-serif-sc` 依赖及其在 `main.tsx` 里的引入。
- 新增一小套报告组件样式：`report-card`、`report-hero`（渐变首屏）、`pill` 三色变体、`callout` 三色变体（左侧色条）、报告表格、小节标签、注释文字。
- 壳层（`shell.css`、Header、Footer）、`valuation`、`macro`、`gridTrading`、`ai-learning` 等样式跟随新风格；写死颜色的文件（热力图、图表、`monitorData`、`ThemeCards`、`TradingPhilosophy`、`services/api.ts` 等）逐个评估后换成令牌或新色板。
- 知识图谱页（`knowledge.css` 约 179 处专属颜色，以及 `gardenEngine.ts`、`GardenScene.tsx` 里的 3D 场景颜色）一并换成新风格，不保留暖色特例。
- 品牌文件跟随新风格：`manifest.webmanifest` 的主题色与背景色、`favicon.svg`、`favicon-32.svg`；改写三个现有的样式测试（令牌、品牌、对比度）以断言新色板。
- 实施中设置"先看效果再铺开"的关卡：先只换令牌与基础组件，并对关键页面在桌面与手机宽度下截前后对比图交给使用者确认；确认后才处理写死颜色与知识图谱。未经使用者确认不得推送。
- 不保留暖色版本，不做主题切换，彻底替换。
- 不包含：引入 Tailwind、shadcn 等组件库（留给后续新写的页面，如 `replace-grid-trading`）；重做页面布局或信息架构；`/note/` 下的 `notes-site`（Astro）页面风格；任何功能、接口、Worker 或数据变化。

## Capabilities

### New Capabilities
- `site-visual-theme`: 站点视觉主题——设计令牌的集中定义与色板、状态色与涨跌色分离、全站系统无衬线字体、可复用的报告组件样式、文字对比度、窄屏无横向溢出、旧变量名兼容、品牌文件与主题一致。

### Modified Capabilities
<!-- 无。已有规格描述的是托管与接口行为，本变更是纯样式改动，不改变这些行为。 -->

## Impact

- 代码：`src/index.css`（令牌）；新增报告组件样式文件；`src/styles/shell.css`（22KB）、`src/features/knowledge/knowledge.css`（26KB）、`valuation.css`、`macro.css`、`gridTrading.css`、`ai-learning.css`；`src/main.tsx` 去掉字体引入；Header、Footer 与少数页面里写死颜色的 TSX（热力图 `IndexHeatmap`/`HeatmapSection` 约 30 处、`services/api.ts`、`TradingPhilosophy`、`monitorData`、`ThemeCards`、`GridChart`/`chart.ts`、`gardenEngine.ts` 等，合计约 105 处 hex）。
- 依赖：移除 `@fontsource/noto-serif-sc`（并更新 `package-lock.json`）；不新增依赖。
- 资源：`public/manifest.webmanifest`、`public/favicon.svg`、`public/favicon-32.svg`。
- 测试：改写 `src/styles/tokens.test.ts`、`brand.test.ts`、`labContrast.test.ts`，新增对比度测试；`scripts/retheme-colors.*` 保持不动。
- 外部系统：无。纯样式改动，Cloudflare、Vercel、GitHub Pages 三条构建线都不受影响，不改任何接口与数据。
- 风险：次要文字 `#667085` 在 `#f5f7fa` 上接近 WCAG AA 的临界值，需要实测，必要时略微加深；写死颜色散落在多处，可能漏改；3D 花园场景换色后可读性需要肉眼确认。
