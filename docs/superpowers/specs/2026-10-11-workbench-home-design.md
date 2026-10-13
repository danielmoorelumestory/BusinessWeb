# 工作台首页与全站快速跳转 · 设计文档

日期：2026-10-11　状态：待用户审阅

这是「整站体验优化」三个子项目中的第一个：

1. **工作台首页 + 快速跳转**（本文）
2. 统一组件层：PageHeader / Card / Stat / DataTable / Tabs，按使用频率迁移老页面，去掉内联样式
3. 移动端适配：内建在 2 的组件里，另外单独补阅读页和图表

2、3 另写 spec，本文不涉及。

## 1. 背景与目标

用户的说法：站点主要给自己用，其次给别人看。痛点有四个：常用页面太深、首页对自己没用、各页风格不统一、手机上难用。本子项目解决前两个。

现状：

- 首页 `src/pages/Home.tsx` 是给读者看的：书名首屏、三个栏目、投资大师名句。用户本人打开后还得再跳一次。
- 估值、DCF、网格、公司研究这些常用工具都挂在 `/invest` 栏目页下面，要点两次，有的要先滚动才找得到。
- 全站约 40 个路由，没有搜索或快速跳转。

成功标准：

1. 打开首页，第一屏（1280×800 和 390×844 两种视口）就能看到常用工具入口，一次点击直达。
2. 任何页面按 ⌘K / Ctrl+K（或点顶栏的搜索按钮）都能打开跳转面板，输入两三个字、按回车就到目标页，全程不用鼠标。
3. 首页显示本机已有的记录（网格、DCF、估值、候选池），点一下回到对应页面。没有记录时这一块不出现，访客看不到空壳。
4. 读者入口还在：书名、「开始阅读」「看目录」保留在首页，只是不再占第一屏。
5. 所有现有路由路径不变，`npm test`、`npm run typecheck`、`npm run build` 通过。

不在范围内：改任何工具页面的内部逻辑和样式；搜索公司或正文内容（只搜页面）；登录、云同步；新增路由。

## 2. 首页结构（自上而下）

### 2.1 工作台头部

- 一行标题「工作台」，右侧是一个宽搜索框样式的按钮「跳转到页面… ⌘K」，点击打开跳转面板（见第 3 节）。手机上这个按钮占满一行。
- 不放问候语，也不放日期之类的装饰。

### 2.2 常用工具（固定 8 个）

用卡片网格展示：桌面 4 列，平板 2 列，手机 2 列。每张卡是图标、名称和一行说明，整张卡可点，高度不小于 44px。

| 名称 | 路径 |
|---|---|
| 公司研究 | `/research-notes` |
| 公司估值 | `/valuation` |
| DCF | `/dcf` |
| 网格交易 | `/grid-trading` |
| 宏观温度 | `/monitor` |
| 国家队持仓 | `/invest/national-team` |
| 知识图谱 | `/knowledge` |
| 我的书 | `/first-book` |

列表写成 `src/data/siteMap.ts` 里的常量 `WORKBENCH_TOOLS`。说明文字复用 `INVEST_GROUPS` 里对应条目的 `desc`，避免两处维护。不在 `INVEST_GROUPS` 里的（知识图谱）单独写。

不做「自定义固定」：工具就这么几个，改常量比做设置界面划算。

### 2.3 最近访问

- 记录本机最近访问的 6 个页面（去重，最新的在前），存在 `localStorage` 的 `businessweb.recent-pages.v1` 里。
- 只记跳转面板里能搜到的页面（也就是页面注册表里的条目，见 3.1）。首页本身、404、详情页（`/research-notes/:market/:code` 等）不记录。
- 展示成一行横向的胶囊链接，手机上可以横向滚动。
- 列表为空、或 `localStorage` 不可用时，整块不渲染。

### 2.4 我的记录

读取本机已有的四类数据，每类一张小卡，写明「N 条 · 最近：<名称> · <日期>」，点击跳到对应页面：

| 类别 | 数据来源 | 跳转 |
|---|---|---|
| 网格记录 | `features/grid-trading/repository.ts` 的 `readRecords()` | `/grid-trading/records` |
| DCF 记录 | `features/dcf/storage.ts` 现有的读取函数 | `/dcf` |
| 估值报告 | `features/valuation/storage.ts` 现有的读取函数 | `/valuation` |
| 候选池 | `features/candidates/store.ts` 的 `loadLocal()` | `/research-notes` |

- 只用这些模块已经导出的读取函数，不改存储格式。哪个模块没有合适的导出，就在该模块里补一个只读函数。
- 某一类没有数据就不显示那张卡，四类都没有就整块不渲染。
- 读取失败（数据损坏、`localStorage` 抛错）按「无数据」处理，不让首页报错。

### 2.5 读者区

- 一条横幅，放《正念投资》书名、副标题「不盯盘、不预测的普通人投资方法」、「开始阅读」和「看目录」两个按钮，以及现有的小书封。比现在的首屏矮，高度大约是现在的一半。
- 下面保留三个栏目卡片（投资 / AI实验室 / 自由空间），文案不变（含 `***` 与目标 400 万）。

### 2.6 投资大师名句

从首页移到「关于」页 `/about` 底部，组件和数据都不变。首页因此变短。

### 2.7 预渲染与首屏

