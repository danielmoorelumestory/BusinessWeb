# Round2 稀疏样本 / 频率 / 来源状态 前端修复（sparse-ui）

Task `task_ece690909b9e` / Dispatch `ctx_ce690919489a`。只改了 `home.js`、`detail.js`、`detail.css`、`styles.css`（各追加少量样式）、新增 `tests/sparse_views.test.cjs` 和本报告。未改 app.js、analytics.js、fetch_data.py、provider、data-bundle.js 或任何生产数据，未提交 Git，未启动下属。

## 改动

### 1. 单期 / 样本不足的门槛（金融呈现层，PanoMath 未改）
- 门槛 `MIN_HIST = 2`：区间有效观测少于 2 个，或来源声明 `frequency=single`，就判定为「仅单期 · 历史样本不足」。
- 首页
  - 四大盘卡片：有 1 个观测时显示 `PE 23.40（日期）· 仅单期·历史样本不足`。
  - 全景榜 PE 分位列：不画分位条、不着冷热色，显示 `n=1` 和频率；按 PE 分位排序时，这类行排在有分位的行之后。
  - 跨境对照 PE 分位列：处理方式同上。
  - 多样本时保持原样，并在 n 后附上非日频的来源频率（如 `n=35 月频`）。
- 详情
  - 主卡：仍显示真实最新值和日期。「历史分位」改为「仅单期 · 历史样本不足」。不显示 20/80 带、最高/最低/均值/区间变化，也不画主图（单点图没有意义）。空态里说明单期 ECDF 恒为 100% 的原因。
  - 估值温度计：每行显示最新值、日期、样本数，标「不评冷热」，没有 meter 和冷热标签。
  - 成交热度：最新成交额照常显示，分位改为「仅单期」，不画柱图。
- 0 个观测仍走原空态；有 availability 时，空态附一句简短原因。

### 2. 频率
- 先取 `sources[f].frequency`，没有再取 `availability[f].frequency`（同时支持 fetch_data 的别名，如 month_end、单期等）。显示为「月频（来源声明）」。
- 两者都没有声明时，才按观测间隔估计，显示为「约日频（按观测间隔估计）」。只有 1 个观测时显示「无法估计频率」。
- 主卡新增覆盖说明：`区间内实际 N 个样本，覆盖 A 至 B`。如果首个样本比所选区间起点晚 31 天以上，追加「所选近10年，但样本自 A 才开始，不代表已覆盖整段区间」。
- 首页榜单脚注同步说明了上述口径。

### 3. 来源与覆盖：状态和原因
- 覆盖表新增「状态 · 原因」列：
  - 状态取值：可用 / 可用·仅单期 / 未取得 / 已拒收。
  - 主表只放一句短原因（取第一段，最多约 48 字）。
  - 完整 reason、各候选（provider、状态、样本数、日期、频率、原因）和 `rejected` 收在 `<details>查看原因</details>` 里。
- 新增成分股数行（componentNum，含 availability 原因）。
- 每行独立：某列缺数不会隐藏整张表或其他功能。
- 小卡（股息率/ROE/成交额/样本股数）、盈利对照空态、成交额空态都改为显示简短原因。没有 availability 时退回原文案。
- 所有原因文字都经过 `esc()` 转义。

## 实际命令与结果
| 命令 | 结果 |
|---|---|
| `node --check home.js && node --check detail.js` | 退出码 0 |
| `node --test tests/*.cjs` | **47/47 通过**（原有 40 项 + 新增 7 项） |
| 变异对照：把新测试指向修改前的 home.js/detail.js（备份在 scratchpad）再跑 | 7/7 全部失败，说明测试确实依赖新行为 |

新测试 `tests/sparse_views.test.cjs`：在 node:vm 中用最小 DOM stub 加载真实的 analytics.js + detail.js + home.js，断言渲染出的 HTML。覆盖内容：
- count0：原因显示和 `<img onerror>` 转义、拒收候选、details、componentNum、price 行仍在。
- count1：pe/pb/dy 三项估值和成交额都没有 100% 分位、20/80 带、meter、冷热和主图。
- count≥2：月频按来源声明显示，不是「约日频」；区间覆盖提示；三个 meter 保留。
- 无声明时按间隔估计；availability 频率可用，且 sources 声明优先。
- 首页四大盘、榜单（含 PE 分位排序置后）和跨境对照。

fixture 都是测试合成值，只存在于测试文件中。

