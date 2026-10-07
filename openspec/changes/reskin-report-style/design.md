## Context

BusinessWeb 当前是"纸书茶室"风格：`src/index.css` 的 `:root` 定义色板（`--bg-primary #FAF6EE`、`--bg-card #FFFDF8`、`--text-primary #3A3A34`、`--text-secondary #7A766B`、`--accent #5B7B65`、`--accent-warm #C9794F`、`--border-subtle #E6DFD0`、`--up #C4503F`、`--down #3F9A62`），并有一整组旧变量映射（`--system-blue`、`--system-red`、`--system-gray*`、`--bg-secondary` 等）让老页面自动换肤。组件里引用 `var(--…)` 约 3621 处，最多的是 `--text-primary`（768）、`--border-subtle`（600）、`--text-secondary`（465）、`--system-red`（235）、`--system-green`（146）。仓库曾换过一次肤（iOS 蓝 → 纸书茶室），`scripts/retheme-colors.mjs` 及其测试可参考。

写死颜色集中在少数位置：CSS 里 `knowledge.css` 179 处、`shell.css` 3 处、`index.css` 2 处、`valuation.css` 2 处、`gridTrading.css` 1 处；TS/TSX 里约 105 处 hex（`IndexHeatmap` 19、`HeatmapSection` 11、`services/api.ts` 6、`TradingPhilosophy` 5、`gardenEngine.ts` 5、`monitorData` 3、`ThemeCards` 2、`GridChart` 2，另有 `chart.ts`）。热力图已有 `greenUp` 开关，可在红涨绿跌与绿涨红跌之间切换。

衬线字体通过 `src/main.tsx` 引入 `@fontsource/noto-serif-sc` 的 600 与 700 两个字重，`--font-serif` 在 `shell.css`（十几处）、`knowledge.css`、`ai-learning.css`、`macro.css`、`index.css` 中使用。

现有三个测试钉死了旧值：`tokens.test.ts` 断言每个令牌的具体色值，`brand.test.ts` 断言 manifest 主题色 `#FAF6EE`、favicon 使用 `#FAF6EE` 与 `#5B7B65`，并断言衬线字体自托管；`labContrast.test.ts` 断言实验室徽章的对比度写法。

参考页 `etf-portfolio-review-20261004.html` 是 12KB 的单页，样式全部内联，设计语言见提案。主站内容区容器已是最宽 1100px。

## Goals / Non-Goals

**Goals:**
- 全站换成参考页的冷色数据报告风格，包括知识图谱页。
- 保持所有功能、接口、数据、页面结构不变；红涨绿跌语义不变。
- 不新增依赖，去掉衬线字体及其依赖。
- 让使用者在大范围铺开之前先看到效果并确认。
- 用测试固定新色板与对比度，防止以后回退或漏改。

**Non-Goals:**
- 不引入 Tailwind、shadcn 等组件库。
- 不重做布局或信息架构，不改页面内容。
- 不保留暖色版本，不做主题切换，不做暗色模式。
- 不改动 `/note/` 下的 `notes-site` 页面风格。

## Decisions

### 1. 原位替换令牌，保留全部旧变量名
直接改写 `src/index.css` 的 `:root`：核心令牌换成新值，旧变量名（`--system-*`、`--bg-secondary`、`--text-tertiary`、`--border-primary` 等）继续存在并映射到新色板。
- 理由：3621 处引用不需要逐个修改，改动集中、可回退。
- 备选：重命名为新的语义令牌并全量替换引用。放弃，改动面巨大且收益只是命名。
- 初定新值（在关卡里由使用者确认，可调整）：

| 令牌 | 新值 | 说明 |
|---|---|---|
| `--bg-primary` | `#f5f7fa` | 页面底色 |
| `--bg-card` | `#ffffff` | 卡片 |
| `--bg-subtle` | `#f7f9fc` | 表头、浅底 |
| `--text-primary` | `#172033` | 正文 |
| `--text-secondary` | `#667085` | 次要文字，需实测对比度 |
| `--text-strong` | `#344054` | 表头等 |
| `--accent` | `#1d4ed8` | 主色（B 版，比参考页的 `#2563eb` 更深更稳） |
| `--accent-soft` | `rgba(29,78,216,0.08)` | 主色浅底 |
| `--accent-ink` | `#1e3a8a` | 浅底上的主色文字，也用作主按钮悬停色 |
| `--accent-warm` | `#d97706` | 原来的暖色强调，改映射为琥珀 |
| `--border-subtle` | `#dde3ec` | 卡片边框（略深，线条更利落） |
| `--border-row` | `#e6ebf2` | 表格行线 |
| `--radius-card` | `12px` | 卡片圆角（`--radius-lg` 同为 12px） |
| `--radius-btn` | `8px` | 按钮与输入框 |
| `--radius-chip` | `6px` | 标签、胶囊、分段按钮 |
| `--shadow-card` | `0 1px 2px rgba(16,24,40,0.05)` | 卡片的极淡阴影 |
| `--up` / `--down` | 红 `#dc2626` / 绿 `#16a34a` | 涨跌，与热力图现有取值一致 |

