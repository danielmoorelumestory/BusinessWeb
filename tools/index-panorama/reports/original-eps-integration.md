# 原站 EPS 独立来源接入报告

2026-11-16，Claude worker（task_a8278ddcee8d）。用户已明确本地自用，并要求使用原站每股利润数据（参照截图：上证 2026-11-13 PE 15.93、EPS 0.79）。本次把原站 EPS 作为**独立 provider** 接入数据包，**只提供 `eps` 一个字段**。

## 1. 结论

- 36 只指数中 **15 只**有 EPS，均来自原站李神奇数据网（`original_eps`）。每只只用一份原站 `all` 区间历史，不和其他供应商拼接。
- 21 只保留缺失：16 只不在原站指数全景名册里；港美 5 只（HSI/HSTECH/HSCEI/SPX/IXIC）原站 eps 全为空。都**没有**伪造或用其他来源替代。
- 上证 2026-11-13 的 EPS 为 **0.79 元**，与截图一致。本地 PE 仍是中证官网 peg（2026-11-11 为 14.64）。**没有**采用原站 PE 15.93，也没有改动任何既有 PE/PB/价格/ROE/股息率数值。
- 独立比对新旧 bundle：36 只 × 11 个非 EPS 字段，原有日期上的非空值**全部不变**，`sources`/`availability` 也逐项相同；不一致数为 0。EPS 与原站 raw 逐日一一对应，唯一的差别是按既有 `--since 2005-01-01` 规则裁掉了更早的观测。

## 2. 取数路径与边界

- **路径**：复用 2026-11-15T20:02:24Z 已有的脱敏抓取 `data/providers/original_eps_raw/capture.json`。它是在正常打开的 `https://lishenqi.vip/#/panorama` 页面里，执行 `providers/original_eps_capture.js` 得到的。
  - 该脚本只调用页面自身的只读函数 `PANO_IX.panel()` 和 `PANO_IX.series(code,'all',FIELDS)`，即详情页「全部」区间发出的同一个 `ixSeries` 请求。
  - 20 次请求顺序执行，每次间隔 1.5 秒，遇错即停（含限流）。只保留 `d/eps` 和采样元数据。
- **本次没有发起任何新的原站请求**：缓存已覆盖所需的 20 只映射指数，raw 中 `errors=[]`。
- **安全**：没有读取 cookie、token 或请求头，没有绕过权限，也没有调用写接口。`providers/original_eps.py` 本身**不联网**，只解析 raw。
  - 解析时校验 raw 的顶层键和序列键都在白名单内，并拒收任何疑似凭据的键名。
  - 用 grep 检查 raw 和 provider JSON，token/cookie/openid/authorization 命中数为 0。
- **区间与频率**：
  - 原站 `10y` 和 `all` 都是服务端每 5 个交易日取 1 点（`freq=week, step=5`）；只有 `1y` 是日频，但只覆盖一年。
  - 需要更长历史时，查到页面公开支持的最长区间就是 `all`：服务端从 20020109 起，上证有 6029 个日点，下采样后为 1206 个点。所以本地标为**周频（step=5），非完整日频**，不声称是全日频或全历史。
  - 1y 日频和 all 周频没有混用。
- **交叉核对**：
  - 和此前独立采集的 10y 证据（`reports/evidence/original-provenance-sample.json`：上证、沪深300；`399006-eps-sample.json`：创业板 10y/1y）同日比较：上证 479/479 点、沪深300 479/479 点、创业板 10y 479/479 点和 1y 42 个重叠点全部相同。
  - 15 只的全部 EPS 日期都在本地上证交易日历内。

## 3. 口径（写入 sources/availability）

`sources.eps` 记录如下：

