# Round2 domestic：A 股指数 PE / PB / 股息率补全报告

负责范围：fetch_data.INDICES 中 market=A 的 30 只指数（含中证2000 932000.CSI）× pe/pb/dy，共 90 项；不含 componentNum。
真实采集时间 2026-11-15T18:19:38Z（UTC），网络出口为本机当前网络，未改网络/VPN，未用任何凭据或登录。

## 结果概览

- **79/90 项 ok，11 项 unavailable**（之前 90 项全空）。
- pe：**30/30**。27 只有中证代码的指数用中证官网滚动市盈率日频全历史（2011 起，或指数发布后起）；深证成指、创业板指用蛋卷周频 10 年；国证2000 只有国证官网最新单期。
- pb：**20/30**。18 只用蛋卷周频（2016-11 起，科创50 2019-12 起）；上证指数用中证官网最新单期；国证2000 用国证官网最新单期。另外 10 只没有同口径的公开 PB：中证800、中证全指、中证2000，以及全指能源/材料/工业/主要消费/金融/通信/公用 7 只行业指数（全指可选/医药/信息已有）。
- dy：**29/30**。27 只用中证 indicator.xls D/P2（官网只给近 20 个交易日：2026-10-15~2026-11-11，之后每次运行按日期累积）；深证成指、创业板指用蛋卷最新单期；国证2000 不可得。
- 四条主线和核心宽基：上证/深成/创业/科创50/上证50/沪深300/中证500/中证1000 的 PE 全部有长历史。PB 方面，深成/创业/科创/四只核心宽基有周频 10 年历史；**上证指数 PB 只有 1 期**（中证官网最新值），不能算分位。

## 命令与退出码