### 2a. 对比度实测后的取值调整（实施中补充）
对比度测试实测发现：参考页的"减仓"胶囊文字 `#9a6700` 在浅黄底 `#fff4d6` 上只有 4.44:1，略低于 AA 的 4.5:1。按"不达标就调整令牌、不放宽阈值"的约定，`--warn` 与 `--warm-ink` 取 `#966400`（对 `#fff4d6` 为 4.65:1，肉眼与参考色几乎无差别）。其余令牌对均达标，包括此前担心的次要文字 `#667085` 对 `#f5f7fa`。

### 2. 状态色与涨跌色拆成两套变量
新增 `--ok`、`--warn`、`--bad`，每个配 `-ink`（文字色）与 `-soft`（浅底）：绿 `#087443`/`#e9f8ee`、橙 `#966400`/`#fff4d6`（参考页为 `#9a6700`，见 2a）、红 `#b42318`/`#ffebe9`；callout 的左侧色条与浅底另配（蓝 `#1d4ed8`/`#f6f9ff`、橙 `#d97706`/`#fffaf0`、红 `#dc2626`/`#fff5f5`）。`--up`、`--down` 只用于行情涨跌。
- 理由：参考页里的"绿 = 保留、红 = 退出"是状态含义，而 A 股是红涨绿跌；若共用同一组变量，"退出"和"上涨"会撞色，造成误读。
- 约束：热力图与涨跌幅继续使用 `--up`/`--down`（或其等价值），`greenUp` 开关行为不变。

### 2b. A / B 两版对比后选定 B（商务版）
关卡阶段做了两版并排对比：A 为参考页原样（主色 `#2563eb`、卡片 16px 圆角、胶囊按钮与标签、无阴影），B 为偏商务的取值（主色 `#1d4ed8`、卡片 12px、按钮 8px、标签 6px、卡片极淡阴影、首页大标题 2rem/2.6rem 且字距收紧、名言卡片竖条由橙改蓝）。使用者选定 B。对比中还发现并修复了一个两版共有的缺陷：主按钮悬停色写死为旧的暗绿 `#4B6A55`，改为 `--accent-ink`。
- 标签类的全圆角（宏观温度页的 `.macro-badge`、网格同步状态、候选池按钮、2026 投资计划的 `Pill`、关于页与研究笔记里的内联按钮与输入框）统一改为 `--radius-chip` / `--radius-btn`；圆点、头像、加载圈等用 `50%` 的圆形元素保留。

