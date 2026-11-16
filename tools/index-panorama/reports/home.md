# 首页、应用壳与导航 · 实现报告（Claude 首页 worker）

## 实现文件（只写了我负责的文件）

| 文件 | 内容 |
|---|---|
| `index.html` | 应用壳：顶栏（工具名“指数全景”、数据日期、导入/导出）、侧栏（搜索、收藏、分类）、主视图、导入对话框 `<dialog>`。脚本顺序按契约：echarts → data-bundle → analytics → detail → home → app，同时引入 `detail.css`。没有登录、会员或联系方式入口。 |
| `styles.css` | 全局主题：浅灰底、白卡、深蓝主色、金色辅助，红涨绿跌；布局、表格、热力格、相关矩阵、对话框；窄屏（≤900px）下侧栏改为抽屉加遮罩，≤560px 时四大盘卡片单列；表格可横向滚动；有 `:focus-visible` 样式和 reduced-motion 支持。 |
| `home.js` | `window.PanoHome = {render, dispose}`，另附非契约的 `util` 供 app 复用。内容：四大盘卡片（含近1年迷你线）、全景榜（默认/涨跌/PE分位/股息率排序，再点一次反向；按分类和收藏筛选）、分类平均涨跌热力、跨境对照（以沪深300为参照）、多指数叠加（最多8只，共同起点=100，可用下拉框加入，有四大盘/核心宽基/收藏/清空快捷按钮）、周收益率相关性矩阵（含样本数 n）。所有行和卡片都能点进详情。 |
| `app.js` | `window.PanoApp`：hash 路由 `#/panorama` 与 `#/index/<encodeURIComponent(code)>?range=&metric=`；侧栏分类、搜索（回车直接进入第一个匹配，`/` 键聚焦搜索）、收藏（localStorage 读写都包了 try/catch，失败时提示“仅本次有效”）；CSV 导入校验与合并（仅本次会话有效）、导出当前指数 CSV、下载空模板；窄屏导航开合、Esc 关闭、对话框焦点归还。纯函数部分在没有 DOM 时也能被 node `require`。 |
| `tests/app.test.cjs` | 二审后 manager 指派给我：CSV、路由、合并的 node 测试（16 项） |
| `reports/home.md` | 本报告 |

## 遵守的契约要点

- 统计全部走 `PanoMath.stats/compare`，首页没有另写统计。PanoMath 缺失时，分位、叠加和相关矩阵显示空态，顶部给出“模块未加载”提示。
- 详情页调用 `PanoDetail.render(host, series, {range, metric, anchor: asOf, onChange})`。`onChange` 回调里用 `history.replaceState` 把 range/metric 写回 hash，不重复渲染；前进/后退靠 `hashchange` 重新渲染。PanoDetail 缺失时只显示基础信息加空态。
- 日期标注：涨跌只取与最新收盘同一行的 `chg`，不跨日拼接。PE/PB/股息率/成交额的日期如果和收盘日不同，在数值下方用灰色小字单独标出。分类平均只统计每组“最新收盘日”当天有涨跌数据的成员，其他日期的成员标 `*`，不计入平均，并写明数量。
- 不编造任何数值：缺数据统一显示“—”或明确的空态文字。四大盘里如果某个代码不在数据包中（例如当前数据没有 399001.SZ），显示虚线框的缺失卡。
- 首页的 range 默认 `'10'`，anchor 用 `dataset.asOf`。近1年区间涨跌用 `stats(s,'price','1').changePct`，只对 price 这样命名。
- 两个 JS 文件都用 IIFE；没有网络请求（grep 过，无 `fetch`/XHR/外链），也没有调用参考站。

## CSV 导入规则（app.js）

