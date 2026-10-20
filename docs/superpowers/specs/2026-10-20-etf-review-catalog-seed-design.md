# ETF 复盘：清单分类 seed + 操作栏外链（2026-10-20）

## 目标与现状

`/industry-etf`（主站 React）与 `/note/lab/etf-review/`（notes-site Astro）功能重叠：前者是静态研究清单（宽基 / 策略·商品·货币 / 行业组 + 分析报告·基金档案·行情网格），后者是个人复盘台（分组、笔记、网格盈亏、云端同步）。

本变更把清单里的分类**灌进复盘分组**，并在复盘行操作补上「分析报告」「基金档案」。**`/industry-etf` 本轮零改动**，站点地图与外链保持原样，后续再决定是否下线或瘦身。

## 选择的方案

采用**清单 seed 模块 + 系统分组**（方案 A）：

- 新模块 `notes-site/src/lib/etf-catalog-seed.ts` 从主站 json 读代码与名称（与 `review-analysis` 同源相对路径）
- 系统分组：`宽基 ETF` + **行业二级分类各一组**（与宽基同级，不另建「行业 ETF」总组）+ `其他 ETF`；在 `readMeta()`（及空组 reseed）末尾跑 `ensureCatalogSeed`
- 已有用户数据只补缺：不覆盖个人 membership、尊重 `deletedWatchlist` / 已 touch 的 membership 编辑
- 操作栏追加分析报告、基金档案链接

曾考虑「进页一次性导入当普通自定义组」：实现短，但删组丢语义、多端 sync 易打架。曾考虑「影子清单层不进 watchlist」：用户数据零污染，但与「灌进分组」目标不符、两套模型难统一。

## 分组与数据模型

### 保留

| id | 默认名 |
| --- | --- |
| `g-focus` | 重点观察 |
| `g-held` | 已持仓 |
| `g-backup` | 备选 |

多 membership 不变：一只 ETF 可同时挂「宽基 ETF」+「已持仓」。

### 新增系统分组

| id | 默认名 | 灌入来源 |
| --- | --- | --- |
| `g-catalog-{industryGroup.id}` | 该二级分类 `name`（如 TMT科技、医药医疗…） | `industryEtf.json` 对应组的 `items`；每个二级分类单独一组 |
| `g-catalog-other` | 其他 ETF | `strategyAssetEtf.json` 中 strategy + commodity + money |

**退役：** `g-catalog-broad`（宽基 ETF）——与个人「指标性ETF」等重叠；`ensureCatalogSeed` 会拆除组壳并剥离 membership，宽基 `sourceUrl` 仍用于基金档案。

当前行业二级共 7 组 + 其他 = **8** 个清单系统组；外加个人默认组。

**不做：** 不再创建 `g-catalog-industry` 总组、不再 seed 宽基清单组。

**明确排除：** `bond-funds`（场外债基）永不 seed。

系统组：稳定 id（随 `industryEtf.json` 的 `id`）；允许改名与改 order；**管理分组 UI 禁止删除**（清单角标）。若 meta 里缺壳（旧数据 / 异常），`ensureCatalogSeed` 补回空壳组再按规则灌 membership。json 里若删掉某个二级分类，其对应系统组停止 seed 补壳，但已有用户数据不强制删除该组。

### Seed 规则（`ensureCatalogSeed(meta) → meta`）

1. 缺系统组 → 插入（order 接在个人组后，或固定偏后如 10/11/12）
2. 标的不在 watchlist 且不在 `deletedWatchlist` 有效 tombstone 内 → 加入 watchlist（name 用清单名）
3. membership 缺该系统组 id → **追加**，不覆盖已有个人组
4. 已在 watchlist / 已挂该组 → noop
5. 用户曾编辑过某 code 的 membership（存在 `membershipUpdatedAt[code]`）且该清单组 **在本轮 seed 前已存在** → 不再强行补回该组（尊重手动踢出）。若清单组是**首次引入**（如老用户只有「指标性ETF」），即使有 `membershipUpdatedAt` 仍灌入，避免宽基/行业空壳
6. 用户「移出标的」→ 走既有 `removeWatch` + `deletedWatchlist`；seed 不得复活

**时间戳：** 清单 seed **永不**抬 `updatedAt` / `workspaceUpdatedAt`（纯写组与 membership）；用户编辑仍走既有 `touch`。这样空库保持 `SEED_TS`，云端 LWW 仍能覆盖；纯 noop 不写盘。

云端仍是同一份 `meta:etf-review-v1`；`mergeMeta` 语义不变。

## 操作栏

现有顺序扩展为：

`编辑分组` · `分析报告` · `基金档案` · `网格详情` · `移出标的`

| 按钮 | 行为 |
| --- | --- |
| 分析报告 | `latestInvestmentNote(code)` → `notesBase + slug`；无 slug **不渲染**按钮 |
| 基金档案 | 优先清单项 `sourceUrl`；否则 `https://fundf10.eastmoney.com/jbgk_${code}.html`；`target=_blank` `rel=noopener` |

改文件：`notes-site/src/pages/lab/etf-review/index.astro` 的 `rowHtml` / `.row-actions`。

## 文件与测试

| 路径 | 动作 |
| --- | --- |
| `notes-site/src/lib/etf-catalog-seed.ts` | 新建：`CATALOG_GROUPS` + `ensureCatalogSeed` |
| `notes-site/src/lib/etf-catalog-seed.test.ts` | 新建 |
| `notes-site/src/lib/etf-review.ts` | `readMeta` / 空组 reseed 末尾调用 seed |
| `notes-site/src/lib/etf-review.test.ts` | 扩：空库灌满、已有 membership 不覆盖、bond 不进、opt-out / deleted 不复活 |
| `notes-site/src/pages/lab/etf-review/index.astro` | 操作栏两按钮；管理分组系统组不可删 |

## 非目标（本轮）

- 不修改 `/industry-etf`、sitemap、主站路由
- 不 seed 债基
- 不建「行业 ETF」总组（二级分类各自成组）
- 不改 D1 schema / sync API

## 验收

1. 空 localStorage 打开复盘 → 3 个人 + 7 行业二级 + 其他；无「宽基 ETF」清单组；各行业组数量与 `industryEtf.json` 一致
2. 已在「已持仓」的行业 ETF → 仍在已持仓，并多挂对应行业清单组
3. 手动从某行业二级组（如「TMT科技」）去掉某 code 后刷新 → 不再加回该系统 membership
3b. 旧数据里的 `g-catalog-broad` 刷新后消失，membership 剥离，个人组不受影响
4. 移出标的后刷新 → 不复活
5. 有笔记的行可见「分析报告」；「基金档案」可打开外链
6. 相关单测通过

## 与既有 spec 关系

扩展 `docs/superpowers/specs/2026-10-18-etf-review-design.md` 的工作区模型与行操作；不取代该文档。
