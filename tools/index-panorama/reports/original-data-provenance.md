# 原站 lishenqi.vip 指数全景：数据来源与计算方式调查

2026-11-15，Claude（domestic provider owner）。只新增本报告和脱敏证据 `reports/evidence/original-provenance-sample.json`；没有改生产前端、数据包、provider 或任何数值。

## 0. 方法与边界

- **工具**：chrome-devtools MCP。它控制的是一个**独立的 Chrome 实例**，没有用户的 Google Chrome 会话，`list_pages` 起始只有 about:blank。所以本次没有用到用户的登录态，也没有和 manager 的 Chrome 冲突。没有开启远程调试，也没有修改浏览器安全设置。
- **页面行为**：打开 `https://lishenqi.vip/#/panorama` 后，页面自身会向腾讯云 CloudBase 发起 `auth/v1/signin/anonymously`（匿名登录），然后多次 POST `…tcb-api.tencentcloudapi.com/web?env=cloud1-…`（云函数调用）。登录弹窗在页面上可见，但**数据云函数在匿名身份下已返回完整数据**。
- **取数方式**：在页面里调用页面自己的只读函数 `PANO_IX.panel()` 和 `PANO_IX.series(code,'10y',PANO_IX.FIELDS)`。它们就是页面切到全景页、点开详情时会执行的 `Cloud.call('lsqSiteAdmin', {action:'ixPanel'|'ixSeries'})`，参数和页面相同。
  - 一共只调用了 panel 1 次（后续命中内存缓存）和 series 3 次（上证、沪深300、恒生）。
  - 没有调用其他 action，没有批量抓取，也没有读取或输出请求头、cookie 或 token。证据文件只保存返回的数据字段，已用 grep 检查不含 token/cookie/uid。
- **确认线上 JS 与本地参考一致**：线上的 `panoDrawExtras`、`panoNum`、`panoSeriesOf` 用 `Function.toString()` 取出来，与 `/tmp/lishenqi-panorama.js` 相同。下面的行号都指这个文件。

## 1. 证据链：网络 → 字段 → 页面

| 环节 | 位置 | 内容 |
|---|---|---|
| 请求封装 | `/tmp/lishenqi-panorama.js` L11-15 | `req(data)` → `Cloud.call('lsqSiteAdmin', data)` |
| 首页面板 | L22-31 | `req({action:'ixPanel'})`，返回 `{ok, action, day, fields, u, roster, rows, pct1y, errors}` |
| 详情序列 | L43-52 | `req({action:'ixSeries', code, range, fields, withPct:1})` |
| 榜单行取值 | L189-197 | `r = d.rows[code]`，pe/dy/roe/eps 直接取 `rows` 字段；`pct1y = d.pct1y[code].pe` |
| 榜单显示 | L480-481 | `panoNum(r.pe,2)`、`panoNum(r.dy,2)+'%'`、`panoNum(r.pct1y,1)+'%'` |
| 详情小卡 | L838-843 | `panoNum(r.dy,2)+'%'`、`panoNum(r.roe,1)+'%'`、`r.mcap/10000` 万亿元 |
| 数字格式化 | L131-137 | `Number(v).toFixed(dec)` 加千分位，**没有其他换算** |
| 详情主图分位 | L788-791 | `clean.filter(v => v <= last).length / clean.length * 100` |
| 温度计 PE/PB 分位 | L813-820 | 同一个公式，作用于 `ixSeries` 返回的 pe、pb 数组 |
| 单位表 | L65-73 | pe/pb 倍、div 1；mcap 库存亿元，展示 ÷10000 为万亿元；dy 单位 '%'、div 1 |

`ixPanel` 返回 `day: "20261113"`，`fields` 列出 27 个字段：price, chg, amt, mcap, pe, pb, turn, liqMv, dy, open, high, low, prevClose, change, volume, **peLyr**, pbLyr, pbMidLyr, pbMidLf, pcf, freeMv, eps, bps, roe, liqShare, **idxProfit**, componentNum。`u` 单位表 ver 3：mcap/amt 为「yi」（亿），eps/bps 为「yuan」，pe/pb/dy/chg 为「ratio」。

## 2. 三只样本的面板原值（day=20261113）

