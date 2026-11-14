# 设计文档：ETF 资金净流入页接入 BusinessWeb

状态：已批准 ｜ 规模：中型项目 ｜ 日期：2026-11-14

把「ETF 资金净流入趋势页」接入 BusinessWeb（React + Vite + Cloudflare Pages），完全采用站点现有范式（Node 快照脚本 + GitHub Actions + `public/data` + React 页 + 内联 SVG 图表）。

**计算口径的前身**：净流入公式、折算过滤、宽基名单、红绿配色等业务口径，沿用已在 `gupiaoWS` 仓库实现并经评审的那版（`output/同花顺ETF资金/设计-ETF资金净流入页.md`）。本文档只定**平台接入**，不重开业务口径讨论。

---

## 1. 意图与为什么

在已部署的 `businessweb-c0u.pages.dev` 站点里增加一个页面，展示 **全A / 宽基** 两个口径的 ETF 日度净流入（红绿柱）+ 上证指数叠加，看资金进出的**大周期趋势**。此前这块做成了独立的 Python + nginx 静态目录，技术栈与站点不符，无法部署进站；本次按站点范式重做接入。

## 2. 目标 / 非目标 / 反目标

**目标**
- 站内新增 `/etf-flow` React 页：全A/宽基切换、红绿净流入柱、上证指数叠加、时间轴、KPI（昨日、近60日累计）。
- Node 快照脚本每日收盘后产出 `public/data/etf-flow.json`，经 GitHub Actions 定时提交并触发 Pages 部署。
- 完全融入站点：单一技术栈（Node/React），复用现有抓取库与数据/部署流水线。

**非目标**
- 盘中实时预估曲线、单只资金榜（匿名不可得，彻底不做）。
- 行业/黄金/港股分类（只做全A + 宽基）。
- 与同花顺逐位对齐。
- 修复 notes-site 子项目预存的 astro tsconfig 测试加载问题（范围外）。

**反目标**
- 引入 ECharts 等新图表依赖（站点用内联 SVG，不加重依赖面）。
- 把折算/拆分日的假跳变画成巨量净流入。
- 残缺日快照毒化次一交易日前值基准。

## 3. 约束（站点范式，已勘查确认）

- 抓取库：`scripts/lib/national-team-etf.mjs` 提供 `fetchEtfUniverse`（沪深 ETF 清单，含**市价**与规模）、`fetchLastClose`。
- 数据产出：`scripts/*-snapshot.mjs` → `writeJsonIfChanged` 写 `public/data/*.json`，缓存入 `data-raw/`。
- 定时：GitHub Actions（`.github/workflows/*-snapshot.yml`）cron → 跑脚本 → 有变更即提交 `public/data` + `data-raw` 并 push → 触发 `pages.yml` 部署。
- 前端：React Router + 预渲染；图表用**内联 SVG 自绘**（参照 `src/components/pulse/ChinaMarketCharts.tsx`），无图表库依赖。
- 只用匿名公开接口；Node 24+ 原生 `fetch`。

## 4. 方案选型（已决策）

- **数据管线 1A（已选）**：净流入计算用 Node 重写为快照脚本，复用站内抓取库。备选 1B（保留 Python、仅输出到站点 data 目录）被否：CF Pages 构建管不到 Python，定时要单独养，站内多一个异类技术栈。
- **前端 2A（已选）**：站内 React 页 + 内联 SVG。备选 2B（原 index.html 丢进 public 当独立静态页）被否：不进路由、风格不统一。
- **乘数 A（已选）：市价**。净流入 = 份额差 × 单价。`fetchEtfUniverse` 白送市价，零额外请求、秒级、CI 稳。备选 B（NAV/lsjz）被否：~900 次串行、约 11 分钟，CI 易超时/限频，而收益在「大周期、不求精细」目标下几乎看不出。与 NAV 的微小差（日内溢折价通常 <0.5%）由页面「估算」声明覆盖。

## 5. 已决定的做法

