# ROUND2 supplemental：港美估值 + 全体指数补充字段

worker：Claude（supplemental），2026-11-15。只写了 ROUND2 列出的5类文件：`providers/supplemental.py`、`data/providers/supplemental.json`、`data/providers/supplemental_raw/`、`tests/test_supplemental.py`、本报告。没有改 fetch_data.py、前端、domestic 文件，没有用 Orca QA tab，没有提交 Git，没有启动下属。

## 修订（manager 复核后，task_50a95d757e2f）

1. **市值口径**：每个 mcap 的 `source` 都加了 `marketCapBasis`。
   - 27 只中证体系指数是 `"free_float"`（中证官网 calMkvSum，即“指数自由流通市值”）。
   - 3 只国证指数（399001/399006/399303）的主 mcap 改成真实**总市值** `totalMarketValue`÷1e8，basis 是 `"total"`；自由流通市值移到 `extras.mcapFreeFloat`（basis `free_float`）。
   - 实际数值（亿元）：
     - 399001：总市值 232766.33，自由流通 125537.59
     - 399006：总市值 71779.43，自由流通 40991.24
     - 399303：总市值 163394.86，自由流通 85193.17
     - 日期都是 2026-11-13
   - 中证样例：000300 自由流通市值 232035.16 亿元，2026-11-11。
2. **港股 amt 改为人民币亿元**：
   - 计算方法是**派生**换算：恒生官方“Index Turnover (Mn)”港元金额÷100 × ECB 当日 CNY/EUR ÷ HKD/EUR（即每港元多少人民币），unit 仍是 `亿元`。
   - ECB 参考汇率的时点约为 14:10 CET，和港股 16:00 HKT 收市不是同一时刻，method 里写明了。
   - 只用日期完全一致的 ECB 汇率；缺日不前填，缺的日期记在 `source.fxSource.unmatchedDates`。ECB 不可达或没有缓存时，amt 留 unavailable。
   - 原币金额保留在 `extras.amtHKD`（亿港元）。
   - 汇率原文是 `supplemental_raw/ecb/eurofxref-hist-90d_2026-11-13.xml`，来源 `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml`，含 65 个 HKD+CNY 日期（2026-08-17~2026-11-13）。
   - 实际结果：3 只港股各 30 个交易日（2026-10-02~2026-11-13），全部精确匹配，unmatched 为空。
     - HSI 最新 775.92 亿元（原币 912.46 亿港元，汇率 7.3738/8.6714）
     - HSTECH 563.67 亿元（662.86 亿港元）
     - HSCEI 610.01 亿元（717.36 亿港元）
3. **下载层先校验再落盘**。“HTTP 200 但返回坏 HTML/XML”时不会覆盖有效缓存。
   - 各来源的校验：
     - 恒生日报 csv：必须是 UTF-16、带 `"Trade Date"` 表头、含当天的行；已缓存但无效的文件会重新下载。
     - dailyReport：必须是列表且含 reportList。
     - IPS：必须有表头、交易日和列表日期一致。
     - 月末 xlsx：必须能解析且有数据。
     - Shiller：必须能解析且 E 列非空。
     - ECB：必须是合法 XML，且有 HKD 和 CNY。
     - 中证、国证、WSJ、Nasdaq 原本就是解析成功后才写入。
   - 对已有真实 raw 做了复查：90 个恒生日报 csv 全部有效，4 个月末 xlsx 各 12 个点，Shiller E 有 1830 个点。
4. **时间字段分开**：
   - `retrievedAt`：最近一次真实联网采集的开始时间，记录在 `supplemental_raw/_last_online.json`。
   - `builtAt`：本次解析重建的时间。
   - `lastOnline`：`{retrievedAt, finishedAt, errorCount}`。
   - offline 重建不会刷新 `retrievedAt`；没有 marker 时为 null。
   - 当前落盘结果：`mode=online`，`retrievedAt=2026-11-15T18:31:43Z`，`builtAt=2026-11-15T18:32:11Z`，2 个 error（都是 HSTECH 月末 xlsx 跳转 404）。
   - 离线重建写到临时路径验证过：retrievedAt 保持 18:31:43Z，builtAt 是 18:32:23Z，errors 为 0，amt 数值不变。