### 3. 字体：先让 `--font-serif` 指向无衬线，最后再清理
第一步把 `--font-serif` 重新定义为与 `--font-sans` 相同的系统无衬线栈，使所有标题立刻变为无衬线，无需先改十几处引用。关卡通过后，再把引用逐个改为 `--font-sans`，删除 `--font-serif`、`main.tsx` 里的两行字体引入和 `package.json` 里的依赖。
- 理由：先看效果、后做清理，降低一次性改动的风险；每一步都可单独验证。
- 参考页字体栈：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`，正文 15px、行高 1.65，h1 28px、h2 20px、h3 16px，窄屏（≤700px）h1 为 23px。

### 4. 报告组件放在单独的样式文件，类名对应参考页
新增 `src/styles/report.css`，在 `main.tsx` 引入。类名：`report-card`、`report-hero`、`pill`（`pill--ok`/`pill--warn`/`pill--bad`，6px 圆角矩形）、`callout`（`callout--info`/`callout--warn`/`callout--bad`）、`report-table`、`report-section-label`、`report-note`。窄屏下 `report-table` 内部横向滚动。
- 理由：与现有 `shell.css` 分开，职责清晰，后续新页面可直接复用；类名与参考页的 `.card`、`.hero`、`.pill`、`.key`、`.section`、`.foot` 一一对应。
- 范围：本变更只新增样式并在壳层与少数展示页中使用，不强制把所有页面改写成这些类。

### 5. "先看效果再铺开"的关卡
分两段实施：第一段只改令牌、字体别名、报告组件与壳层，用本地浏览器对首页、`/invest`、`/monitor`、`/grid-trading`、`/research-notes`、`/knowledge`、`/about` 等关键页面分别在 1280px 与 375px 宽度截前后对比图，交给使用者确认；确认后才进入第二段（写死颜色、知识图谱、去衬线与依赖、品牌文件）。使用者确认前不得推送。
- 理由：风格属于主观判断，越早让使用者看到越能避免大范围返工。

### 6. 写死颜色逐文件评估，三种处理方式
对每处写死颜色按用途选择：换成令牌（卡片、边框、文字）；保留涨跌语义并统一到 `--up`/`--down` 的等价值（热力图、涨跌幅、图表）；确属数据分类色的（例如 `services/api.ts` 里给分类标签用的蓝、紫等）按新色板统一风格后保留为常量。每个文件评估后在任务里记录结论。
- 理由：这 105 处并非同一类东西，机械替换会破坏涨跌语义或图表可读性。

#### 写死颜色的评估结论（第 4 组实施记录）
| 位置 | 结论 |
|---|---|
| `IndexHeatmap`、`HeatmapSection` 的外围界面（标签页按钮、边框、灰色文字、重试按钮、琥珀色提示） | 换成令牌（`--accent`、`--accent-soft`、`--border-subtle`、`--text-*`、`--warn` 等） |
| 热力图色阶、`upText/downText/upLight/downLight`、`greenUp` 开关 | **保留**：行情涨跌语义，色值与 `--up`/`--down` 一致 |
| 热力图深色画布（`#1f2937`）、画布内文字、提示框 | **保留**：有意的深色底 |
| `services/api.ts`、`monitorData.ts` 的分类色（行业板块、概念板块、计划执行、决策策略、监控分析） | 换成令牌（`--accent`、`--system-purple`、`--system-teal` 及对应浅底），内联样式里 `var()` 可用 |
| `TradingPhilosophy` 的 `#ffffff` | **保留**：彩色底上的白字 |
| 网格图表 `chart.ts`、`GridChart.tsx` | 买入红、卖出蓝的语义保留，色值对齐新色板（`#dc2626`、`#1d4ed8`）；SVG 属性不支持 `var()`，故保持字面值 |
| `valuation.css`、`gridTrading.css` 的边框与阴影 | 换成 `--border-subtle`、`--shadow-card`、`--bg-card`；去掉蓝色按钮阴影 |
| `index.css` 的 `#fff`（按钮文字）、`shell.css` 的 `#fff`（3 处） | **保留**：主色底上的白字 |
| `macro.css` 的徽章、过期标记、提示条、AI 连接状态 | 迁到状态色：绿→`--ok`、黄→`--warn`、红→`--bad`；`macro-hero` 的色条用 callout 色条令牌 |
| `ThemeCards` 的红色警告 | 迁到 `--bad` |
| 监控类页面（`USMonitorTab`、`ChinaStockTab`、`ChinaTemperatureTab`、`TemperatureTab`、`SilverMonitor`、`ExecutionTab`、`StagesTab` 等，合计约 470 处引用）以及 `TradingPhilosophy` 等 | **暂不迁移**：这些文件里红绿黄多表达风险等级或装饰，且 `--system-red/green` 与 `--up/--down` 当前同值，视觉上没有冲突；逐处判断工作量大、误改风险高。若将来要让涨跌色独立变化，需要先把这些迁到 `--ok/--warn/--bad`，作为后续事项记录 |

#### 知识图谱改色的实施记录（第 5 组）
- `knowledge.css`：约 100 处是 `var(--token, #旧色)` 形式，旧色只是后备值，直接去掉；带透明度的绿（`#57794c0d` 等）改为 `color-mix(in srgb, var(--accent) N%, transparent)`，保留透明度并跟随主色；花园画布的奶油渐变改为冷色渐变。代码高亮（8 种语法色）与一处中性黑色阴影有意保留。
- 去掉后备值的副作用：此前盘点出的未定义变量 `--border-color` 原来靠后备值兜底，一并改为 `--border-subtle`。
- 3D 场景：新增 `gardenPalette.ts` 作为颜色的唯一来源（WebGL 里不能用 `var()`），高亮连线沿用"琥珀 = 强调、蓝 = 主色"的原有逻辑。
- 验证方式：用放在临时目录的示例资料库启动本地知识服务（通过 `KNOWLEDGE_VAULT` 指定，不触碰真实资料库），截图确认可读性。

