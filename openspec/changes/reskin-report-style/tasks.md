## 1. 基线与盘点

- [x] 1.1 启动本地开发服务器，对首页、`/invest`、`/monitor`、`/grid-trading`、`/research-notes`、`/knowledge`、`/about` 在 1280px 与 375px 宽度各截一张"改前"基线图，保存到临时目录（不进仓库）
- [x] 1.2 全局列出所有被引用的 `var(--…)`，核对哪些没有在 `:root` 中定义，记录结果（规格要求不出现未定义变量）
- [x] 1.3 盘点衬线使用处与内联 `fontFamily`：`font-serif`、`Noto Serif`、TSX 里的内联字体设置，列出文件与行号，作为后续替换清单
- [x] 1.4 盘点三个现有样式测试（`tokens.test.ts`、`brand.test.ts`、`labContrast.test.ts`）各自断言的具体值，作为改写清单

## 2. 第一段：令牌、状态色与基础组件

- [x] 2.1 改写 `src/index.css` 的 `:root`：核心令牌换成设计文档中的新值，新增 `--bg-subtle`、`--text-strong`、`--border-row`、`--radius-card`、`--radius-pill`
- [x] 2.2 新增状态色令牌 `--ok`、`--warn`、`--bad`（各带 `-ink` 与 `-soft`）以及 callout 用的色条与浅底；`--up`、`--down` 保持"红涨绿跌"并取与热力图一致的红绿
- [x] 2.3 保留所有旧变量名并映射到新色板（`--system-*`、`--bg-secondary`、`--text-tertiary`、`--border-primary`、`--accent-warm` 等），补上 1.2 中发现的未定义变量
- [x] 2.4 让 `--font-serif` 暂时指向与 `--font-sans` 相同的系统无衬线字体栈；正文设为 15px、行高 1.65；h1 28px、h2 20px、h3 16px，窄屏（≤700px）h1 为 23px
- [x] 2.5 新增 `src/styles/report.css` 并在 `main.tsx` 引入：`report-card`、`report-hero`、`pill`（三色）、`callout`（三色）、`report-table`、`report-section-label`、`report-note`；窄屏下 `report-table` 内部横向滚动
- [x] 2.6 壳层跟随新风格：`shell.css` 本来就大量使用圆角与颜色令牌，令牌与 `--radius-lg`（16px）更新后自动跟随，Header、Footer 已核对；不改页面结构与内容
- [x] 2.7 改写 `tokens.test.ts`：断言新色板的核心令牌、旧变量映射仍存在、新增的状态色令牌存在；保留"无 backdrop-filter""index.html 为 Live"这两条
- [x] 2.8 新增对比度测试：用令牌值计算 WCAG 对比度，断言 `--text-primary`、`--text-secondary` 在 `--bg-card` 与 `--bg-primary` 上，以及三种 pill 文字在各自浅底上不低于 4.5:1；`--text-secondary` 不达标时调整令牌值并把最终取值记入设计文档
- [x] 2.9 运行 `npm test -- --run`、`npm run typecheck`、`npm run build`，确认第一段没有造成功能性回归（品牌与徽章测试此时可能因旧值而失败，属于 4.x 要改写的范围，需如实记录）。结果：506 项中仅 `brand.test.ts` 一条（标题字体栈以 Noto Serif SC 开头）因旧值失败，已先改为断言 `--font-serif` 指向无衬线，其余品牌断言留到 7.3；类型检查 0 错误，构建通过

## 3. 关卡：先看效果再铺开（需要使用者确认）

- [x] 3.1 对 1.1 中的同一批页面在 1280px 与 375px 宽度截"改后"图，与基线并排整理成对比，交给使用者
- [x] 3.2 使用者确认风格方向与令牌取值；如需调整（例如红绿深浅、主色），回到 2.1、2.2 修改并重新截图，直到确认。**未获确认前不得进入第 4 组，也不得推送**。结果：使用者确认方向正确，并要求偏商务；做了 A / B 两版并排对比，使用者选定 B（主色 `#1d4ed8`、卡片 12px、按钮 8px、标签 6px、卡片极淡阴影、首页大标题收敛、竖条改蓝），详见设计 2b

## 4. 第二段：写死颜色

- [x] 4.0 （已完成，补记）统一标签类全圆角：`.macro-badge`、`.grid-sync-status`、`CandidateButton`、`InvestmentPlan2026` 的 `Pill`、`About` 与 `ResearchNotes` 里的内联按钮与输入框改为 `--radius-chip` / `--radius-btn`，圆形元素保留；并修复主按钮悬停写死旧暗绿的缺陷
- [x] 4.1 `src/components/pulse/IndexHeatmap.tsx` 与 `HeatmapSection.tsx`：逐处评估；涨跌色阶保持红涨绿跌语义并保留 `greenUp` 开关，其余文字、底色换成令牌，并记录结论。结果：外围界面换成令牌，色阶、涨跌文字、深色画布与提示框保留（见设计"写死颜色的评估结论"）
- [x] 4.2 `src/services/api.ts`、`src/pages/ThemeCards.tsx`、`src/pages/TradingPhilosophy.tsx`、`src/components/monitor/monitorData.ts`：评估这些颜色是令牌、涨跌色还是数据分类色；分类色统一到新色板后保留为常量，并记录结论。结果：分类色换成令牌，`TradingPhilosophy` 的白字保留，`ThemeCards` 的红色警告迁到 `--bad`
- [x] 4.3 `src/features/grid-trading/GridChart.tsx` 与 `chart.ts`：图表线条、网格、文字颜色换成令牌或新色板，保持买卖与涨跌的区分度。结果：买入红、卖出蓝语义保留，色值对齐 `#dc2626` / `#1d4ed8`（SVG 属性不支持 `var()`）
- [x] 4.4 `valuation.css`、`macro.css`、`gridTrading.css`、`ai-learning.css`、`index.css` 与 `shell.css` 里剩余的写死颜色：换成令牌。结果：`valuation.css`、`gridTrading.css` 的边框、阴影、卡片底色换成令牌；其余 `#fff` 为主色底上的白字，保留
- [x] 4.5 逐个页面检查是否仍有内联的暖色或衬线残留，补改。结果：除知识图谱（第 5 组）外，没有旧暖色的字面值或 rgba 残留；其余 `color-mix` 均引用令牌
- [x] 4.6 核查并迁移"表示状态含义"的颜色用法：宏观温度页等处的"正常 / 警惕 / 危险"胶囊目前引用 `--system-green` / `--system-red`（它们映射到涨跌色 `--down` / `--up`），应改为 `--ok` / `--warn` / `--bad`；真正表示行情涨跌的用法保持 `--up` / `--down`。逐处记录结论。结果：已迁移 `macro.css` 的徽章、过期标记、提示条与 AI 连接状态；监控类页面约 470 处引用暂不迁移，原因与后续事项见设计

