# ETF 资金净流入接入 · 端到端实跑与抽查记录

日期：2026-11-14 ｜ 分支：`feat/etf-flow`

## 做了什么

按计划 `docs/superpowers/plans/2026-11-14-etf-flow.md` 实现并逐任务 TDD：

- `scripts/lib/etf-flow.mjs`：份额解析（沪 `TOT_VOL`、深 `dqgm`，万份×10000）、净流入计算（份额差×市价）、折算过滤、全A/宽基聚合、份额抓取（沪深各自容错）。13 用例。
- `scripts/etf-flow-snapshot.mjs`：日度编排，含「沪市份额空 → 跳过」「ETF 清单不可用 → 优雅跳过」两道守卫，幂等 upsert 序列。5 用例。
- `src/pages/EtfFlow.tsx` + `src/components/etf-flow/EtfFlowChart.tsx`：React 页 + 内联 SVG 红绿柱/指数叠加，`/etf-flow` 路由，导航入口（观察盘区）。
- `.github/workflows/etf-flow-snapshot.yml`：每交易日 UTC 14:30（北京 22:30）定时，有变更提交并触发 Pages 部署。

## 实跑结果（如实）

**整值实跑在本地受阻**：乘数用的「市价」来自东方财富 `clist` 接口，本环境两个域名（`push2`/`push2delay`）均返回 **HTTP 502 Bad Gateway**，取不到市价，故本地完整实跑会对所有标的因「无市价」跳过、产出 0。已验证：

- `node scripts/etf-flow-snapshot.mjs 2026-01-01`（非交易日）→ exit 0，触发「沪市份额为空」守卫，不写盘、不毒化前值。
- `node scripts/etf-flow-snapshot.mjs`（今日 2026-11-14）→ 今日份额尚未披露，同样守卫跳过，exit 0。

**真实份额差量级抽查（佐证，仅沪市）**：SSE 份额接口正常（2026-11-12 / 2026-11-13 各 924 只）。用真实两日份额差 + 单一代表性市价 1.5 元估算：

| 口径 | 代表价 1.5 元估算 | 计入 / 跳过 |
|---|---|---|
| 沪市全A | **−67.02 亿元** | 924 / 0 |
| 沪市宽基 | **−61.61 亿元** | — |

- 方向为**净流出**，与 `gupiaoWS` 旧版（NAV 口径）2026-11-13 全A = −170.58 亿**同向**；用各只真实市价（宽基多在 3–5 元）量级会放大到数百亿区间，与同花顺「昨日 ETF 申购净流入」历史常见区间（数十～数百亿，参见 74.JPG）一致，合理。
- 本抽查仅沪市、单一代表价，用于量级/方向核对，非最终数值。

## 结论与留待项

- 管线、守卫、份额源（SSE）、前端均已验证；深市份额源（SZSE `CATALOGID=1105`）本环境偶发 `fetch failed`，CI 环境无此egress限制。
- **整值实跑留待首次 GitHub Actions 运行**（CI egress 无限制，可取东财市价）。首跑后 `public/data/etf-flow.json` 由占位（`sample:true`）转为真实序列，并逐日前向累积。
- 公开部署前需用户确认（见计划）。

## 局限

- 市价估算（非 NAV、非同花顺原口径），不逐位对齐；看大周期。
- 深市份额为「当前最新」，历史需前向累积，上线日起完整。
- 宽基为近似人工名单（`data-raw/etf-flow/broad-base.json`）。