| 字段 | 上证 000001.SH | 沪深300 000300.SH | 恒生 HSI.HI |
|---|---|---|---|
| price | 3634.35 | 4016.29 | 23637.6 |
| **pe** | **15.93** | 13.44 | 10.65 |
| peLyr | 16.73 | 13.80 | 12.78 |
| pb / pbLyr | 1.40 / 1.47 | 1.33 / 1.40 | 1.12 / 1.18 |
| **roe** | **8.16** | 9.13 | 10.53 |
| eps / bps（元） | 0.79 / 9.70 | 1.08 / 11.82 | null / null |
| dy | 0 | 0.01 | 0.01 |
| mcap（亿） | 754221.95 | 641872.47 | 367329.12 |
| idxProfit | 46002.95 | 47775.03 | 34627.67 |
| componentNum | 2233 | 300 | 95 |
| pct1y.pe / pct1y.pb | 13.93 / 5.74 | 11.07 / 1.64 | 9.02 / 4.51 |
| ixSeries 10y pct.pe / pct.pb | 78.98 / 48.85 | 64.48 / 21.65 | 55.70 / 41.58 |

`ixSeries` 的 10y 序列三只都是：`freq:"week"`、`step:5`、`first:20170105`、`last:20261113`、`points:479`、`dailyPoints:2393`、`shards:10`。也就是服务端从 2393 个日点里每 5 个取 1 个点下发。

## 3. 上证 PE 15.93

**已确认：**

- 15.93 是 `ixPanel.rows["000001.SH"].pe`，也是 `ixSeries` pe 数组的末值，日期是 **20261113**（panel day 与 series last 都是 20261113）。页面经 `panoNum(v,2)` 原样显示，前端不做任何计算。
- 同一行里另有 `peLyr = 16.73`。从命名看，pe 和 peLyr 是两种口径，pe 很可能是非 LYR 口径，但服务端没有给出定义。
- 与中证官网对比，没有一列对得上：
  - 中证滚动市盈率 `peg`：重叠的 478 个周点上，原站/中证的比值中位数为 1.012，范围 0.85 到 1.12。年度中位数从 2017 年的 0.999 漂到 2026 年的 1.083，说明不是固定的换算差。
  - 中证 indicator PE1：10-15/10-22/10-29/11-05 原站为 15.19/14.97/15.54/16.11，中证为 15.11/14.93/15.74/15.87，同样不一致。
  - 所以 15.93 **不是**中证 peg，也不是 PE1，只是在某些阶段数值接近。
- 沪深300 也不一致：原站/中证 peg 年度中位数在 0.936 到 1.0 之间漂移。和蛋卷 PE 的比较暂缺，因为本地没有蛋卷 SH000300 的 pe raw。

**同行字段的一致性检查（只是观察，不是公式结论）：**

- mcap / idxProfit：沪深300 为 13.435（pe 13.44），恒生为 10.608（pe 10.65），二者接近；**上证为 16.395，比 pe 15.93 高 2.9%**。所以无法确认 pe = mcap / idxProfit 是通用规则。上证不一致的原因（例如是否剔除亏损股、市值或股本基数不同）未知。
- price / eps：上证为 3634.35 / 0.79 ≈ 4600，远大于 pe。说明 eps 不是「每指数点盈利」，pe 也不是由 price/eps 算出来的。

**未知：**

- pe 的定义（TTM 还是其他）、加权方式（整体法、市值加权等）、是否剔除亏损股、盈利基准期。
- 上游提供商。
- 服务端何时、如何更新盈利基数。

## 4. 上证 ROE 8.2%

**已确认：**

- 页面显示的 8.2% = `rows["000001.SH"].roe = 8.16`，经 L840 的 `panoNum(r.roe,1)` 四舍五入到 1 位小数。前端没有计算，日期 20261113。
- 10y 周序列中上证 roe 是阶梯式变化：2026-07-22 8.11、2026-08-26 8.30、2026-09-02 8.53、2026-10-22 8.54、2026-11-05 8.16。

**同行一致性（观察）：**

- **A 股两只**：roe 与 eps/bps×100 在 479 个周点上非常接近。上证差值中位数 0.032、最大 0.095；沪深300 中位数 0.024、最大 0.093。这个量级符合 eps、bps 只保留两位小数造成的舍入误差。
- 同期 roe 与 pb/pe×100 差得多：上证中位数差 0.65、最大 0.97；沪深300 中位数差 0.80。**所以 8.16 和 pb/pe 无关**（1.40 / 15.93 ×100 = 8.79）。
- **恒生**：eps、bps 全为 null，roe 却有值，并且与 pb/pe×100 接近（中位数差 0.050、最大 0.149；最新 1.12 / 10.65 = 10.52，roe 为 10.53）。
- 两类市场表现出不同的一致性模式，**不能把任何一个当作原站的通用 ROE 公式**。roe 可能是上游直接提供，也可能是服务端按市场用不同字段计算，从页面无法区分。
- 与蛋卷 ROE 对比：沪深300 原站 9.13 对蛋卷 9.93，恒生 10.53 对 10.01，周点比值中位数分别为 0.918 和 1.056。**原站 ROE 不是蛋卷口径。**

