## Why

回测详情页的「资金与收盘价变化曲线」只能看建仓日以来的全部数据，且价格只有一条收盘价折线，看不出每天的开高低收。需要能自由选择时间区间，并用 K 线展示价格。

## What Changes

- 曲线上方新增时间区间控件：快捷按钮（近 1 月 / 3 月 / 半年 / 1 年 / 全部）+ 起止日期输入框。**区间与建仓日无关**：可以选到建仓日之前，建仓前只显示 K 线，资金三条线从建仓日起才有。
- 上图的紫色收盘价折线改为日 K 线（A 股惯例：红涨绿跌）；预计买入/卖出线与步长虚线保留，但改用不与红绿冲突的颜色。
- 下图资金曲线（持仓市值、占用本金、总盈亏）保持累计值，截取区间时数值不变，不把区间起点重置为 0。
- 日线数据增加开盘价：`Candle` 与 `EquityPoint` 增加开盘价，云端与腾讯两个数据源都带上；本地日线缓存从 v2 升到 v3。
- 为画建仓之前的 K 线，图表单独多取一段建仓日之前的日线，仅用于显示，不参与回测计算。
- 本次只做日 K，不做周 K / 降采样。

## Capabilities

### New Capabilities
- `grid-equity-chart`: 网格回测详情页「资金与收盘价变化曲线」的时间区间选择与 K 线展示。

### Modified Capabilities

（无。现有规格没有覆盖曲线展示行为。）

## Impact

- `notes-site/src/lib/grid-trading.ts`：`Candle`/`EquityPoint` 类型、`downloadCandles`、`fetchDailyBars`、`mergeQuote`、`fetchQuotes`（实时报价补开盘价）、缓存键、`renderEquityChart`。
- `notes-site/src/pages/lab/grid-trading/detail.astro`：区间控件与渲染调用；`grid-trading.astro`（计算器页）共用绘图函数，保持显示全部、不加控件。
- 云端 Worker `/daily` 已返回 `open`，无需改动、无需重新部署 Worker。
- 无数据库、接口契约变化。