| 命令 | 退出码 | 结果 |
|---|---|---|
| `.venv/bin/python providers/domestic.py --as-of 2026-11-15`（真实联网） | 0 | 2 分 57 秒；30 只指数，79/90 ok，errors=0；写出 data/providers/domestic.json（3.2 MB）和 domestic_raw/（10 MB 原始响应与累积缓存） |
| `.venv/bin/python -m unittest discover -s tests -p 'test_domestic.py'` | 0 | 11 项全部通过 |
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` | 0 | 66 项通过（含既有 test_fetch，未回退） |
| 离线 `collect(INDICES, …, offline=True, get=禁止联网)` | 0 | 与联网结果逐项 d/v 完全一致；不联网、不写缓存 |

## 每只指数 × 字段

| code | 字段 | 状态 | 样本数 | 首日 | 末日 | 频率 | 来源 |
|---|---|---|---|---|---|---|---|
| 000001.SH | pe | ok | 3666 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000001.SH | pb | ok | 1 | 2026-11-11 | 2026-11-11 | latest | 中证指数官网 每日指数信息-指数估值 |
| 000001.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 399001.SZ | pe | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 399001.SZ | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 399001.SZ | dy | ok | 1 | 2026-11-13 | 2026-11-13 | latest | 蛋卷基金指数估值 |
| 399006.SZ | pe | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 399006.SZ | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 399006.SZ | dy | ok | 1 | 2026-11-13 | 2026-11-13 | latest | 蛋卷基金指数估值 |
| 000688.SH | pe | ok | 1541 | 2020-07-06 | 2026-11-11 | daily | 中证指数官网 |
| 000688.SH | pb | ok | 355 | 2019-12-31 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000688.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000016.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000016.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000016.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000300.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000300.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000300.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000905.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000905.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000905.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000852.SH | pe | ok | 3488 | 2012-06-29 | 2026-11-11 | daily | 中证指数官网 |
| 000852.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000852.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000903.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000903.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000903.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000906.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000906.SH | pb | unavailable | 0 | — | — | — | — |
| 000906.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000985.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000985.SH | pb | unavailable | 0 | — | — | — | — |
| 000985.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 399303.SZ | pe | ok | 1 | 2026-11-13 | 2026-11-13 | latest | 国证指数官网 |
| 399303.SZ | pb | ok | 1 | 2026-11-13 | 2026-11-13 | latest | 国证指数官网 |
| 399303.SZ | dy | unavailable | 0 | — | — | — | — |
| 932000.CSI | pe | ok | 827 | 2023-06-13 | 2026-11-11 | daily | 中证指数官网 |
| 932000.CSI | pb | unavailable | 0 | — | — | — | — |
| 932000.CSI | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000922.CSI | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000922.CSI | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000922.CSI | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000932.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000932.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000932.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 399967.SZ | pe | ok | 3066 | 2014-04-02 | 2026-11-11 | daily | 中证指数官网 |
| 399967.SZ | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 399967.SZ | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 399975.SZ | pe | ok | 2792 | 2015-05-18 | 2026-11-11 | daily | 中证指数官网 |
| 399975.SZ | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 399975.SZ | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 399986.SZ | pe | ok | 2792 | 2015-05-18 | 2026-11-11 | daily | 中证指数官网 |
| 399986.SZ | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 399986.SZ | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 399971.SZ | pe | ok | 2920 | 2014-11-06 | 2026-11-11 | daily | 中证指数官网 |
| 399971.SZ | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 399971.SZ | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000827.SH | pe | ok | 3668 | 2011-07-08 | 2026-11-11 | daily | 中证指数官网 |
| 000827.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000827.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000986.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000986.SH | pb | unavailable | 0 | — | — | — | — |
| 000986.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000987.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000987.SH | pb | unavailable | 0 | — | — | — | — |
| 000987.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000988.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000988.SH | pb | unavailable | 0 | — | — | — | — |
| 000988.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000989.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000989.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000989.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000990.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000990.SH | pb | unavailable | 0 | — | — | — | — |
| 000990.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000991.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000991.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000991.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000992.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000992.SH | pb | unavailable | 0 | — | — | — | — |
| 000992.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000993.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000993.SH | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 蛋卷基金指数估值 |
| 000993.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000994.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000994.SH | pb | unavailable | 0 | — | — | — | — |
| 000994.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |
| 000995.SH | pe | ok | 3668 | 2011-06-28 | 2026-11-11 | daily | 中证指数官网 |
| 000995.SH | pb | unavailable | 0 | — | — | — | — |
| 000995.SH | dy | ok | 20 | 2026-10-15 | 2026-11-11 | daily | 中证指数官网 indicator.xls |

逐项的 source.url / method / reason 以 data/providers/domestic.json 为准。

## 来源、口径与限制

每个 code+field 的来源在 `plan_for()` 中写死，只取一个来源，不跨源逐日拼接，也不在失败时换源补洞。失败时只沿用同一来源的本地缓存，并在 reason 写明。

1. **中证指数官网 滚动市盈率**：`https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe?indexCode=<csi>`。这是官网指数详情页「历史市盈率」图用的匿名 JSON，前端 JS 把它命名为 getHistoryIndex。字段 peg，官网列名「滚动市盈率」，英文 PETTM，单位倍，日频。
   - 核对：000300 在 2026-11-11 为 13.14，000001 为 14.64，和官网「每日指数信息-指数估值」页的 peg 一致。
   - **清洗**：接口在法定节假日也输出行，数值是上一交易日的复制（例：沪深300 2026-10-01~10-05 都是 9-30 的 13.15）。所以用 data/store/price_000001_SH.csv 的交易日历（只读）剔除非交易日行；晚于日历末日的只保留工作日。例如沪深300 剔除 149 行；各指数的条数和样例写在各自 reason 里。
   - 限制：最早 2011-06-28（2011-06-28 到 07-15 有缺口），2011 年前没有；最新 2026-11-11，比腾讯行情晚 2 个交易日。
2. **中证 indicator.xls**：`https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/indicator/<csi>indicator.xls`。有 PE1/PE2/D/P1/D/P2，dy 只取表头为「股息率2（计算用股本）D/P2」的列，按官网原值，单位 %（1=1%）；具体计算公式未经独立验证。文件只给近约 20 个交易日，provider 每次把新窗口并入 `domestic_raw/accum_dy_csi_<code>.json`（同一文件同一列）。目前不足以计算长期分位；PE1/PE2 不使用，以免和 peg 混口径。
3. **中证「每日指数信息-指数估值」**：`https://www.csindex.com.cn/csindex-home/data-service/indexValuation`。只有 8 只主要指数的最新单期 pe/peg/pb/dp，没有日期参数，所以没有历史。只用于上证指数 pb（2026-11-11 为 1.38），按日期累积。
4. **国证指数官网列表**：`https://www.cnindex.com.cn/index/indexList?channelCode=-1&rows=2000&pageNum=1`。peDynamic 在页面源码里的列名是「PE(滚动)」，另有 pb。只有最新单期，**没有日期字段**；provider 用同站日线 `hq.cnindex.com.cn/.../getIndexDailyDataWithDataFormat` 找收盘点位一致的交易日作观测日，匹配不上就不入库。官网页面目前把这些列注释隐藏了，接口仍返回。只用于国证2000。国证的日线下载 xlsx 只有行情，没有估值。
5. **蛋卷基金指数估值**：`https://danjuanfunds.com/djapi/index_eva/{pe|pb}_history/<SH|SZ code>?day=all`（周频，约 10 年）和 `/djapi/index_eva/detail/<sym>`（最新股息率 yeild，×100 换成 %）。这是 danjuanfunds.com 估值页用的匿名 JSON，不需要登录，但**不是文档化 API，也不是指数公司的官方口径**。数值和官网有差异：深成 pb 蛋卷 2.2185，国证官网 2.16；沪深300 PE 蛋卷 13.42，中证 peg 13.14。因此在 method 里标明「蛋卷自有口径」，并且永不和中证/国证拼接。0 值（蛋卷用它表示亏损或无意义）当缺失处理。dividend_yield_history 返回「请重新登录」，**没有使用**。蛋卷的 SH000986/000987/000990 历史停更于 2018-2019，不作最新数据。

