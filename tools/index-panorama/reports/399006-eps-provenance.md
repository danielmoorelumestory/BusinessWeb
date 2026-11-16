# 创业板指 399006.SZ「每股盈利」溯源

2026-11-15，Claude（domestic provider owner）。只新增本报告和脱敏证据 `reports/evidence/399006-eps-sample.json`；没有改生产数据包、provider 或前端。

## 0. 方法与边界

- **路径**：沿用 `original-data-provenance.md` 已验证的方式。chrome-devtools MCP 控制一个独立 Chrome 实例（不是用户会话），打开 `https://lishenqi.vip/#/panorama`，页面会自行完成 CloudBase 匿名登录。我在页面中调用它自己的只读函数，参数与页面正常操作相同：
  - `PANO_IX.panel()`：命中页面内存缓存。
  - `PANO_IX.series('399006.SZ','10y',FIELDS)`：详情页默认区间。
  - `PANO_IX.series('399006.SZ','1y',FIELDS)`：等同于点「近1年」区间按钮。
  - 本任务只新增了这两次 series 调用，没有调用其他 action。
- **脱敏**：没有读取或输出请求头、cookie 或 token。证据文件只含数据字段，已 grep 确认不含 token/cookie/openid。
- 采集时间 `capturedAt` 为 2026-11-15T19:29:03Z。

## 1. 前端「每股盈利」曲线：直接取 eps，无派生

以下行号指 `/tmp/lishenqi-panorama.js`，上一轮已用 `Function.toString()` 确认线上代码与它一致。

| 行号 | 代码要点 |
|---|---|
| L6 | `FIELDS = ['pe','mcap','pb','dy','amt','price','chg','turn','eps','roe','bps','volume']`，详情请求带上 eps |
| L43-52 | `req({action:'ixSeries', code, range, fields, withPct:1})` |
| L365 | 卡片「估值与盈利」，图例「市盈率 / 每股盈利」，容器 `#panoDual` |
| L814 | `pe = panoSeriesOf(d,'pe',1)` |
| L900-905 | `dn = Math.min(60, days.length)`；「每股盈利」系列为 `data: panoSeriesOf(d,'eps',1).slice(-dn)`，放在右侧 y 轴（yAxisIndex 1） |
| L596-604 | `panoSeriesOf(d,f,div)`：取 `d[f]` 数组，`Number(v)/div`（这里 div=1）；**空值沿用前一个值**（`started` 之后遇到 null 就 push last），开头的空值保持 null |
| L906-914 | 轴标签 `panoNum(v,1)`，提示框 `panoNum(value,2)` |

结论：
- 曲线就是 `ixSeries` 返回的 `eps` 数组的**最后 60 个点**，没有任何公式派生，只有空值前向填充。
- 10y 区间下这是最近 60 个周点（约 14 个月）；1y 区间下是最近 60 个交易日。
- 榜单 L197 同样直接取 `rows.eps`。

## 2. 原站数据（399006.SZ）

### 面板 `ixPanel`（day = 20261113）

| 字段 | 值 | 单位表 `u` |
|---|---|---|
| price | 2426.08 | yuan |
| pe / peLyr | 27.51 / 34.66 | ratio |
| pb / pbLyr | 3.86 / 4.54 | ratio |
| **eps** | **1.78** | **yuan** |
| bps | 12.73 | yuan |
| roe | 14 | （u 中没有 roe 键；页面显示为 `toFixed(1)+'%'`，即 14.0%） |
| mcap / idxProfit | 73538.85 / 2672.8 | mcap 为 yi |
| liqShare | 122002577741 | —（u 中没有该键） |
| componentNum | 100 | — |
| dy | 0 | ratio（同上一份报告，原站 dy 有精度问题） |

### 序列 `ixSeries`

| 区间 | freq / step | first ~ last | points / dailyPoints | 空值（price/pe/pb/eps/bps/roe） |
|---|---|---|---|---|
| 10y | week / 5 | 20170105 ~ 20261113 | 479 / 2393 | 全部 0 |
| 1y | **day / 1** | 20260105 ~ 20261113 | 207 / 207 | 全部 0 |

- 1y 日序列和本地 A 股日历（2026 年 208 个交易日）相比，**缺 20261112 一天**，没有多出的日期。10y 序列是周采样，末尾日期为 …1029、1105、1113。
- **不同历史日期都有 EPS，且会变化**：
  - 10y 周序列中有 169 次取值变化，首值 0.44（2017-01-05），最近为 1.73（09-02）、1.77（10-29）、1.78（11-05 起）。
  - 1y 日序列中有 38 次变化，例如 10-21 为 1.75、10-22 为 1.73、10-23 为 1.71、10-27 为 1.75、10-30 为 1.80、11-02 为 1.78。
  - EPS 不是只在财报季跳一次，而是频繁小幅变动，原因未知。

## 3. EPS 是什么口径：已确认的与未知的

**已确认：**
- 单位表 `u.eps = "yuan"`，即元。
- 页面直接显示原值，不做换算。

**观察：EPS 不是「每指数点盈利」**
- 如果 EPS 是每指数点盈利，应有 price / pe ≈ eps。实际 2426.08 / 27.51 ≈ 88.2，而 eps 是 1.78。
- price / pe / eps 的比值在 10y 内从 49.5 变到 117.4（中位数 55.9），1y 内从 49.4 变到 55.9，不是常数。所以 EPS 也不是每指数点盈利乘以某个固定系数。
- 本报告**没有**用 price/pe 反推任何数值，以上只是用来排除一种解释。