- 解析器自己写的，没有依赖 `PanoMath.parseCSV`：支持 UTF-8 BOM、引号、`""` 转义、引号内的逗号和换行、CRLF；引号未闭合或字段中间出现裸引号时报错。
- 表头必须有 `code,name,date`，并且至少有一个数值列；表头重复报错，未知列给警告后忽略。
- 每行校验：code 格式、name 非空；日期要是真实日历日（闰年校验正确），接受 `YYYY-MM-DD`、`YYYY/M/D`、`YYYYMMDD`，统一转成 ISO；category 留空或必须在 6 个分类里。
- 数值必须是有限数。空串和 `-`/`--`/null/NaN/N/A 当缺失（null），**不当 0**；`%`、`1,0`、`Infinity`、`0x10` 都报错；price 必须 >0，mcap/amt/turn/volume/dy 不能为负，PE 允许为负。每行至少要有一个有效数字。
- 同一文件里同 code 同日的多行：数值不冲突就合并，冲突报错。
- **整份文件原子导入**：任何一处错误都会拒绝整个文件，最多列出 30 条错误，原数据不动。通过后生成新的 series 对象，原对象不被修改（已有测试断言）。同 code 按日期合并：导入的值覆盖同日已有值，空单元格保留原值，日期升序去重，12 个字段数组都和 d 等长。
- **PE/PB 整列替换（二审修复）**：估值口径不跨来源拼接。CSV 只要为某个代码提供了任一非空 PE（或 PB），这一列就整列替换：只保留本次 CSV 实际提供的日期观测，原来源该列的其他值全部清空，`sources.pe/pb` 换成导入来源（method 注明“整列替换”），同时在 warnings 里写明原来源本次会话不再使用。原列为空（比如 PB）时等于直接补全。CSV 虽有 pe 列但该代码全为空时，不替换。清空后整行只剩空值的日期会被去掉。导入对话框里有醒目的规则说明，导入摘要会列出被替换的“代码 字段”和清除的值数。price 等其他字段仍按日期合并。
- **外部值做字典键（二审修复）**：app.js 和 home.js 中所有以 code、日期、表头、分类、hash 参数为键的字典都改成 `Object.create(null)`（`dict()`），包括 MISSING_TOKENS。现在 `constructor`、`toString`、`hasOwnProperty`、`valueOf` 可以作为代码导入、二次合并，也能打开详情；表头写 `constructor` 不会被当成已有列。`__proto__` 因为不符合“首字符为字母或数字”的规则，按格式错误拒绝。
- 其他字段覆盖了原来源时，往 `series.warnings` 写入口径警告。原来没有来源的字段，补上 `sources[field] = 用户导入CSV（本次会话）`。新代码归到侧栏的“导入（本次会话）”分组。顶栏显示“本次会话导入 N 只”，对话框文案写明刷新后丢失。
- 导出：16 列表头，带 BOM，CRLF 换行，null 输出为空单元格，按需加引号；导出的文件可以原样再导入（已测往返）。

## 实际命令与结果

```
node --check app.js                 → exit 0
node --check home.js                → exit 0
node --test tests/app.test.cjs      → tests 16, pass 16, fail 0, exit 0
node --test tests/analytics.test.cjs → exit 0（详情 worker 的文件，只读运行，确认我的改动未影响）
node -e 'require("./app.js").validateImport("code,name,date,price\nconstructor,测试,2026-11-13,100",[])'
  → ok:true（二审复现用例，修复前会抛 Cannot read properties of undefined）
```

`tests/app.test.cjs` 覆盖：BOM、引号、引号内换行；空串不当 0；闰年和非法日期；有限数、%、负价；必填列和必填值、未知分类、多余列、引号未闭合；部分列加未知列警告；同日重复的一致合并和冲突报错；整份拒绝且原对象不变、按日期合并覆盖；新代码分组、导出往返和引号转义；路由解析（含特殊字符编码、坏参数白名单、坏的 `%` 编码 → 未找到）。二审回归：原型属性名做 code、表头、hash 参数；PE 整列替换（旧中证 PE 被清空，来源和警告更新，price 仍按日期合并，cleared 计数正确）；PB 原本全空时补全且 PE 不受影响；pe 列全空时不替换；清空后的空行被去掉。

### 我自己的无头 Chrome 冒烟测试（chrome-devtools MCP，独立的 isolatedContext，没有用 Orca 页面）