`scripts/prerender-routes.mjs` 不预渲染首页，`src/main.tsx` 用的是 `createRoot`，不存在水合问题。2.3 和 2.4 在首次渲染时同步读 `localStorage` 即可，不会闪一下空白再出现。

## 3. 跳转面板（⌘K）

### 3.1 页面注册表

在 `src/data/siteMap.ts` 新增 `SEARCHABLE_PAGES`，由已有数据拼出来，不另外手写一份：

- `NAV_ITEMS`：一级栏目
- `INVEST_GROUPS` 里所有链接：带上分组名；`archived` 的标「已舍弃」并排到最后
- AI 实验室的方向页：取自 `src/data/aiLab.ts` 的 `LAB_DIRECTIONS`，路径 `/ai/<slug>`，外加 `/ai/fullstack-roadmap`
- 其他不在上面这些里、但有固定路径的页面：网格记录 `/grid-trading/records`、读书 `/first-book/slow-is-fast`（目录），在一个小数组里补齐

每条数据包含 `path`、`label`、`group`、`desc?`、`archived?`。

### 3.2 交互

- 打开方式：⌘K / Ctrl+K（任何页面，输入框里也生效）；`/`（焦点不在输入框时）；点击顶栏的搜索按钮；点击首页工作台头部的按钮。
- 面板是 `role="dialog"` + `aria-modal`，打开时焦点进输入框，Esc 或点遮罩关闭，关闭后焦点还给原来的元素，Tab 不会跑出面板。
- 输入为空时先列「最近访问」（来自 2.3），再列全部页面并按分组排。
- 匹配规则：把关键词按空格切开，每个词都要在 `label + group + desc + path` 里出现（不分大小写）。排序：label 开头匹配 > label 包含 > 其他字段包含；已舍弃的永远排最后。不做拼音和模糊匹配。
- 键盘：↑/↓ 移动高亮，回车跳转，高亮项自动滚动到可见区域。鼠标悬停也会改高亮。
- 跳转后关闭面板，并写入最近访问。
- 手机（宽度小于 768px）上面板全屏，输入框在顶部，列表项高度不小于 44px。

### 3.3 顶栏

`src/components/Header.tsx`：

- 桌面：导航右侧加一个搜索按钮，图标加「⌘K」提示（Windows/Linux 显示「Ctrl K」）。
- 手机：汉堡按钮左边加一个搜索图标按钮，点击直接打开全屏面板。
- 导航的 6 个一级栏目不变。

## 4. 组件与文件

| 文件 | 改动 |
|---|---|
| `src/data/siteMap.ts` | 新增 `WORKBENCH_TOOLS`、`SEARCHABLE_PAGES`、`searchPages(query)`（纯函数） |
| `src/features/recent-pages/store.ts` | 新增：`readRecent()`、`pushRecent(path)`，内部 try/catch |
| `src/features/recent-pages/useTrackRecent.ts` | 新增：监听路由变化，命中注册表就调用 `pushRecent` |
| `src/components/CommandPalette.tsx` | 新增：面板 UI 加全局快捷键，用 context 暴露 `open()` |
| `src/features/workbench/localRecords.ts` | 新增：汇总四类本机记录，返回 `{ kind, count, latest? }[]`，内部 try/catch |
| `src/pages/Home.tsx` | 按第 2 节重写 |
| `src/pages/About.tsx` | 底部加名句区 |
| `src/components/Header.tsx` | 加搜索按钮 |
| `src/App.tsx` | 挂上 `CommandPalette` provider 和 `useTrackRecent` |
| `src/styles/home.css` | 重写首页样式；面板样式放 `src/styles/command-palette.css` |

样式只用 `src/index.css` 里已有的 token（`--bg-card`、`--accent`、`--border-subtle`、`--radius-*` 等），不新增颜色。

## 5. 错误处理

- `localStorage` 不可用（隐私模式、被禁用）：最近访问和我的记录都不渲染，跳转面板照常可用，只是没有「最近访问」分组。
- 记录数据损坏：该类按无数据处理，`console.warn` 一次。
- 注册表里的路径失效：由测试兜底（见第 6 节），不在运行时处理。

## 6. 测试

- `siteMap.test.ts`：`SEARCHABLE_PAGES` 的路径不重复，每条都能在 `App.tsx` 的路由里匹配到；`WORKBENCH_TOOLS` 的路径都在注册表里；`searchPages` 的多词匹配、排序和「已舍弃排最后」。
- `recent-pages/store.test.ts`：去重、最多 6 条、`localStorage` 抛错时返回空数组。
- `localRecords.test.ts`：四类数据有、无、损坏三种情况。
- `CommandPalette.test.tsx`：⌘K 打开、Esc 关闭且焦点归还、输入后回车跳转、↑/↓ 移动高亮。
- `Home.test.tsx`：更新现有用例。常用工具 8 个链接都在；书名和「开始阅读」还在；`localStorage` 为空时不出现「最近访问」「我的记录」标题；`***` 与 400 万的用例保留。
- `About.test.tsx`：名句区出现。
- `Header.test.tsx`：搜索按钮存在，点击后面板打开。
- 人工验收：`npm run dev`，在 1280 和 390 两种宽度下看首页第一屏，以及跳转面板的键盘操作。
