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

`.github/workflows/etf-uptrend.yml`：北京时间每天 23:30 运行，次日 07:00 兜底（来源一般 21:30 之后才更新当天数据；GitHub 定时也常延迟）。每次先取一次当前名单，再取其中前几只 ETF 的历史区间探测来源截止日（不能用上次名单：已出池的 ETF 区间截止日不再前进），已有该行情日的完整快照就跳过、不提交；名单成员变了、来源前进了、上次失败或部分成功、探测失败，都会完整采集。脚本 `scripts/etf_uptrend.py` 只用 Python 标准库：

- 名单接口 30 秒超时、5 次指数退避重试；请求顺序发出，间隔 0.35 秒。
- 历史区间每次最多刷新 120 只（趋势回踩、新入池、未缓存优先），AI 原因按 ETF + 区间起始日缓存，每次最多新取 40 条；明细阶段最多 15 分钟、连续失败 5 次即停。
- 名单失败：不写快照，最近成功数据不变，页面显示失败原因。分类或明细缺失：快照记为 `partial`，下次补。
- 「来源截止日」= 本次新取到的在池 ETF 当前上涨区间 `end_day` 的最大值。快照按它命名（页面叫「行情日」），采集时间另记；周末、休市再采只会覆盖同一行情日的快照。旧版按采集日命名的快照会在运行时自动改名。

## 打开页面时实时补拉

存档最新的行情日早于今天（北京时间）时，页面会调用 `/api/etf-uptrend-live`（Cloudflare Pages Function，代码在 `server/etf-uptrend-live.mjs`）：

- 取当前名单与 6 个分类/筛选标签（7 次名单请求并行），再取名单前 3 只的历史区间得到来源截止日。
- 来源截止日比存档新：页面多出一份「实时，未存档」的行情日并默认选中；区间列沿用存档数据，展开某只 ETF 时再用 `?code=20:589200` 实时取它的区间和最近区间的 AI 原因。
- 来源没更新：页面提示「已实时检查，来源截止日仍是 X」。请求失败：提示后照常显示存档。
- 接口成功响应在边缘缓存 10 分钟，失败不缓存。结果不写回仓库，正式快照仍以定时采集为准。
- 测试：`node --test server/etf-uptrend-live.test.mjs`。

## 倒推历史

同花顺没有按日期查历史名单的接口。`reconstruct` 取全部 ETF（全量池 `347c9f28-…`，约 1800 只）的历史上涨区间，存成紧凑格式 `reconstructed.json`；页面「倒推历史」区块按「区间起止含当天即在池、当天在回踩日期里即回踩」推算任意一天的名单，最早约一年前。

- 不是当天真实名单：来源会事后改写区间（删掉已结束的区间、调整起始日），日子越早越不准。2026-11-17 实测：11-16 与真实快照 18/18 一致，11-13 为 119/119（多推出 1 只），11-12 只对上 232/268。导出时会自动与全部真实快照逐只核对，结果显示在页面上。
- 推不出来：新入池（规则不是「起始日=当天」）、T+0/行业/宽基分类、同类去重。
- 与真实快照分开存放，不进 `snapshots/`，不出现在行情日列表里。
- 每周六北京时间 10:00 由工作流重建一次，也可手动运行时勾选「同时重建倒推历史」。缺失超过 2% 的 ETF 就不覆盖旧文件。

存储：

- `data-raw/etf-uptrend/`：`snapshots/日期.json`（规范化名单）、`raw/日期/运行号.json.gz`（本次全部原始响应）、`runs.jsonl`、`status.json`、`cache/periods`、`cache/reasons`。
- `public/data/etf-uptrend/`：页面读取的 `index.json`、`detail.json`、`days/日期.json`、`reconstructed.json`（倒推历史，附核对结果），由 `export` 生成，内容不变时不改写。

## 手动操作

- 补跑：GitHub → Actions → Update ETF uptrend → Run workflow；勾选「强制重采」会跳过探测，覆盖更新该行情日快照。
- 停用：在 Actions 页面对该工作流点 Disable workflow；或删掉 `on.schedule`。
- 改时间：改 workflow 的 cron（UTC）。去重只看来源截止日，不依赖时间；`config.json` 的 `times` 只用于页面显示和本机 launchd 注册。
- 本地运行：

```sh
python3 scripts/etf_uptrend.py --data-dir data-raw/etf-uptrend run --no-page
python3 scripts/etf_uptrend.py --data-dir data-raw/etf-uptrend show
python3 scripts/etf_uptrend.py --data-dir data-raw/etf-uptrend reconstruct   # 约 12 分钟
python3 scripts/etf_uptrend.py --data-dir data-raw/etf-uptrend export --out public/data/etf-uptrend
python3 -m unittest discover -s scripts -p 'etf_uptrend_test.py'
```

`scripts/etf_uptrend.py` 与 gupiaoWS 里 `bruce_replica/uptrend.py` 是同一份代码；那边另有本机 launchd 定时和独立 HTML 页面，作为本地备份。
