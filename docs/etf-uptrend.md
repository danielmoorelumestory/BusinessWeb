# ETF 主升浪

页面：`/note/lab/etf-uptrend`（notes 实验页，入口在主站「投资 → 观察盘」和 `/note/lab`）。

## 数据从哪来

同花顺「ETF 主升浪」H5 页面使用的公开接口，不需要登录：

- 名单：`POST https://fund.10jqka.com.cn/quotation/fund_pool/v2/query`，`businessKey=etfUpTrend`。全量池之外，同一接口取趋势回踩（`last_day_step_signal`）、新入池（`new_up_trend`）两个筛选，T+0、行业板块、宽基指数三个子池，以及「同类ETF仅展示一只」（`custom.uniqueTracking=true`）。
- 单只 ETF 历史上涨区间：`GET https://eq.10jqka.com.cn/open/api/etf_rank/etf/uptrend/v1/period/etf/{market}/{code}`。
- 区间上涨原因（同花顺 AI 生成）：`GET .../ai/insights/{market}/{code}/{start_day}`。

`market` 是同花顺 ETF 市场标识（20、36），不是股票的 17/33。

## 没有的数据

今日涨幅、盘中累计涨幅、连续上涨天数、涨停股数量/占比来自 `dataq.10jqka.com.cn` 的指标接口，未登录返回 401，这里不采集也不用别的数据冒充。名单是来源原序，不是涨幅排行。`period_rise` 截至区间 `end_day`，不等于 App 上的盘中累计涨幅。历史快照从 2026-11-13 起积累，不回填。

## 每日采集

`.github/workflows/etf-uptrend.yml`：北京时间每天 20:30 运行，21:30、22:30 为失败补跑（当天已在 20:30 之后成功就跳过）。脚本 `scripts/etf_uptrend.py` 只用 Python 标准库：

- 名单接口 30 秒超时、5 次指数退避重试；请求顺序发出，间隔 0.35 秒。
- 历史区间每次最多刷新 120 只（趋势回踩、新入池、未缓存优先），AI 原因按 ETF + 区间起始日缓存，每次最多新取 40 条；明细阶段最多 15 分钟、连续失败 5 次即停。
- 名单失败：不写快照，最近成功数据不变，页面显示失败原因。分类或明细缺失：快照记为 `partial`，下次补。
- 「来源截止日」= 本次新取到的在池 ETF 当前上涨区间 `end_day` 的最大值；早于采集日时快照里写明，不当作当天行情。

存储：

- `data-raw/etf-uptrend/`：`snapshots/日期.json`（规范化名单）、`raw/日期/运行号.json.gz`（本次全部原始响应）、`runs.jsonl`、`status.json`、`cache/periods`、`cache/reasons`。
- `public/data/etf-uptrend/`：页面读取的 `index.json`、`detail.json`、`days/日期.json`，由 `export` 生成，内容不变时不改写。

## 手动操作

- 补跑：GitHub → Actions → Update ETF uptrend → Run workflow；勾选「强制重采」会覆盖更新当天快照。
- 停用：在 Actions 页面对该工作流点 Disable workflow；或删掉 `on.schedule`。
- 改时间：改 workflow 的 cron（UTC）。脚本的同日去重以北京时间 20:30 为准，可在 `data-raw/etf-uptrend/config.json` 写 `{"time": "21:00"}` 一并修改。
- 本地运行：

```sh
python3 scripts/etf_uptrend.py --data-dir data-raw/etf-uptrend run --no-page
python3 scripts/etf_uptrend.py --data-dir data-raw/etf-uptrend show
python3 scripts/etf_uptrend.py --data-dir data-raw/etf-uptrend export --out public/data/etf-uptrend
python3 -m unittest discover -s scripts -p 'etf_uptrend_test.py'
```

`scripts/etf_uptrend.py` 与 gupiaoWS 里 `bruce_replica/uptrend.py` 是同一份代码；那边另有本机 launchd 定时和独立 HTML 页面，作为本地备份。