## 不可用项与已尝试来源

| code | 字段 | 原因 / 已尝试 |
|---|---|---|
| 000906.SH 中证800、000985.SH 中证全指、932000.CSI 中证2000、000986/000987/000988/000990/000992/000994/000995 全指行业 | pb | 中证 indexCsiDsPe 只有 PE；indicator.xls 没有 PB；indexValuation 只覆盖 8 只主要指数；国证 indexList 不含中证指数；蛋卷未覆盖，或只有停更到 2018-2019 的历史（000986/987/990）；乐咕乐股 API 需要页面生成的 token（上一轮 403/401），按规则不绕过；中证 dataServer 行业市盈率是行业分类、不是这些指数本身，不作代理；也不用成分股反推（有幸存者偏差，属于合成）。 |
| 399303.SZ 国证2000 | dy | 国证 indexList 没有股息率字段；蛋卷未覆盖；中证 indicator 不含国证指数；深交所 szse.cn 首次连接失败、复测 HTTP 200，未找到指数级股息率公开接口（国证指数由国证官网发布，已查）。 |

已调查但未采用：CSI `index-perf`（有 peg，但请求起始日会伪插一行，并和 indexCsiDsPe 同源，不必重复）；CSI `get-guxi-index`（返回 false）；国证 `downloadDailyMarketExcel`（只有行情）；东方财富 push2 指数估值字段（空响应）。

## 给集成 / manager 的说明

- 输出符合 ROUND2 契约：`series[code].fields.{pe,pb,dy}`，每项有 d/v（ISO 升序、去重、等长、有限数）、source{label,url,unit,method}、frequency（daily/weekly/latest）、status、reason。额外带了 asOf、offline，errors 目前为空。
- 同一只指数的 pe（中证日频）和 pb（蛋卷周频）来源、日期、频率都不同，只能按字段分别展示日期，不能当成同日数据。周频和 latest 分位要注明样本数。
- 蛋卷来源是否符合「来源正常公开」由 manager 定夺。如果不接受，删掉 `DANJUAN_ACTIVE` 就会退化为：深成/创业 pe 只用国证最新单期，18 只 pb 全部 unavailable，深成/创业 dy unavailable。
- 中证 peg 末日 2026-11-11 早于价格 2026-11-13，属于真实发布滞后，不要前填。
- 本 provider 没有修改 fetch_data.py、前端、git 状态，也没有启动下属。

## 二审修复（2026-11-15，未重新联网）

1. **坏响应不再覆盖有效缓存**：`Collector.fetch(name, url, validate)` 先校验再落盘。每个来源都有校验函数：中证 PE 解析结果非空、indicator.xls 能解析且非空、蛋卷 history 非空、蛋卷 detail 能解析、国证列表和日线非空且日期合法、中证 indexValuation 非空。HTTP 200 但返回 HTML、错误 JSON 或空数据时，记为「响应无效」写入 errors，**不写 raw**，继续用上一份通过校验的缓存，reason 标注「本次请求失败或响应无效…沿用上一份有效缓存」。
   - 回归测试 `test_bad_200_body_keeps_previous_valid_cache`：先有有效旧 PE/PB/快照，再喂 7 类坏的 200 响应（HTML、code 500、空 data、蛋卷「请重新登录」等）。旧值全部保留，raw 目录逐字节不变。
