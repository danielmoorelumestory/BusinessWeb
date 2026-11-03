# ETF 复盘指标保存与刷新

`/note/lab/etf-review/` 的日、周、月 MA/MACD/RSI 由 `grid-trading-sync` Worker 计算，结果存入 D1 的 `review_technical` 表。原始日K和复权偏移仍保存在 `daily_bars`、`daily_offsets`。

## 页面读取

1. 先从浏览器 `etf-review-technical-v1` 缓存展示已保存结果。
2. 缓存仍新鲜时，不请求指标接口、不下载历史K线、不重新计算。
3. 缓存过期或缺失时，批量 `GET /review/technical?codes=...` 读取D1。
4. 仅D1仍缺失或过期的代码，调用 `POST /review/technical?code=...` 由后台抓取行情、更新K线、计算并保存三周期结果。

两个接口沿用网格同步密钥的 Bearer 认证。GET不拉取行情；POST带有数据库租约，多个设备请求同一代码时不会重复抓取。更新失败不覆盖已保存结果，页面保留旧值并显示错误。

## 新鲜度

- 交易时段按北京时间每15分钟划分刷新窗口。
- 午休复用11:30之后结果；15:10之后、周末与次日开盘前复用最近收盘窗口结果。
- 交易所节假日没有独立日历，工作日按上述窗口检查；源数据日期始终保留，不把旧K线改成当天。
- 当前报价/涨跌幅仍走独立的60秒报价缓存，和历史K线、指标快照分开。

## 后台任务

`wrangler.jsonc` 额外配置交易时段的15分钟任务，仅处理过期指标；原分钟线/CLS定时任务保留。跟踪范围包含有效网格记录及 `etf-review-meta.watchlist`，排除删除墓碑。受单次子请求预算限制时，按最久未更新的标的优先处理，其余留待下一轮；页面也可触发缺失数据补算。

表通过幂等 `CREATE TABLE IF NOT EXISTS` 自动初始化，DDL同时保留在Worker的 `schema.sql`。指标算法/存储格式变更时递增 `review-technical.ts` 的 `TECHNICAL_VERSION`，使旧快照失效。

## 验证

- 客户端缓存、到期规则：`src/utils/reviewTechnicalCache.test.ts`
- SQLite实测D1查询、入库、并发租约、失败保留旧值、观察池跟踪：`notes-site/workers/grid-trading-sync/src/review-store.test.ts`
- 三周期独立计算及显示：`src/utils/reviewMultiPeriodSignals.test.ts`

真实接口验收应依次检查：首次POST返回 `refreshed: true`，GET可读取同一快照，再次POST返回 `refreshed: false` 且 `updatedAt` 不变。