### 7. 知识图谱整体改色，3D 场景颜色集中成一个小色板
`knowledge.css` 的 179 处写死颜色按用途映射到新令牌；`gardenEngine.ts`、`GardenScene.tsx` 里 3D 场景的颜色（如标签文字、光点、连线）提取为一个小的色板常量，取值对应新色板（蓝作主色、琥珀作强调）。改完后用肉眼确认节点、连线、标签在冷色底上的可读性。
- 理由：集中成常量后，以后再调色只改一处；知识图谱不再保留暖色特例，符合使用者的决定。

### 8. 品牌文件与测试一起更新
`manifest.webmanifest` 的 `theme_color` 与 `background_color` 改为 `#f5f7fa`；`favicon.svg`、`favicon-32.svg` 的底色与叶片色改为新色板（浅底、蓝色叶片）。三个样式测试改写为断言新值：令牌测试断言新色板与旧变量映射仍存在；品牌测试断言新的主题色、图标颜色，以及"不再请求 Google Fonts、不再引入任何 webfont"；对比度测试保留意图（徽章文字不靠低对比度的强调色）并改写具体断言。另新增对比度测试，用令牌计算 WCAG 对比度。
- 理由：这些测试正是为了防止回退，删除会失去保护；改写成新值才能继续起作用。

### 9. 对比度用测试固定
新增测试读取 `index.css` 的令牌，计算并断言：`--text-primary`、`--text-secondary` 在 `--bg-card` 与 `--bg-primary` 上，以及三种 pill 文字在各自浅底上，对比度至少 4.5:1（WCAG AA 正文）。
- 理由：`#667085` 在 `#f5f7fa` 上接近临界值，凭肉眼无法判断；若不达标，调整令牌值而不是放宽阈值。

## Risks / Trade-offs

- [次要文字 `#667085` 在 `#f5f7fa` 上接近 AA 临界值] → 用测试实测，不达标就略微加深次要文字色，并在设计里记录最终取值。
- [写死颜色散落，可能漏改，留下暖色残片] → 验证阶段全局搜索旧色板值（`#FAF6EE`、`#FFFDF8`、`#5B7B65`、`#C9794F`、`#E6DFD0` 等），逐一确认是已评估的保留项还是遗漏。
- [涨跌色与状态色混淆] → 两套变量分开命名，热力图与涨跌幅走 `--up`/`--down`；验证阶段专门核对红涨绿跌没有变化。
- [3D 花园场景换色后可读性变差] → 在关卡后的第二段用肉眼检查，必要时调整色板常量。
- [大量页面的视觉变化无法被单元测试覆盖] → 用前后对比截图与使用者确认作为主要验收手段；测试只固定令牌、字体、对比度与品牌文件。
- [去掉衬线后某些大标题显得单薄] → 与参考页一致是使用者的明确要求；如关卡中发现个别标题字重不足，调整字重而不是恢复衬线。
- [移除依赖可能漏掉某处引用，导致运行时字体回退] → 删除后全局搜索 `noto-serif`、`font-serif`，并确认构建产物中不含相关字体文件。

## Migration Plan

1. 截取关键页面的"改前"基线（1280px 与 375px）。
2. 第一段：改令牌、新增状态变量、让 `--font-serif` 指向无衬线、新增报告组件样式、壳层跟随；改写令牌测试并新增对比度测试。
3. 本地对关键页面截"改后"图，与基线对比，交给使用者确认；不通过则调整令牌后重复。
4. 第二段（确认之后）：处理写死颜色、知识图谱改色、替换衬线引用并移除字体与依赖、更新品牌文件，改写品牌与徽章测试。
5. 验证：全部测试、类型检查、三种构建（`build`、`build:cloudflare`、`build:pages`）；375px 与 1280px 无横向溢出；全局搜索旧色板值与衬线残留。
6. 使用者确认后推送，再验证线上主站与 `/note/` 不受影响。

回滚：整个变更是纯样式改动，`git revert` 相关提交即可恢复旧外观，无数据或接口影响。

## Open Questions

- 令牌初定值是否全部沿用参考页，还是在关卡里按实际观感微调（例如 `--up`/`--down` 的红绿深浅）。
- 个别页面（如 `ThemeCards`）的分类色是否需要保留多色，或统一成主色的深浅，待评估时与使用者确认。
- `notes-site` 的 `/note/` 页面风格后续如何与主站对齐，另行讨论，不在本变更内。