5. **字段计数**：负责字段 ok **41/210**，componentNum ok **34/36**，和上一版相同。amt 是改了单位后补上，不是新增来源。
6. **新增回归**（测试从 12 项增加到 19 项，exit=0，`-W error::ResourceWarning` 下也通过）：
   - HTML 响应不会覆盖或新增任何 raw
   - 新文件遇到 HTML 不落盘
   - 已缓存的无效 idx 会重新下载
   - ECB 缺日不前填
   - ECB 不可达时 amt 为 unavailable
   - offline 保留联网时间
   - 没有 marker 时 retrievedAt 为 null
   - 另外还断言了 marketCapBasis 和换算值 775.92。

命令：`.venv/bin/python -W error::ResourceWarning -m unittest discover -s tests -p 'test_supplemental.py'` → Ran 19 tests OK；`.venv/bin/python providers/supplemental.py --as-of 2026-11-15` → exit=0。

下文第一版的描述中，“港股 amt 单位亿港元”“国证 mcap 为自由流通”以本节为准。

## 结论

- 负责的 code×field 共 **210 个**（30只A股×mcap/turn/eps/roe/bps，加6只港美×10个字段；`fetch_data.INDICES` 实际是 **36** 只，baseline 写的35只与此不符），外加36个 componentNum。
- **ok 41/210，componentNum ok 34/36**。其余每一项都写了具体的 `status:"unavailable"` 和原因，见 `supplemental.json` 各字段的 `reason`。
- 补齐了：30只A股的 mcap（官方**自由流通市值**，单期快照）；30只A股、3只港股和纳指综指的 componentNum；HSI/HSCEI 的 pe/dy（官方日频，30个交易日）；3只港股的 amt（官方日频，30个交易日，**单位亿港元**）；SPX/DJI 的 pe/dy（WSJ 单期快照）。
- 补不齐的：所有指数的 turn/eps/roe/bps，港美的 pb/volume/mcap，美股 amt，HSTECH pe/dy，IXIC pe/dy，SPX/DJI componentNum。原因和查过的来源见下文“缺口”一节。

## 实际命令与结果

```
cd output/指数全景
.venv/bin/python providers/supplemental.py --as-of 2026-11-15            # 真实在线采集，exit=0，约1分40秒
  [supplemental] mode=online fields ok 41/210, componentNum ok 34/36, errors 2
  error: hsi_monthly_xlsx .../historical_pe/en_hk/hstech/hstech.xlsx 重定向到错误页 /errors/404/
  error: hsi_monthly_xlsx .../historical_dy/en_hk/hstech/hstech.xlsx 重定向到错误页 /errors/404/
.venv/bin/python providers/supplemental.py --as-of 2026-11-15 --offline  # 只读缓存，exit=0，结果相同，errors 0
.venv/bin/python -m unittest discover -s tests -p 'test_supplemental.py' -v   # Ran 12 tests OK，exit=0
python3 -m unittest discover -s tests -p 'test_fetch.py'                      # Ran 33 tests OK（只读回归，未改动）
```

最后落盘的 `supplemental.json` 是在线那次的结果：`mode=online`，`retrievedAt=2026-11-15T18:23:34Z`，`asOf=2026-11-15`，2个 error。raw 缓存约2.3MB，JSON约296KB。`--summary` 参数会逐个打印“指数/字段/样本数/首末日期/单位/频率”。

## 接口与设计

- `collect(indices, as_of, offline=False, raw_dir=..., out_path=..., get=...)`：返回值与 `data/providers/supplemental.json` 结构相同，即 ROUND2 的 schema。
- 采集分两步：
  - **下载**：只在线时执行，只把原文写进 `supplemental_raw/`。
  - **解析**：只读 raw，重建输出。
- offline 不发任何网络请求（测试里用一个“被调用就抛错”的 get 验证过）。某个来源本次下载失败时，旧 raw 不删，输出不变（有测试），失败写进 `errors`。
- 每日快照类来源（中证 index-feature、国证 indexList、WSJ、Nasdaq）按日期各存一个文件，逐次运行累积真实观测。恒生日报只下载还没缓存的那几天（有测试）。
- 数组按 ISO 日期升序、去重，d 和 v 等长；只保留有限数，空值不当0（有测试：恒生某天 PE 为空，那天不进序列）；晚于 `as_of` 的观测会被过滤。
- 每个 series 下有 `fields`（只放本 provider 负责的字段，A股不输出 pe/pb/dy/amt/volume，避免抢 domestic 或已有数据）、`componentNum`（`{value,date,source,status,reason}`），有扩展数据时还有 `extras`（不在契约内，供 manager 决定用不用）。
- 依赖只有标准库和项目 `.venv` 里已有的 xlrd 2.0.1（用来读恒生 IPS .xls 和 Shiller .xls）。xlsx 用 zipfile+xml 自己解析。没有新增依赖。