**观察：EPS、BPS、ROE 之间的一致性**
- ROE 与 EPS/BPS×100：10y 差值中位数 0.037、最大 0.137；1y 中位数 0.025、最大 0.047。这与 EPS、BPS 只保留两位小数造成的舍入误差相符。
- 但创业板这里 ROE 与 PB/PE×100 也很接近（10y 中位数差 0.034、最大 0.693；1y 中位数 0.025）。这和上一轮上证/沪深300 中 PB/PE 偏离较大的情况不同，所以**不能据此判断哪一个是原站的 ROE 公式**。
- idxProfit / liqShare = 2672.8e8 / 122002577741 ≈ 2.19，≠ 1.78。所以 EPS 也不能简单解释为「指数利润 ÷ 流通股本」。另外 idxProfit 的单位在 u 中没有标注，按亿元换算本身也是假设。

**未知：**
- EPS 的正式定义：分子是 TTM、最新报告期还是年报；分母是总股本、计算用股本还是流通股本；整体法还是加权。
- 上游提供商（返回数据中没有来源字段，见上一份报告第 6 节）。
- EPS 频繁小幅变化的原因。
- **不能**把它定义为某个加权公式。

## 4. 与本地蛋卷数据的交叉观察（只是观察）

本地 `domestic_raw/dj_{pe,pb,roe}_SZ399006.json` 与原站同日期点对比：

| 字段 | 10y 重叠点 | 相对差中位数（最大） | 年度相对差中位数 | 1y 重叠点 | 相对差中位数（最大） | 最新 原站 / 蛋卷 |
|---|---|---|---|---|---|---|
| pe | 70 | 0.12%（10.0%） | 2017 为 8.3%，2020 年后 ≤ 0.14% | 45 | 0.03%（3.0%） | 27.51 / 27.506 |
| pb | 70 | 0.98%（7.4%） | 0.3% 到 3.9% 波动 | 45 | 0.91%（4.3%） | 3.86 / 3.8673 |
| roe | 53 | 1.48%（11.8%） | 0.6% 到 3.0% | 45 | 1.13%（4.1%） | 14.00 / 14.06 |

- 创业板的 PE 在 2020 年以后与蛋卷几乎一致，PB 和 ROE 不一致。上一轮恒生、沪深300 的 ROE 也和蛋卷不一致。
- 这**不能**证明原站来自蛋卷，或两者有同一上游。蛋卷也没有 EPS 字段，不能作为 EPS 的替代来源。

## 5. 本地为何空缺，能否补入

- **现状**：`data-bundle.js` 中 399006.SZ 的 `eps` 和 `bps` coverage 为 `count:0`。pe 和 roe 已有数据，来源是蛋卷（周频）。
- **原因**：
  - 现有 provider 没有可用的 EPS 来源。中证（indexCsiDsPe、indicator.xls、indexValuation）、国证 indexList（只有 peStatic/peDynamic/pb/市值）、蛋卷（只有 pe/pb/roe/yeild）都不公开指数 EPS。
  - CONTRACT 禁止用点位或 PE 推算 EPS，也禁止用 PE/PB 推算 ROE。
- **能否用原站 eps 作为独立字段补入：** 技术上可以映射，但**来源许可是阻碍**。
  - 原站数据由站方云函数提供，上游未公开，也没有许可说明。ROUND2 要求「不照抄」「不承诺与未授权数据一致」。
  - 把原站 eps 写进本地数据包，相当于转存原站数据。是否允许需要 manager 或用户明确决定，**我不建议默认补入**。
- **如果 manager 决定补入**，需要满足这些条件：
  - **字段**：独立来源，例如 `source.label="李神奇数据网 指数全景（ixSeries，上游未披露）"`，method 写明「元/每股，定义未披露，非每指数点；不与其他来源拼接」。
  - **单位**：元，保留原值，不做换算。前端标签用「每股盈利（元）」，不要标成「每指数点盈利」。
  - **频率与合并**：
    - 原站 1y 是日频，10y 是 5 日采样的周频，两者不能混成一列。
    - 只能整列选用同一 range 的数据。如果要长历史，只能用周频，并标明 step=5。
    - 原站日序列缺 20261112，按真实缺失保留 null，不前填进存储层。前端是否沿用原站的空值前填，由前端决定。
  - **整列规则**：eps、bps 应来自同一来源同一 range。不要用原站 bps 配蛋卷 roe，也不要用原站 eps 配中证 pe 计算任何衍生量。
  - **映射**：原站代码 `399006.SZ` 与本地相同。其他指数要逐个对照 roster：原站用 `HSI.HI`、`SPX.GI`、`IXIC.GI`、`000922.SH`，本地用 `HSI.HK`、`SPX.US`、`IXIC.US`、`000922.CSI`。

## 6. 证据文件

`reports/evidence/399006-eps-sample.json` 的内容：
- panel：`day`、`u.eps`、`u.bps`、399006.SZ 的完整 `rows` 行、`pct1y`、roster 条目；
- series 10y 和 1y：`d / price / pe / pb / roe / eps / bps / mcap`，以及 `freq / step / first / last / points / dailyPoints / shards / pct / pct1y / errors`。

本地对照文件：`data/providers/domestic_raw/dj_pe_SZ399006.json`、`dj_pb_SZ399006.json`、`dj_roe_SZ399006.json`，以及 `data/store/price_000001_SH.csv`（只读，作交易日历）。