## 5. 知识图谱改色

- [x] 5.1 `knowledge.css` 的 179 处写死颜色按用途映射到新令牌（背景、边框、文字、强调），保持原有布局。结果：去掉全部 `var(--x, #旧色)` 后备值；带透明度的绿与金改为 `color-mix(var(--accent) N%)`；花园画布渐变改为 `--bg-card → --bg-primary → --bg-secondary`；提示块分类色对齐令牌；代码高亮的 8 种语法分类色与一处中性黑色淡阴影有意保留；修复了未定义变量 `--border-color`（改用 `--border-subtle`）
- [x] 5.2 把 `gardenEngine.ts`、`GardenScene.tsx` 里的 3D 场景颜色提取为一个小的色板常量，取值对应新色板（蓝为主、琥珀为强调）。结果：新增 `gardenPalette.ts` 集中保存 3D 场景颜色（节点分类色、标签、光晕、连线、粒子），`GardenScene.tsx` 与 `gardenEngine.ts` 改为引用它
- [x] 5.3 在浏览器中检查知识图谱页：节点、连线、标签、光点在冷色底上清晰可读，必要时调整色板常量；记录检查结果。结果：用临时示例资料库（不触碰真实资料库）在本地跑起来，截图确认花园在冷色底上节点、连线、标签清晰可读，知识工作台与登录界面也一致

## 6. 去除衬线字体与依赖

- [ ] 6.1 把 1.3 清单里所有 `var(--font-serif)` 引用改为 `var(--font-sans)`，再删除 `--font-serif` 定义
- [ ] 6.2 删除 `src/main.tsx` 里 `@fontsource/noto-serif-sc` 的两行引入，执行 `npm uninstall @fontsource/noto-serif-sc` 并确认 `package-lock.json` 同步更新
- [ ] 6.3 全局搜索 `noto-serif`、`Noto Serif`、`font-serif`，确认没有残留；构建后确认 `dist/` 中没有相关字体文件
- [ ] 6.4 如个别大标题在无衬线下显得单薄，调整字重而不是恢复衬线

## 7. 品牌文件与测试改写

- [ ] 7.1 `public/manifest.webmanifest` 的 `theme_color` 与 `background_color` 改为 `#f5f7fa`；检查 `index.html` 里是否有 `theme-color` 之类的 meta，并一并更新
- [ ] 7.2 `public/favicon.svg` 与 `public/favicon-32.svg` 改为浅底与蓝色叶片（取新色板中的值）
- [ ] 7.3 改写 `brand.test.ts`：断言新的主题色与图标颜色；字体断言改为"不请求 Google Fonts，也不引入任何 `@fontsource` 字体"；保留与颜色无关的原有断言
- [ ] 7.4 改写 `labContrast.test.ts` 中与旧强调色对应的断言，保留"徽章文字不靠低对比度强调色"的意图；确认"不推荐卡片不降低不透明度"仍成立

## 8. 验证

- [ ] 8.1 运行 `npm test -- --run`、`npm run test:scripts`、`npm run test:edge`、`npm run typecheck`，全部通过
- [ ] 8.2 分别运行 `npm run build`、`npm run build:cloudflare`、`npm run build:pages`，三者都成功；`build:pages` 与普通构建的产物里仍然没有 `/note/` 入口
- [ ] 8.3 全局搜索旧色板值（`#FAF6EE`、`#FFFDF8`、`#5B7B65`、`#C9794F`、`#E6DFD0`、`#3A3A34` 等），逐一确认是已评估的保留项（例如数据分类色、测试里的旧值说明），其余必须为零
- [ ] 8.4 核对红涨绿跌：热力图、涨跌幅、指数卡片在 `greenUp` 两种取值下的颜色与换肤前一致
- [ ] 8.5 用浏览器检查关键页面在 375px 与 1280px 宽度下 `document.documentElement.scrollWidth` 不大于视口宽度；宽表格仅在容器内部滚动
- [ ] 8.6 用浏览器网络面板或构建产物确认没有任何字体文件请求
- [ ] 8.7 用 8.5 的同一批页面截最终图，并与基线对比，交给使用者做最终确认

## 9. 上线

- [ ] 9.1 使用者确认后再推送；推送前先说明将触发 Cloudflare、Vercel、GitHub Pages 各构建一次
- [ ] 9.2 推送后验证线上主站关键页面样式、`/note/` 各页面不受影响（`notes-site` 的风格本变更不动）、`/api/*` 状态码不变
- [ ] 9.3 确认回退办法：`git revert` 相关提交即可恢复旧外观（只在文档中确认，不实际回退线上）