1. 在 scratchpad 复制一份页面，配上**测试专用的合成 data-bundle**（只在 scratchpad，没有写进项目），加载真实的 analytics.js 和 detail.js，通过 file:// 打开：
   - 首页所有区块正常渲染，控制台无错误（唯一一条“form field 缺 name”已修复）。
   - 点击榜单行进入 `#/index/000300.SH`，PanoDetail 正常渲染，导出按钮可用，侧栏对应项有 `aria-current`。
   - 侧栏切换指数，然后 back/back/forward 三步，hash 和标题都正确。
   - 未知代码页和非法路由页都有“返回全局页”。
   - 收藏写入 localStorage，侧栏收藏分组同步更新。
   - 排序（涨跌、PE 分位）、区间切换会同时重算榜单、叠加和相关性。
   - 搜索“红利”加回车直接进入详情。
   - 在详情页切换“近3年”后，hash 经 replaceState 变成 `?range=3&metric=pe`（file:// 下可用）。
   - 导入 bad.csv：提示“导入失败…原有数据未改变”，列出非法日期和 name 为空两条错误，指数数量不变。导入 good.csv（BOM、引号内逗号、一个新代码加一个合并）：成功，摘要正确，新指数可以进入详情。关闭对话框后焦点回到“导入 CSV”按钮。
   - 导出时拦截 Blob：文件名为 `000300.SH_沪深300_<末日>.csv`，表头正确，导入的 pb 已合并进去。
   - 窄屏 390 宽：没有横向滚动。☰ 打开抽屉后焦点在搜索框，`aria-expanded=true`；Esc 关闭后焦点回到 ☰；点选指数后抽屉自动关闭；表格在容器内横向滚动。
2. 直接用 file:// 打开项目里**真实的** `index.html`（当时数据 worker 的 bundle 已落盘，26 只，asOf 2026-11-10）：首页正常，控制台无 error/warn。当时这份数据**没有 399001.SZ**，四大盘中这一格显示缺失卡；所有指数的 PE 都为空，表格显示“—”，分位显示空态，属于预期行为。测试后已清掉我写入的收藏 localStorage。

## 未验证 / 已知风险

- **桌面和窄屏的完整视觉验收、真实 Safari/Firefox，交给 manager 统一做。** 我只在 Chrome（headless MCP）里测过。
- 没有原生 `showModal` 的老浏览器会走 `open` 属性回退加手动 Esc，这条路径只做了代码层检查，没有实测。
- 文件 input 是视觉隐藏的，焦点通过 label 的 `:focus-within` 显示；屏幕阅读器的朗读效果未验证。
- 下载在 file:// 和 http 下走 `a[download]`，在 Chrome 中触发正常（拦截 Blob 验证过），没有实际检查落盘的文件。
- ≤560px 时顶栏的“导出当前指数 CSV”按钮隐藏，导出入口改用详情页顶部的“导出此指数 CSV”。
- 全景榜每次渲染要对每只指数调用一次 `PanoMath.stats(pe)`。26 只没有感觉到卡顿，指数数量涨到几百只时可能需要缓存。
- 首页数值依赖数据 worker 和详情 worker 的最终产物。PE 分位等字段目前在真实 bundle 中为空，实际效果要等数据补齐后由 manager 复核。
- 二审修复后又做了一次浏览器冒烟（合成数据，在 scratchpad 中）：导入含 PE 和 `constructor` 代码的 CSV，摘要显示“PE/PB 整列替换：000300.SH pe，清除 3093 个值”。详情页和全景榜的 PE 分位只基于导入的 2 个观测（n=2，标“样本少”），`#/index/constructor` 能正常打开详情，控制台无错误。
- PE/PB 整列替换后，详情页会按导入来源展示。详情页脚注文字是否需要进一步说明，由详情 worker 或 manager 决定。


## 二审追加 P1：统计锚点随数据刷新（第二次派发）

**问题**：`state.asOf` 只在初始化时从 `dataset.asOf` 读取。导入 CSV 补入晚于数据包的日期（例如 bundle 截至 11-10，CSV 新增 11-13）后，首页最新收盘已经显示 11-13，但 PE 分位、叠加和详情 `sliceSeries` 仍以 11-10 为锚点，把新日期截掉，表格与详情前后矛盾。