- `label`：「李神奇数据网（lishenqi.vip 指数全景，计算口径未核实）」；`url`：`https://lishenqi.vip/#/panorama`。
- `unit`：「元」，来自原站单位表 `u.eps=yuan`，原值不换算。
- `frequency`：`weekly`。`sampling` 为「每5个交易日取1点（step=5）」。
- 原站服务端信息：`serverFirst/serverLast/serverPoints/serverDailyPoints`。
- raw 非空样本：`rawSampleCount/rawFirstDate/rawLastDate`。
- `origCode/origName`、`capturedAt`，以及 `calcVerified:false`。
- `method` 写明以下几点：
  - 计算口径（盈利期、股本、加权方式）和上游原站都没有披露，未核实；
  - 不是每指数点盈利，和点位/PE 不存在恒等关系；
  - 不拼接其他来源。

数据包里的实际样本数、首末日期以 `availability.eps.count/first/last` 为准。被裁剪的数量写在 candidates 的 `rawCount` 和 `reason` 里。`domestic`、`supplemental` 的元数据原样保留。

## 4. 合并与日期

- 注册方式：`fetch_data.py` 的 `PROVIDER_NAMES` 新增 `original_eps`（只改了这一行和注释）。整列选源、校验和日期规则沿用现有架构。eps 的唯一 live 候选就是 original_eps；supplemental 原来的 unavailable 候选和原因仍保留。
- 日期轴是并集：如果原站 EPS 日期不在现有 `d` 中，就新增一行，其他字段为 null，不做前填。实际新增的日期行只出现在：
  - 399967.SZ：12 行（2014-01-02~2014-03-27）；
  - 399975.SZ、399986.SZ：各 90 行（2013-07-15~2015-05-13）。
  这些行都早于本地价格起始日，测试已确认这些行上的非 EPS 字段全部为 null。
- 裁剪：上证、深成各裁掉 144 个 2005 年以前的点，上证50 裁掉 49 个。这是既有 `--since` 规则，不是数据问题。

## 5. 实际覆盖清单

机器可读版本：`reports/original-eps-coverage.json`。

| 本地代码 | 名称 | 原站代码 | 数据包样本 | raw 样本 | 范围 | 说明 |
|---|---|---|---|---|---|---|
| 000001.SH | 上证指数 | 000001.SH | 1062 | 1206 | 2005-01-06 ~ 2026-11-13 | 周频 step=5；裁 144 个 2005 年前点 |
| 399001.SZ | 深证成指 | 399001.SZ | 1062 | 1206 | 2005-01-06 ~ 2026-11-13 | 同上 |
| 399006.SZ | 创业板指 | 399006.SZ | 799 | 799 | 2010-06-04 ~ 2026-11-13 | 周频 step=5 |
| 000688.SH | 科创50 | 000688.SH | 306 | 306 | 2020-07-28 ~ 2026-11-13 | 周频 step=5 |
| 000016.SH | 上证50 | 000016.SH | 1062 | 1111 | 2005-01-06 ~ 2026-11-13 | 裁 49 个 2005 年前点 |
| 000300.SH | 沪深300 | 000300.SH | 1050 | 1050 | 2005-04-11 ~ 2026-11-13 | 周频 step=5 |
| 000905.SH | 中证500 | 000905.SH | 964 | 964 | 2007-01-17 ~ 2026-11-13 | 周频 step=5 |
| 000852.SH | 中证1000 | 000852.SH | 587 | 587 | 2014-10-23 ~ 2026-11-13 | 周频 step=5 |
| 000903.SH | 中证A100 | 000903.SH（原站名「中证100」） | 995 | 995 | 2006-06-02 ~ 2026-11-13 | 同一代码；原站沿用旧名 |
| 000906.SH | 中证800 | 000906.SH | 964 | 964 | 2007-01-17 ~ 2026-11-13 | 周频 step=5 |
| 000922.CSI | 中证红利 | 000922.SH | 898 | 898 | 2008-05-28 ~ 2026-11-13 | 后缀不同、同一指数 |
| 399967.SZ | 中证军工 | 399967.SZ | 626 | 626 | 2014-01-02 ~ 2026-11-13 | 早于本地价格的 12 个日期补 null 行 |
| 399975.SZ | 证券公司 | 399975.SZ | 649 | 649 | 2013-07-15 ~ 2026-11-13 | 90 个早期日期补 null 行 |
| 399986.SZ | 中证银行 | 399986.SZ | 649 | 649 | 2013-07-15 ~ 2026-11-13 | 同上 |
| 000827.SH | 中证环保 | 000827.SH | 686 | 686 | 2012-09-28 ~ 2026-11-13 | 周频 step=5 |
| HSI.HK / HSTECH.HK / HSCEI.HK / SPX.US / IXIC.US | 港美 5 只 | HSI.HI 等 | 0 | 0 | — | 原站 eps 全为空，保留缺失 |
| 000985、399303、932000、000932、399971、000986~000995、DJI.US | 16 只 | 无 | 0 | 0 | — | 原站名册无，保留缺失 |