## 浏览器冒烟（Orca 专属 QA tab）
- 环境：把前端文件复制到 scratchpad 的 smoke 目录，配一份**冒烟专用 fixture bundle**（由生产 bundle 抽 6 只指数，加入合成单期/月频估值、含 HTML 的 reason）。用 `python3 -m http.server 18766` 在 127.0.0.1 上提供。生产 `data-bundle.js` 未改。
- 用 `orca tab create` 新建自己的 tab `de9549e2…`。manager tab `302915a1…` 和用户 tab `4bdde8d8…` 都没有碰。
- 实际观察结果：
  - 首页：卡片显示「PE 23.40（2026-11-13）· 仅单期·历史样本不足」和「近10年分位 100.0%（n=35 月频）」；榜单和跨境中的单期行显示「仅单期·历史样本不足 n=1」。
  - 399001 详情：主卡、温度计、成交热度都按单期规则显示；`<b>汇总</b>` 和 `<script>` 以文本形式出现，没有被注入（`.pd-cov script` 计数为 0）。
  - 399006 详情：显示「月频（来源声明）」和「样本自 2024-01-31 才开始」，分位、20/80 带、meter 都正常；成交额显示「约日频（按观测间隔估计）」。
  - 1280 宽桌面截图版面正常；296px 窄屏没有横向溢出（docW 281）。
- 收尾：已关闭自建 tab 并停止 http.server，确认 tab list 只剩上述两个原有 tab。

## 未验证 / 风险
- 两个数据 provider 还没进生产 bundle，当前生产数据没有 availability，估值全空。真实 availability 的显示目前只用 fixture 验证过，需要在 manager 重建 bundle 后再在浏览器里复查。
- 「来源声明 single，但累计了 ≥2 个观测」这种情况也按单期处理、不出分位。这是有意从严，如果 manager 希望累计快照可以计算分位，需要另行确认。
- 样本数 ≥2 但很少的情况（例如 2–59 个）仍按原逻辑显示分位，首页标「样本少」。门槛只针对单期。
- 没有改 app.js 的 CSV 导出或导入，导入数据没有 availability 时退回原文案。

---

# 追加：市值口径 marketCapBasis（Task `task_28669d06cda0` / Dispatch `ctx_1da26ddaf872`）

## 改动（只改了 detail.js 和测试；home.js 本来不显示 mcap，无需改）
- mcap 的显示名取自 `sources.mcap.marketCapBasis`；如果没有，再看 `sources.mcap.metadata.marketCapBasis`：
  - `free_float` →「自由流通市值」（也接受 freefloat、free-float 两种写法）
  - `total` →「总市值」
  - 缺失或未知值 →「市值（口径未注明）」，**不默认当作总市值**。
- 静态默认标签从「总市值」改为「市值（口径未注明）」。显示名由 `metricInfo`/`labelFor` 按当前指数解析，以下位置统一使用：
  - 指标按钮
  - 主卡标题和空态文案
  - 主图系列名，以及 tooltip（tooltip 显示的就是系列名）
  - 图表 aria-label
  - 覆盖表的字段名
- mcap 主卡的覆盖说明会附上口径：
  - 有声明：「口径：自由流通市值（来源声明）」。
  - 无声明：「来源未注明总市值/自由流通口径，不按总市值解读」。
- mcap 数值、单位（亿元，≥1 万亿时显示为万亿元）、schema 和 analytics 都没有变。之前的单期门槛和来源频率逻辑保持不变。

## 实际验证
| 命令 | 结果 |
|---|---|
| `node --check detail.js` | 0 |
| `node --test tests/*.cjs` | **52/52 通过**（原有 47 项 + 新增 5 项） |
| 变异对照：用修改前的 detail.js 跑新测试 | 新增的 5 项 mcap 测试全部失败，之前的 7 项仍通过 |

新增测试共 5 项，用 echarts stub 捕获主图 option：
- 4 种口径各 1 项：free_float、total、未声明、未知值 `weird`。每项断言按钮、h3、统计数值格式、口径说明、覆盖表、主图系列名和 tooltip 文本；非 total 口径时，页面上除警示语外不能出现「总市值」。
- 1 项验证 `metadata.marketCapBasis` 能被识别，且只有一期的 mcap 仍走单期门槛（没有 20/80 带，不画主图）。

浏览器冒烟：新建了自己的 Orca tab（`fe74064c…`），数据是 scratchpad 里的 fixture，市值为合成值：000300 设为 free_float，399001 设为 total，399006 不声明口径。三只指数逐个切换到市值指标，结果如下：

| 指数 | 按钮、h3、ECharts 系列名、覆盖表 | tooltip | 页面「总市值」出现次数 |
|---|---|---|---|
| 000300 | 自由流通市值 | 「自由流通市值：51.59 万亿元」 | 0 |
| 399001 | 总市值 | 「总市值：51.59 万亿元」 | 4 |
| 399006 | 市值（口径未注明） | 「市值（口径未注明）：51.20 万亿元」 | 1（除去「不按总市值解读」后统计，剩下的是警示语「来源未注明总市值/自由流通口径」） |

收尾：已关闭自建 tab，停止 http.server。manager 和用户的 tab 都没有碰。

## 未验证
- 真实 mcap 和 `marketCapBasis` 还没进生产 bundle（集成 owner 会稍后连同 source.metadata 一起接入），需要等接入后在真实数据上复查。
- app.js 的 CSV 列名 `mcap` 不归我负责，没有改。