**修复**（只改了 app.js、home.js、tests/app.test.cjs 和本报告）：
- 新增纯函数 `maxObservationDate(list)`：返回所有序列中“任一字段为非空有限数”的最新合法 ISO 日期。全空行、`Infinity`、非法日期都不算。
- 新增 `statsAnchor(baseAsOf, list)`：锚点取 max(数据包 asOf, 实际最新观测日)。这样跨境数据晚于 A 股 asOf 时也能覆盖到。
- 新增纯函数 `importText(list, text, fileName, baseAsOf)`，依次做校验、合并、重算锚点。失败时不返回 list 和 anchor，`handleFile` 只在成功时同时提交数据和锚点，所以失败导入不会改变锚点。
- 状态拆成三项：`baseAsOf`（原数据包截至日，只用于展示，导入不改它）、`baseAnchor`（初始加载时算出）、`anchor`（初始加载和每次成功导入后重算）。首页 `stats/compare` 和详情 `PanoDetail.render` 的 anchor 都改用 `state.anchor`。
- 文案：顶栏始终显示“数据包截至 <bundle.asOf>”。锚点晚于它时，另加一个标签：
  - 锚点来自跨市场数据时：“统计截至 X（部分跨市场数据晚于数据包 Y）”；
  - 锚点来自导入时：“本次会话统计截至 X（含导入数据；原数据包截至 Y）”，金色。
  首页页头同步显示这句话。导入摘要写明“统计锚点已更新 Y → X……这是本次会话导入数据的日期，不代表原数据包已更新”。
- 顺带修了 home.js 的一个 bug：叠加区按“清空”后，下一次重绘（例如切换区间）会把四大盘默认值加回来。现在只在首次渲染时给默认选择。

**验证**：
```
node --check app.js / home.js          → exit 0 / 0
node --test tests/app.test.cjs         → tests 19, pass 19, fail 0, exit 0
node --test tests/analytics.test.cjs   → exit 0（他人文件，只读运行）
```
新增 3 个回归测试，测试中调用真实的 `analytics.js`：
1. `maxObservationDate` 与 `statsAnchor`：空列表、末行全空、非法日期、Infinity、跨境数据晚于 asOf、asOf 晚于观测、asOf 无效。
2. baseAsOf=11-10 加 CSV 新增 11-13（已有指数 A 和全新指数 NEW.X）：
   - `importText` 返回 anchor=11-13；
   - `stats(price,'1',anchor).latestDate` 为 11-13；
   - PE 统计的日期保持自己的 11-10，样本数 5；
   - `sliceSeries` 末日为 11-13；
   - 新指数 count=2；
   - `compare` 的共同日期为 [11-13]；
   - 同时断言旧锚点会截掉 11-13，用来证明修复前确实矛盾。
3. 失败导入：`ok=false`，没有返回 anchor 和 list，原对象不变，锚点仍是 11-10。

**真实页面验证**：在独立的无头 Chrome 里用 file:// 打开项目中真实的 index.html。真实 bundle 的 asOf 为 2026-11-10，最新观测也是 2026-11-10，共 26 只。
- 初始：顶栏“数据包截至 2026-11-10”，页头“统计截至 2026-11-10”。
- 导入含非法日期的 CSV：失败，顶栏和页头不变。
- 导入 `000300.SH 2026-11-13` 加两行 `NEW.X`：
  - 导入摘要写明锚点从 11-10 更新到 11-13；
  - 顶栏仍是“数据包截至 2026-11-10”，并加上“本次会话统计截至 2026-11-13（含导入数据；原数据包截至 2026-11-10）”；
  - 全景榜和跨境表中沪深300 为 11-13 收盘 4100；
  - 沪深300 详情选近1年，区间为 2025-11-13 至 2026-11-13，最新值 4,100.00，日期 11-13；
  - NEW.X 详情的区间同样包含 11-12 和 11-13；
  - 叠加区选择沪深300 和 NEW.X，共同区间为 2026-11-13 至 2026-11-13；
  - 相关矩阵中 n=0，显示“—”，符合契约；
  - 按清空再切换区间，选择仍为空；
  - 控制台无 error 或 warn。

**未验证**：
- 锚点前移后，详情页内部各图（回撤、温度计等）是否全部用传入的 anchor，属于详情模块的实现，我只确认了主图区间和最新值。
- 数据包本身含晚于 asOf 的跨境数据时，“跨市场”这条文案目前只有单测覆盖。当前真实 bundle 里 asOf 与最新观测相同，触发不到这个分支。