## 来源、口径、单位、频率

| 字段 | 指数 | 来源（直链） | 口径/单位 | 频率与样本 |
|---|---|---|---|---|
| mcap | 27只中证体系（含000001、399967/399975/399986/399971、932000） | 中证官网“指数特征”接口 `https://www.csindex.com.cn/csindex-home/indexInfo/index-feature/{code}` | `calMkvSum`。官网前端 i18n `total.market.capitalisation` 标注为“**指数自由流通市值**”，单位“(亿元)”（核对自 app.3db50984.js 和详情页 chunk）。**不是总市值** | 接口只返回最新交易日（本次是 2026-11-11），每只1个点，单期快照，不能做历史分位 |
| mcap | 399001/399006/399303 | 国证官网 `https://www.cnindex.com.cn/index/indexList?channelCode=-1&rows=2000&pageNum=1` | `freeMarketValue`（元）÷1e8 得亿元，也是自由流通市值，和中证同类。`totalMarketValue` 放在 `extras.mcapTotal` | 响应不带日期。用同站 `hq.cnindex.com.cn/.../getIndexDailyDataWithDataFormat` 的收盘点位精确匹配（4位小数、唯一）来定日期，本次是 2026-11-13；匹配不唯一就不入库。单期 |
| componentNum | 同上30只A股 | 中证 index-feature `consNum`，国证 indexList `samplesize` | 只 | 带交易日期（中证 2026-11-11，国证 2026-11-13） |
| pe / dy | HSI、HSCEI | 恒生官网每日报告 `idx_{d}.csv`，通过 `https://www.hsi.com.hk/api/wsit-hsi-ddoc-ea-public-website-proxy/v1/content/gcs/download?resource=/public-website/webapp/contents/en/indexes/report/{hsi|hscei}/idx_13Nov26.csv` 下载；文件列表来自 `.../product-data/pub/series/metadata/v2?data=dailyReport&seriesCode=…` | 官方“PE Ratio (times)”和“Dividend Yield (%)”（恒生加权平均口径），单位倍、% | 日频，30个交易日 2026-10-02~2026-11-13。官网只保留约30天，更早的文件返回404（试过 30Sep26、2Jan26），靠逐次运行累积 |
| amt | HSI、HSTECH、HSCEI | 恒生 `Index_Performance_Summary_{d}.xls`（同一个 gcs 下载代理） | 官方“Index Turnover (Mn)”，即指数成份股成交额（百万港元），÷100 得 **亿港元**。**没有换算汇率**，不是人民币亿元 | 日频，30个交易日 2026-10-02~2026-11-13 |
| componentNum | HSI 95 / HSTECH 30 / HSCEI 50 | 恒生 `.../product-data/pub/constituent/metadata/v2?data=rt&seriesCode=…` 的 `numOfConsList.count` | 只 | 2026-11-13（取成分股 dateTime） |
| pe / dy | SPX（WSJ 代码 INX）、DJI | WSJ “P/Es & Yields on Major Indexes” `https://www.wsj.com/market-data/stocks/peyields`，页面免登录 | trailing 12个月 P/E（as-reported earnings）和 DIV YIELD %。页面注：“P/E data based on as-reported earnings; estimate data based on operating earnings.” | 单期快照 2026-11-13，每只1个点，逐次运行累积。“Year ago”列的确切日期不明，没有收录 |
| componentNum | IXIC 3395 | Nasdaq Global Indexes 官方页 `https://indexes.nasdaqomx.com/Index/Overview/COMP` 的“# of Components” | 只 | 2026-11-13 |

`extras`（**不在主字段里，也没有和主字段拼接**，请 manager 决定是否扩展 schema）：