### 5.1 数据来源
| 数据 | 来源 | 说明 |
|---|---|---|
| ETF 清单 + 市价 | `fetchEtfUniverse`（复用） | `{code,name,market,price,scale}`；price 为乘数 |
| 沪市份额 | `query.sse.com.cn/commonQuery.do` `sqlId=...ETFGM_SEARCH_L` 的 `TOT_VOL` | 万份×10000=份；一次批量 |
| 深市份额 | `fund.szse.cn ShowReport CATALOGID=1105` 的 `dqgm` | 当前规模万份×10000=份；一次分页 |
| 上证指数 | 复用 `public/data/index-history.json`（字段够则直接叠加），否则 `fetchLastClose` | 叠加线 |

### 5.2 计算口径（沿用已评审版）
- 单只日净流入 `flow = (份额_t − 份额_前一交易日) × 市价_t`，元；展示换算亿元。
- 全A = 所有在列 ETF 之和；宽基 = 白名单子集之和。
- 近 N 日累计用交易日序列（KPI N=60，「昨日」= 最近交易日）。
- 折算过滤：`|Δ|/前值 > 0.5` 当日该只剔除。
- 跳过：无前值（新上市）、缺当日份额（停牌）、前值为 0、缺市价。
- 红=净流入(正)、绿=净流出(负)。
- **残缺日守卫**：沪市份额为空（非交易日/未披露）即跳过不落库、不计算，防止毒化次一交易日前值基准。

### 5.3 份额基准持久化
- 前一交易日份额存 `data-raw/etf-flow/shares-latest.json`（随仓库提交，沿用 national-team 把缓存提交进 `data-raw/` 的做法）。
- 产物时间序列累加进 `public/data/etf-flow.json`：按日 `{date, flow_all, flow_broad, index}` + KPI + 更新时间 + 估算声明 note。

### 5.4 宽基白名单
- 搬成仓库内 JSON（`scripts/lib/` 或 `data-raw/etf-flow/broad-base.json`），人工维护，页面注明近似。

### 5.5 代码落位
```
scripts/etf-flow-snapshot.mjs          日度快照编排（采→算→写）
scripts/lib/etf-flow.mjs               份额抓取 + 净流入计算（纯函数，可测）
scripts/etf-flow.test.mjs              node --test / vitest 单测
data-raw/etf-flow/shares-latest.json   前值基准（提交）
data-raw/etf-flow/broad-base.json      宽基名单
public/data/etf-flow.json              前端数据（脚本生成）
src/pages/EtfFlow.tsx                  React 页
src/pages/EtfFlow.test.tsx             页面单测
src/components/.../EtfFlowChart.tsx    内联 SVG 图（或复用现有图组件）
.github/workflows/etf-flow-snapshot.yml 定时
（路由注册：在站点路由表新增 /etf-flow；导航入口按站点惯例）
```

### 5.6 定时与部署
- `etf-flow-snapshot.yml`：cron 每日收盘后（北京 ~22:30 = UTC `30 14 * * 1-5`），`workflow_dispatch` 可手动；有变更提交 `public/data/etf-flow.json` + `data-raw/etf-flow` 并 push。
- 部署沿用 `pages.yml`，push 到相应分支后自动构建发布。**公开部署前单独向用户确认**。

## 6. 留给实现者（builder）的开放项
- `index-history.json` 的 `indexes` 字段结构，能否直接取上证指数日序列叠加；不够则 `fetchLastClose` 补抓并自存历史。
- 沪/深份额两接口在 GitHub Actions 的 IP 下的稳定性（交易所偶有限频）：重试 + 「沪市空则整体跳过」。
- 份额抓取是否要进 `scripts/lib/national-team-etf.mjs` 复用其 request/UA/cookie helper，还是独立 `etf-flow.mjs`。
- 站点路由表与导航的确切注册位置、页面风格组件（PageHero/SectionChrome 等）。
- 快照脚本在测试中如何注入假 fetch（站内 helper 已支持 `fetchImpl` 注入）。

## 7. 验收标准
- `/etf-flow` 能切全A/宽基，显示红绿日柱 + 上证指数 + 可拖动时间轴，KPI 正确；套站点风格；无新增图表库依赖。
- 跑一次 `node scripts/etf-flow-snapshot.mjs` 后 `public/data/etf-flow.json` 刷新，页面随之更新。
- 折算日不出现异常巨柱；残缺日不毒化前值。
- 页面明确标注估算口径与局限（市价估算、非同花顺原口径、T+1、无盘中）。
- 新增测试绿；不回归站点现有 809 个通过用例（notes-site 预存失败除外）。