2. **蛋卷股息率 0 值保留**：`parse_danjuan_detail` 保留 0（不分红是合法值），拒收负值和 NaN/Inf。回归测试 `test_danjuan_detail_zero_kept_negative_rejected`。蛋卷 pe/pb 历史中的 0 仍按缺失处理，因为蛋卷用 0 表示亏损或无意义。
3. **D/P2 method 改写**：改为「中证官网 indicator.xls 列『股息率2（计算用股本）D/P2』，按官网原值；具体计算公式未经独立验证」，删去了没有验证过的公式描述。
4. **ymd 校验真实日期**：8 位数字用 `dt.date(...)` 构造，20261332、20260230、20261100 这类非法日期抛 ValueError，解析时跳过该行。回归测试 `test_ymd_rejects_invalid_calendar_date`。

重新生成：本地 111 个 raw/accum 缓存文件全部通过新校验（0 个无效）。用 `collect(offline=True)` 和禁止联网的 get 重算，raw 目录的 mtime 不变，没有联网也没有写缓存。与修复前的 domestic.json 相比，90 项的 d/v **0 处差异**，只有 method 文案变了。重算结果由独立脚本写回 data/providers/domestic.json，retrievedAt 保持原联网时间 2026-11-15T18:19:38Z，另加 regeneratedAt 和 regeneratedFrom。实际计数仍为 **pe 30/30、pb 20/30、dy 29/30，共 79/90 ok**。没有编辑 bundle。

| 命令 | 退出码 | 结果 |
|---|---|---|
| `.venv/bin/python -W error::ResourceWarning -m unittest discover -s tests -p 'test_domestic.py'` | 0 | 14 项通过（新增 3 项） |
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` | 0 | 81 项全部通过（含其他 owner 新增的测试） |

## 第三轮：ROE、海外缺口与剩余 PB 核查（2026-11-15）

### ROE 来源与单位核实

- 蛋卷公开估值列表页 `https://danjuanfunds.com/djmodule/value-center?channel=1300100141` 的表头是「ROE」，行模板为 `numeral(item.roe * 100).format('0,00.00') + '%'`；股息率同样是 `item.yeild * 100 + '%'`。所以接口中的 roe 是小数，乘 100 后单位为 %（1=1%）。
- 历史取 `/djapi/index_eva/roe_history/<sym>?day=all`（周频，匿名，无需登录）。method 标注：蛋卷自有口径、计算公式未独立验证、非指数公司官方值。0 视为缺失占位（蛋卷对国证地产 pe/roe 同时给 0），负值保留；本次真实数据中 0 值为 0 条。
- 核对：399001 roe_history 末值 9.00%，与 raw `dj_detail_SZ399001.json` 中 roe 0.09 一致；沪深300 末值 9.93%，与列表 roe 0.0993 一致。

### 蛋卷列表实际 index_code 映射

保存于 `domestic_raw/dj_list.json`，共 63 项。在目标 36 只中，实际有映射的：

- **A 股 18 只**（同 DANJUAN_ACTIVE）。
- **海外 4 只**：HKHSI 恒生指数、HKHSTECH 恒生科技、HKHSCEI 国企指数、SP500 标普500。
- 列表中的 NDX 是纳斯达克100，**不是 IXIC 综合指数，未使用**；列表没有道琼斯工业指数。
- 列表里的 SZ399317 国证A指、SH000010 上证180 等不是目标指数，不作代理。

### 本次新增（只补缺口，A 股原 PE/PB/DY 选源与值不变）

海外只补 supplemental 仍缺的字段，具体是 HSI/HSCEI/SPX 的 pb 和 roe，以及 HSTECH 的 pe/pb/dy/roe。HSI/HSCEI 的官方 PE/DY、SPX/DJI 的 WSJ PE/DY 不输出，也不覆盖。provider 对海外 code 只输出 OVERSEAS_PLAN 中列出的字段。

