# ETF 溢价定时入库设计（2026-10-19）

## 目标与现状

ETF 复盘页已能展示折溢价，但数据只来自浏览器打开页面时的腾讯实时报价，经 `captureDailyPremiums` 写入本地/云端 meta（`dailyPremiums`）。未打开页面的交易日没有记录；翻历史日期若当日未被记过则显示「—」。

Worker 定时任务（工作日 15:10、16:00、次日 09:00 北京时间）目前只抓分钟线与日 K，**不抓溢价**。

目标：在同一 cron 链路中抓取跟踪标的的 ETF 折溢价并写入 D1；复盘页展示历史日期时优先读云端库，补齐「没开过页」的交易日。

## 选择的方案

采用 **Cron 批量请求腾讯 `qt.gtimg.cn` + D1 表 + GET 读接口 + 复盘页回退查询**（方案 B）：

- 与前端同一字段口径（77 折溢价%、78 参考净值），无新数据商依赖
- 只能从部署日起往后积累，不回填上线前历史
- 不采用第三方历史溢价 API（成本/密钥）；不采用「只存净值再自算」（口径更脆）

## 数据模型

D1 表 `etf_premiums`：

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `code` | TEXT | 6 位代码 |
| `date` | TEXT | `YYYYMMDD`（报价日，北京） |
| `premium_rate` | REAL | 百分数，同腾讯字段 77 |
| `reference_nav` | REAL | 可空，字段 78 |
| `price` | REAL | 可空，当时最新价 |
| `fetched_at` | INTEGER | 写入毫秒时间戳 |
| PRIMARY KEY | `(code, date)` | 同日多次 cron upsert 覆盖 |

迁移：在 `notes-site/workers/grid-trading-sync/schema.sql` 增加建表；Worker 启动路径或首次写入前 `CREATE TABLE IF NOT EXISTS`（与 `cls_plate_day` 同类）。

## Cron 行为

- 挂在现有 `runSync` 末尾（分钟线 + 日 K 之后），标的集 = `trackedCodes()`（与分钟线一致）
- 分批请求 `https://qt.gtimg.cn/q=sh/sz…`（GBK 解码、字段解析规则与 `grid-trading.ts` 的 `fetchQuotes` 对齐：`fields[61]==='ETF'` 且 77 非空有限、78>0）
- 非 ETF、无溢价字段、报价日期无效：跳过，不写行
- 同日 15:10 / 16:00 / 次日 09:00：后者覆盖前者
- 抓取失败：记日志，**不**导致分钟线/日 K 结果回滚

## 读接口

`GET /premium?codes=510300,513180&from=2026-01-01`（可选 `to=`）

- 鉴权：与 `/daily` 相同，Bearer sync key ≥16
- 响应：`{ premiums: [{ code, date, premiumRate, referenceNav, price }] }`，`date` 为 `YYYY-MM-DD`
- CORS：与现有 records API 一致

## 复盘页展示

展示某 `code|date` 溢价时顺序：

1. 本地 `meta.dailyPremiums[key]`
2. 若无：请求 `/premium`（可按当前池 codes + 可见笔记日期范围批量拉取，session 级缓存）
3. 仍无：显示「—」

保留打开页面时的 `captureDailyPremiums`（盘中即时写入 meta）。云端 D1 与本地 meta 可并存，不强制双向合并。

## 边界

- 不回填上线前历史溢价
- 股票不入库
- 节假日/无有效报价不写行
- 不新增付费数据源
- Worker 子请求预算：溢价批量请求按批计数，避免拖垮日 K 预算（可与分钟线分开预算或放在日 K 之后用剩余配额）

## 验收

1. 部署后某一交易日 cron 跑完，D1 `etf_premiums` 对跟踪 ETF 有当日行
2. `GET /premium` 带合法 key 返回这些行
3. 复盘页在未打开过的历史日（但 cron 已写库）能显示溢价
4. 分钟线/日 K 同步回归正常；溢价接口失败不影响页面其他列