**未知：** ROE 的正式定义（报告期、净资产是期末还是平均、整体法还是加权）以及上游。服务端没有给出说明。

## 5. 其他字段

- **PB**：
  - 沪深300 原站 pb 与蛋卷周点比值中位数为 1.002（最新 1.33 对 1.3326），非常接近；恒生为 1.057（1.12 对 1.0847），不一致。所以也不能认定为同一来源。
  - 原站 pb 与 pbLyr、pbMidLyr、pbMidLf 并列。从命名推测 pb 是 MRQ 或最新口径、pbMid 是中位数口径，但这只是推测，**未确认**。
  - 上证 pb 1.40，中证 indexValuation 在 2026-11-11 为 1.38，日期也不同，不能判断是否同源。
- **股息率 dy**：
  - 面板和序列中的 dy 只有 0、0.01、0.02、0.03 几个值（上证最新为 0，沪深300 为 0.01）。单位表写 `dy:"ratio"`，前端 L481/L839 直接拼接 `toFixed(2)+'%'`。
  - 所以页面会显示「0.00%」「0.01%」。这些值看起来像是先按小数存储、再舍入到两位小数后丢失了精度（对照中证 D/P 约 2.48% 和 2.67%）。**原站股息率字段本身存在单位或精度问题**，具体原因以服务端为准，未确认。
- **市值**：mcap 单位为亿元，展示时 ÷10000 显示为万亿元（L70、L843）。上证 75.42 万亿元，`liqMv`、`freeMv` 另列。
- **EPS / BPS**：A 股有值（上证 0.79 / 9.70 元），港股为 null。它们不是「每指数点」口径（见第 3 节），定义未知。
- **分位**：
  - 前端分位公式为 `count(v ≤ 当前) / n × 100`（L791、L818-820），n 为所选区间下发数组里的非空点。
  - 10y 数组是周采样。我用 479 个周点重算，上证得 79.12、沪深300 得 64.51；服务端下发的 `pct` 为 78.98 和 64.48。推测服务端是在 2393 个日点上计算，未确认。
  - 首页「近一年分位」直接取服务端的 `pct1y.pe`（L193/L197）。

## 6. 上游提供商：未确认，只有间接线索

- 返回数据和前端都没有出现任何来源名称：在 panel 和上证 series 的 JSON 里搜索 choice/wind/eastmoney/东方财富/csindex/source/provider/tushare/akshare/ifind/同花顺，全部无命中。
- **代码后缀**：roster 用的是 `HSI.HI`、`HSCEI.HI`、`HSTECH.HI`、`SPX.GI`、`IXIC.GI`、`801010.SWI`（申万）、`000922.SH`。其中 `.SWI` 和 `.HI` 与东方财富 Choice 的代码习惯一致。
- 字段命名（peLyr、pbMidLyr、pbMidLf、idxProfit、pcf）是商业终端常见的指标风格。
- 以上只能说明**可能**来自 Choice 一类终端，**不能确认**。

## 7. 对复刻与补数的含义（供 manager 二审）

- 本地 000001.SH pe 14.64 是中证 peg（2026-11-11），原站 15.93 是另一份数据（2026-11-13）。两者的比值随年份漂移，**不能用系数换算，也不能拼接**。
- 原站 ROE：A 股与 eps/bps 高度一致，港股与 pb/pe 一致，正式定义未公开。在没有授权的同源数据之前，本地不应照搬 8.16，也不应自行用 PB/PE 推算。
- 原站股息率字段本身显示为 0.00% 到 0.03%，复刻时**不宜对齐这个显示**。本地的中证 D/P2（如 2.48%）是官方值。
- 可以安全复刻的是前端计算方式：分位公式（L791/L818）、单位换算（L65-73）和显示精度（ROE 1 位小数，其他 2 位）。

## 8. 证据文件

`reports/evidence/original-provenance-sample.json`（脱敏，只含数据字段），内容包括：
- panel 的 `day / fields / u / errors`；
- 三只样本的 `rows` 和 `pct1y`；
- 三只样本 `ixSeries` 10y 的 `d / pe / pb / dy / roe / eps / bps / mcap / price / pct / pct1y` 以及采样元数据；
- 采集时间 `capturedAt` 为 2026-11-15T19:24:28Z。

用于对照的本地 raw：`data/providers/domestic_raw/csi_pe_000001.json`、`csi_pe_000300.json`、`csi_ind_000001.xls`、`dj_pb_SH000300.json`、`dj_roe_SH000300.json`、`dj_pb_HKHSI.json`、`dj_roe_HKHSI.json`。