| code | 字段 | 状态 | 样本 | 首日 | 末日 | 频率 | 末值 | 来源 URL |
|---|---|---|---|---|---|---|---|---|
| 000001.SH | roe | unavailable | 0 | — | — | — | — | — |
| 399001.SZ | roe | ok | 364 | 2019-11-05 | 2026-11-13 | weekly | 9.0 | https://danjuanfunds.com/djapi/index_eva/roe_history/SZ399001?day=all |
| 399006.SZ | roe | ok | 364 | 2019-11-05 | 2026-11-13 | weekly | 14.06 | https://danjuanfunds.com/djapi/index_eva/roe_history/SZ399006?day=all |
| 000688.SH | roe | ok | 355 | 2019-12-31 | 2026-11-13 | weekly | 6.73 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000688?day=all |
| 000016.SH | roe | ok | 365 | 2019-10-30 | 2026-11-13 | weekly | 10.54 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000016?day=all |
| 000300.SH | roe | ok | 362 | 2019-11-20 | 2026-11-13 | weekly | 9.93 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000300?day=all |
| 000905.SH | roe | ok | 364 | 2019-11-05 | 2026-11-13 | weekly | 7.32 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000905?day=all |
| 000852.SH | roe | ok | 364 | 2019-11-05 | 2026-11-13 | weekly | 5.25 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000852?day=all |
| 000903.SH | roe | ok | 365 | 2019-10-30 | 2026-11-13 | weekly | 10.83 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000903?day=all |
| 000906.SH | roe | unavailable | 0 | — | — | — | — | — |
| 000985.SH | roe | unavailable | 0 | — | — | — | — | — |
| 399303.SZ | roe | unavailable | 0 | — | — | — | — | — |
| 932000.CSI | roe | unavailable | 0 | — | — | — | — | — |
| 000922.CSI | roe | ok | 365 | 2019-10-29 | 2026-11-13 | weekly | 9.72 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000922?day=all |
| 000932.SH | roe | ok | 364 | 2019-11-05 | 2026-11-13 | weekly | 13.09 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000932?day=all |
| 399967.SZ | roe | ok | 364 | 2019-11-05 | 2026-11-13 | weekly | 5.37 | https://danjuanfunds.com/djapi/index_eva/roe_history/SZ399967?day=all |
| 399975.SZ | roe | ok | 364 | 2019-11-04 | 2026-11-13 | weekly | 9.36 | https://danjuanfunds.com/djapi/index_eva/roe_history/SZ399975?day=all |
| 399986.SZ | roe | ok | 365 | 2019-10-29 | 2026-11-13 | weekly | 9.47 | https://danjuanfunds.com/djapi/index_eva/roe_history/SZ399986?day=all |
| 399971.SZ | roe | ok | 365 | 2019-11-01 | 2026-11-13 | weekly | 6.19 | https://danjuanfunds.com/djapi/index_eva/roe_history/SZ399971?day=all |
| 000827.SH | roe | ok | 364 | 2019-11-05 | 2026-11-13 | weekly | 8.1 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000827?day=all |
| 000986.SH | roe | unavailable | 0 | — | — | — | — | — |
| 000987.SH | roe | unavailable | 0 | — | — | — | — | — |
| 000988.SH | roe | unavailable | 0 | — | — | — | — | — |
| 000989.SH | roe | ok | 365 | 2019-10-29 | 2026-11-13 | weekly | 8.94 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000989?day=all |
| 000990.SH | roe | unavailable | 0 | — | — | — | — | — |
| 000991.SH | roe | ok | 364 | 2019-11-05 | 2026-11-13 | weekly | 10.17 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000991?day=all |
| 000992.SH | roe | unavailable | 0 | — | — | — | — | — |
| 000993.SH | roe | ok | 384 | 2019-06-20 | 2026-11-13 | weekly | 12.26 | https://danjuanfunds.com/djapi/index_eva/roe_history/SH000993?day=all |
| 000994.SH | roe | unavailable | 0 | — | — | — | — | — |
| 000995.SH | roe | unavailable | 0 | — | — | — | — | — |
| HSI.HK | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 1.0847 | https://danjuanfunds.com/djapi/index_eva/pb_history/HKHSI?day=all |
| HSI.HK | roe | ok | 364 | 2019-11-05 | 2026-11-13 | weekly | 10.01 | https://danjuanfunds.com/djapi/index_eva/roe_history/HKHSI?day=all |
| HSTECH.HK | pe | ok | 326 | 2020-07-27 | 2026-11-13 | weekly | 20.0276 | https://danjuanfunds.com/djapi/index_eva/pe_history/HKHSTECH?day=all |
| HSTECH.HK | pb | ok | 326 | 2020-07-27 | 2026-11-13 | weekly | 2.0545 | https://danjuanfunds.com/djapi/index_eva/pb_history/HKHSTECH?day=all |
| HSTECH.HK | dy | ok | 1 | 2026-11-13 | 2026-11-13 | latest | 1.2 | https://danjuanfunds.com/djapi/index_eva/detail/HKHSTECH |
| HSTECH.HK | roe | ok | 326 | 2020-07-27 | 2026-11-13 | weekly | 10.26 | https://danjuanfunds.com/djapi/index_eva/roe_history/HKHSTECH?day=all |
| HSCEI.HK | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 0.908 | https://danjuanfunds.com/djapi/index_eva/pb_history/HKHSCEI?day=all |
| HSCEI.HK | roe | ok | 365 | 2019-11-01 | 2026-11-13 | weekly | 9.4 | https://danjuanfunds.com/djapi/index_eva/roe_history/HKHSCEI?day=all |
| SPX.US | pb | ok | 516 | 2016-11-14 | 2026-11-13 | weekly | 5.2883 | https://danjuanfunds.com/djapi/index_eva/pb_history/SP500?day=all |
| SPX.US | roe | ok | 415 | 2018-11-06 | 2026-11-13 | weekly | 22.39 | https://danjuanfunds.com/djapi/index_eva/roe_history/SP500?day=all |
| IXIC.US | pe | unavailable | 0 | — | — | — | — | — |
| IXIC.US | pb | unavailable | 0 | — | — | — | — | — |
| IXIC.US | dy | unavailable | 0 | — | — | — | — | — |
| IXIC.US | roe | unavailable | 0 | — | — | — | — | — |
| DJI.US | pb | unavailable | 0 | — | — | — | — | — |
| DJI.US | roe | unavailable | 0 | — | — | — | — | — |

