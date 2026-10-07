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
| `--accent` | `#2563eb` | 主色 |
| `--accent-soft` | `rgba(37,99,235,0.1)` | 主色浅底 |
| `--accent-ink` | `#1d4ed8` | 浅底上的主色文字 |
| `--accent-warm` | `#d97706` | 原来的暖色强调，改映射为琥珀 |
| `--border-subtle` | `#e5eaf2` | 卡片边框 |
| `--border-row` | `#e8edf4` | 表格行线 |
| `--radius-card` | `16px` | 卡片圆角 |
| `--radius-pill` | `999px` | 胶囊 |
| `--up` / `--down` | 红 `#dc2626` / 绿 `#16a34a` | 涨跌，与热力图现有取值一致 |

### 2. 状态色与涨跌色拆成两套变量
新增 `--ok`、`--warn`、`--bad`，每个配 `-ink`（文字色）与 `-soft`（浅底）：绿 `#087443`/`#e9f8ee`、橙 `#9a6700`/`#fff4d6`、红 `#b42318`/`#ffebe9`；callout 的左侧色条与浅底另配（蓝 `#2563eb`/`#f6f9ff`、橙 `#d97706`/`#fffaf0`、红 `#dc2626`/`#fff5f5`）。`--up`、`--down` 只用于行情涨跌。
- 理由：参考页里的"绿 = 保留、红 = 退出"是状态含义，而 A 股是红涨绿跌；若共用同一组变量，"退出"和"上涨"会撞色，造成误读。
- 约束：热力图与涨跌幅继续使用 `--up`/`--down`（或其等价值），`greenUp` 开关行为不变。

### 3. 字体：先让 `--font-serif` 指向无衬线，最后再清理
第一步把 `--font-serif` 重新定义为与 `--font-sans` 相同的系统无衬线栈，使所有标题立刻变为无衬线，无需先改十几处引用。关卡通过后，再把引用逐个改为 `--font-sans`，删除 `--font-serif`、`main.tsx` 里的两行字体引入和 `package.json` 里的依赖。
- 理由：先看效果、后做清理，降低一次性改动的风险；每一步都可单独验证。
- 参考页字体栈：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`，正文 15px、行高 1.65，h1 28px、h2 20px、h3 16px，窄屏（≤700px）h1 为 23px。

### 4. 报告组件放在单独的样式文件，类名对应参考页
新增 `src/styles/report.css`，在 `main.tsx` 引入。类名：`report-card`、`report-hero`、`pill`（`pill--ok`/`pill--warn`/`pill--bad`）、`callout`（`callout--info`/`callout--warn`/`callout--bad`）、`report-table`、`report-section-label`、`report-note`。窄屏下 `report-table` 内部横向滚动。
- 理由：与现有 `shell.css` 分开，职责清晰，后续新页面可直接复用；类名与参考页的 `.card`、`.hero`、`.pill`、`.key`、`.section`、`.foot` 一一对应。
- 范围：本变更只新增样式并在壳层与少数展示页中使用，不强制把所有页面改写成这些类。

### 5. "先看效果再铺开"的关卡
分两段实施：第一段只改令牌、字体别名、报告组件与壳层，用本地浏览器对首页、`/invest`、`/monitor`、`/grid-trading`、`/research-notes`、`/knowledge`、`/about` 等关键页面分别在 1280px 与 375px 宽度截前后对比图，交给使用者确认；确认后才进入第二段（写死颜色、知识图谱、去衬线与依赖、品牌文件）。使用者确认前不得推送。
- 理由：风格属于主观判断，越早让使用者看到越能避免大范围返工。

### 6. 写死颜色逐文件评估，三种处理方式
对每处写死颜色按用途选择：换成令牌（卡片、边框、文字）；保留涨跌语义并统一到 `--up`/`--down` 的等价值（热力图、涨跌幅、图表）；确属数据分类色的（例如 `services/api.ts` 里给分类标签用的蓝、紫等）按新色板统一风格后保留为常量。每个文件评估后在任务里记录结论。
- 理由：这 105 处并非同一类东西，机械替换会破坏涨跌语义或图表可读性。

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