- `HSI.HK` / `HSCEI.HK`：`peMonthly`、`dyMonthly`，来自恒生官方月末加权 PE/DY 文件 `…/index_operation/historical_{pe|dy}/en_hk/{s}/{s}.xlsx`，只有最近12个月（2025-11-28~2026-10-30）。和日报同一口径但频率不同，所以没有拼进日频的 pe 列。
- `399001/399006/399303.SZ`：`mcapTotal`，国证的样本总市值。
- `SPX.US`：Shiller `ie_data.xls`（Yale 官方直链，数据止于 2023-06）。
  - `peShillerMonthly`：数据集原列 P÷E。
  - `dyShillerMonthly`：D÷P×100。
  - `earningsPts`：E，即过去12个月盈利，**单位是指数点**。
  - 这些都是月度数据，1871-01~2023-06，各1830个点。

## 缺口（unavailable）与调查证据

- **turn（全部36只）**：
  - 查过：中证 index-perf、index-feature、indicator.xls；国证 indexList 和日行情；恒生日报和 IPS；WSJ；Nasdaq。都没有指数换手率字段。
  - 腾讯、东财行情的“换手”列没有公开口径文档，按 ROUND2 不猜测。
  - 成交额÷自由流通市值不是官方定义，没有合成。如果 manager 想要，建议另立派生字段 `turnDerived` 并明确写成派生。
- **eps / bps / roe（全部36只）**：上述官方来源都只披露 PE/PB/股息率，没有每股盈利、每股净资产和 ROE。按规定没有用点位/PE 反推，也没有用 PE/PB 合成 ROE。
  - Shiller 的 E 是指数点位口径的盈利，而且数据过期，只放在 extras。
  - **建议 manager** 如果要用，新增字段 `earningsPts`（单位“指数点”，月频），不要塞进 `eps`。
- **港股 pb**：恒生日报和月末文件只有 PE 与 DY。
- **港股 volume**：恒生官方只给成交额，不给成交股数；腾讯港股指数成交量单位没有文档。
- **港股 mcap**：公开 JSON 和日报里都没有；factsheet PDF 里有月末数据，但不是结构化格式，本轮没有解析。
- **HSTECH pe/dy**：
  - 恒生科技的日报 CSV 只有点位和涨跌，没有 PE/DY 列（已实测下载 `hstech/idx_13Nov26.csv` 确认）。
  - 月末 PE/DY xlsx 返回 302 跳到 `/errors/404/`。
  - 也试了 hstechi/hstch/HSTECH 等几种写法，同样跳转。
- **IXIC pe/dy**：WSJ 页面只有 Nasdaq 100（RIXF），没有 Composite，不能拿来替代。Nasdaq 官方指数页和 `api.nasdaq.com` 都没有估值。
- **美股 amt/volume**：`api.nasdaq.com/api/quote/COMP/historical` 返回的 volume 是“--”。交易所总成交属于市场总数，不能替代指数值。
- **美股 pb/mcap、SPX/DJI componentNum**：S&P DJI 官网的 `get-performance-data-for-datawidget-redesign.dot` 和 `sp-500-eps-est.xlsx` 都返回 **403**，没有绕过。
- **已放弃或不可用的其他来源**：
  - `stooq.com` 要求 JS 浏览器验证，没有绕过。
  - shillerdata.com 的新版文件在官网页面上找不到可核对的直链，所以只用 Yale 官方直链（数据较旧）。

## 给 manager / 集成 owner 的口径提醒

1. **mcap 一律是自由流通市值**（中证和国证都是），不是总市值。前端标签建议写“自由流通市值”。目前每只只有1个快照，不能算历史分位，必须按单期显示。
2. **港股 amt 单位是“亿港元”**，和 A 股的“亿元（人民币）”不一样。集成时请保留 `source.unit`，或在 UI 上标出币种。我没有做汇率换算，以免引入第三来源。
3. 港股 pe/dy 日频只有30个点，美股 pe/dy 只有1个点。频率字段写的是 `daily` 或 `snapshot`，请按实际样本数提示。
4. `componentNum` 对象里多了 `status` / `reason` 两个键，便于追踪缺口。
5. 以后每天运行一次 `providers/supplemental.py` 就能累积快照和恒生日报，不需要改代码。

## 未验证项与风险

- 恒生的 gcs 下载代理、constituent rt 接口，以及中证 index-feature，都是官网页面自己调用的匿名接口，没有对外接口文档，结构变化后会在 `errors` 里报出来。
- WSJ 页面是内嵌 JSON，页面改版会导致解析失败；失败时保留旧缓存。
- 国证日期是靠收盘点位匹配推定的。如果两天收盘点位完全相同，会放弃入库，不会猜。
- Shiller extras 的 2023 年之后没有数据，只能作为长期历史参考。