### 前后差异（actual counts）

- 本 provider 输出从 30 只 × 3 字段（79/90 ok）变为 36 只、136 项，**107/136 ok**：
  - pe：31 ok / 1 缺
  - pb：24 ok / 12 缺
  - dy：30 ok / 2 缺
  - roe：22 ok / 14 缺
- **新增 ok 共 28 项**：A 股 roe 18 项；海外 pb 4 项（HSI/HSTECH/HSCEI/SPX）、roe 4 项、HSTECH pe 和 dy 2 项。
- 原 90 项 A 股 pe/pb/dy：**d/v 0 处变化，source.url 0 处变化**。用 `--missing-only` 增量采集，只请求本地没有 raw 的接口（新增 29 个 raw 文件），旧 raw 没有重抓。旧字段 reason 中原来的「offline 缓存」改为「读取本地已验证缓存（采集于 <UTC 时间>）」。蛋卷 PE/PB 的 method 删去了未经验证的「PE 为 TTM」，改为「TTM/静态等定义接口未标明、未独立验证」。
- 全局缺 PB 从 16 只降到 12 只：中证800、中证全指、中证2000、7 只全指行业、IXIC、DJI。

### 仍缺项与原因（有边界核查，未重复请求停更或拒绝端点）

- **PB**：
  - 中证800、中证全指、中证2000、全指能源/材料/工业/主要消费/金融/通信/公用：蛋卷 63 项列表未覆盖。SH000986/987/990 的蛋卷历史停更于 2018-2019；SH000906/SH000985/CSI932000 等的 pb_history 返回空数组。中证/国证官方接口的情况见上文，没有再重复请求。
  - IXIC：蛋卷只有 NDX，不能替代综指。
  - DJI：蛋卷未覆盖。
- **HSTECH**：supplemental 的恒生官方日报缺 HSTECH，所以由本 provider 用蛋卷补 pe（周频）和 dy（单期）。将来如果 supplemental 取得官方 HSTECH PE/DY，集成方应整列二选一，不能拼接。
- **IXIC pe/dy/pb/roe**：无匿名同指数来源（WSJ 页面没有 IXIC 行，见 supplemental 报告；蛋卷只有 NDX）。
- **ROE 缺 14 项**：上证指数、中证800、中证全指、国证2000、中证2000、7 只全指行业（同上）、IXIC、DJI。中证和国证官网接口都不披露指数 ROE，也不用 PE/PB 推算。

### 命令与退出码

| 命令 | 退出码 | 结果 |
|---|---|---|
| `.venv/bin/python providers/domestic.py --as-of 2026-11-15 --missing-only` | 0 | 46 秒；36 只指数，107/136 ok，errors=0；raw 文件 111 → 140 个，另加 dj_list.json |
| `.venv/bin/python -W error::ResourceWarning -m unittest discover -s tests -p 'test_domestic.py'` | 0 | 17 项通过（新增 ROE 单位/0 占位/负值、海外字段不覆盖、IXIC 不用 NDX、missing-only 不重抓） |
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` | 0 | 91 项通过 |
| offline `collect` 加禁止联网的 get | 0 | 与落盘的 domestic.json 逐项值一致 |

没有编辑 bundle、前端、集成 owner 文件或 supplemental 文件。