## 6. 前端（只改 detail.js 的 EPS 说明）

- 「估值与盈利」卡片在有 EPS 时显示来源说明，包括：EPS 来源、单位「元/每股」、周频（每 5 个交易日取 1 点，非完整日频）、本区间观测数和起止日期、「计算口径未核实」。
  - 同时注明 PE 的来源和口径，并说明：两条线来源不同、口径未统一，只在同一时间轴并列；同日 PE 与 EPS 不构成「点位 = 市盈率 × 每股盈利」的关系，不能互相换算。
- EPS 轴单位和最新值单位改为读取来源声明（显示为「元」）。其他功能没有改动。
- 浏览器实测：用 chrome-devtools 独立实例打开本地 http 服务的 `#/index/000001.SH`。
  - 卡片显示「每股收益 最新 0.790 元」，双轴为 倍/元，series 为 市盈率 2427 点、每股收益 486 点（近 10 年）。
  - 控制台只有 favicon 404。截图：`reports/screenshots/original-eps-000001-earn.png`。

## 7. 改动文件

- 新增：
  - `providers/original_eps.py`；
  - `tests/test_original_eps.py`（11 项）；
  - `data/providers/original_eps.json`；
  - `reports/original-eps-integration.md`；
  - `reports/original-eps-coverage.json`；
  - `reports/screenshots/original-eps-000001-earn.png`。
- 修改：
  - `fetch_data.py`：在 `PROVIDER_NAMES` 中注册；
  - `detail.js`：EPS 说明和单位；
  - `README.md`：eps 覆盖行和来源说明；
  - 重建产物 `data-bundle.js`、`data/manifest.json`、`reports/round2-coverage.json`。
- 复用、未改：`providers/original_eps_capture.js`、`data/providers/original_eps_raw/capture.json`。
- 重建前的备份放在会话 scratchpad，用于比对。

## 8. 命令与结果

```
.venv/bin/python providers/original_eps.py           → original_eps: 15/36 只有 EPS；errors=[]
.venv/bin/python fetch_data.py --enrich-only          → 写入 data-bundle.js：36 只，asOf 2026-11-13，退出 0（不联网）
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'   → Ran 102 tests OK（原 91 + 新 11）
node --test tests/*.cjs                               → pass 55 fail 0
独立比对脚本（旧/新 bundle + raw）                       → bad=0
```

## 9. 未验证项与风险

- 原站 EPS 的计算口径和上游都未知。它频繁小幅变动（见 `399006-eps-provenance.md`），原因也未知。只能作为「原站显示值」使用。
- raw 是 2026-11-15 的快照，之后不会自动更新。要更新，需要在正常页面重新执行抓取脚本，再跑 provider 和 `--enrich-only`。Python 端不会直接调用原站云函数。
- 本次没有重新联网，所以「全部」区间是否仍对匿名身份开放、是否限流，以 raw 采集当时的结果为准。
- 前端已有的 CSV 导入对 eps 按日期合并，这会把用户 CSV 和原站 EPS 逐日混合。这是既有行为，按要求保留，没有改动，建议二审时决定是否改成 eps 整列替换。
- 按 CONTRACT，本目录不做 git 提交，交付物以文件形式提交，等待 Codex 二审。
