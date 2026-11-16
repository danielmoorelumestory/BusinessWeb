# 指数全景（本地独立应用）

一个纯本地的指数全景工具：HTML + 普通 JS + 本地 ECharts，数据打包在 `data-bundle.js`（`window.PANO_DATA`），打开时**不需要联网**。

## 预览

- **双击打开**：直接双击 `index.html`（file:// 方式）即可，数据来自同目录的 `data-bundle.js`（约 13 MB，首次加载需 1–2 秒）。
- **本地 HTTP**（开发/验收推荐）：
  ```sh
  cd output/指数全景
  python3 -m http.server 8765
  # 浏览器打开 http://127.0.0.1:8765/index.html#/panorama
  ```

## 刷新数据

```sh
cd output/指数全景
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # 仅首次；xlrd 只装在本目录
.venv/bin/python fetch_data.py                 # 全量：联网刷新腾讯点位/成交额 + 中证 PE/股息率，再读 provider 缓存
.venv/bin/python fetch_data.py --enrich-only   # 不重抓行情/中证：用现有 data/store + data/providers/*.json 重建（不联网）
.venv/bin/python fetch_data.py --offline       # 严格不联网：任何 HTTP 请求都会被拦截，只用本地 store/缓存
.venv/bin/python fetch_data.py --enrich-only --collect-providers   # 行情不重抓，但调用 provider 在线 collect（仅 provider 就绪后）
.venv/bin/python fetch_data.py --no-csi        # 中证不可达时跳过（保留 data/store 已有中证数据）
.venv/bin/python fetch_data.py --only 000300.SH,000688.SH   # 只更新部分指数
.venv/bin/python fetch_data.py --providers ""  # 不接入任何 provider（对照用）
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'   # 数据层测试（test_fetch + test_enrichment）
node --test tests/*.cjs                                          # 前端/数学测试
```

**原站 EPS（original_eps，2026-11-16 新增）**：`eps` 唯一来源为李神奇数据网（lishenqi.vip 指数全景，**计算口径未核实**），单位 元/每股，
原站 `all` 区间每 5 个交易日取 1 点（周频，非完整日频）。在正常打开的原站页面执行 `providers/original_eps_capture.js`（只读 `PANO_IX.series`）
得到脱敏 raw `data/providers/original_eps_raw/capture.json`，再 `.venv/bin/python providers/original_eps.py`（不联网）生成
`data/providers/original_eps.json`。只提供 eps，不替换本地 PE/PB/价格/ROE/股息率；详见 `reports/original-eps-integration.md`。

**无人值守刷新（远端/本机通用，不需要 Claude/Orca/MCP）**：`python refresh_runner.py --mode online [--bundle-out <前端 bundle 路径>]`。
它在 `data/refresh-work/<UTC>/app` 隔离 staging 里依次刷新行情/中证、domestic、supplemental，用 Playwright Chromium
抓原站 EPS，再 `--enrich-only` 统一生成，经门禁验证后才备份到 `data/refresh-backups/` 并逐文件原子替换生产数据。
退出码 0 成功、10 部分成功（已发布）、20 失败（未发布）、3 锁占用；报告写 `reports/refresh/last-refresh.{md,json}`。
依赖 `requirements-ci.txt` + `python -m playwright install chromium`；GitHub Actions 模板见 `ci/panorama-refresh.yml.example`，
就绪说明见 `reports/remote-refresh-readiness.md`。

provider 缓存由各自 owner 生成（`providers/domestic.py`、`providers/supplemental.py` 的 `collect(indices, as_of, offline)`，
输出 `data/providers/<name>.json`）。`fetch_data.py` 默认**只读**这两个文件、从不改写；文件缺失或损坏时该 provider 记为
`missing`/`invalid`，bundle 照常生成并在 `warnings`、`providers`、各指数 `availability` 中说明。

退出码：0 成功；2 没有任何指数可用（不覆盖旧 bundle），或参数冲突（如 `--offline --collect-providers`）；3 bundle 校验失败（不覆盖）。

每次成功生成还会写：
- `data/manifest.json`：模式（full/enrich-only/offline）、是否允许联网、各 provider 状态/拒收字段及原因、逐指数 availability；
- `reports/round2-coverage.json`：逐指数、逐字段**前后覆盖对比**。before 取 manager 基线 `reports/round2-baseline.json`（并附上一版 bundle 的覆盖），after 是本次 availability（来源、频率、样本数、首末日期、未补原因），`summary` 汇总每个字段补齐/丢失的指数。

## Provider 合并规则

- **校验**（不修补来源错误，整列拒收并写原因）：ISO `YYYY-MM-DD`、严格升序去重、`d`/`v` 等长、值为有限数（null 是缺失，不当 0）、`status`、来源 `label`/`url`/`method`、频率（daily/weekly/monthly/quarterly/annual/single/irregular）。
- **单位**按契约核对，不做换算：pe/pb 倍；dy/turn/roe `%`（1=1%）；mcap/amt 亿元；volume 股；eps/bps 保留来源原定义，但单位不得是“点”（指数盈利点位不能冒充每股字段）。price/chg 不接受 provider 覆盖。
- **整列选源**：同一字段只选一个来源，绝不逐日拼接。amt/volume 已有腾讯/中证数据时整列保留；其余字段在候选（现有中证、domestic、supplemental）中：仍在更新（最新观测距今 ≤400 天）优先 → 样本数多 → 最新日期近 → 固定次序。落选候选和原因写在 `availability.<字段>.candidates`。
- **日期**：日期轴 = 价格/中证日 ∪ 选中列的真实观测日。provider 报告日（月末可能是周末）**不按价格交易日历过滤**；只裁掉基日/`--since` 之前和今天之后的观测（`rawCount` 记录原始数）。价格日历清理仍只作用于价格。
- **componentNum**：只接受带 ISO 日期和来源 label/url 的正整数披露，多个来源取日期最新者，`sources.componentNum` 标明来源。
- 非日频列会在指数 `warnings` 中注明频率与样本数；单期观测注明“不能生成历史分位”。

行为要点：
- 请求有超时（腾讯 20s、中证 30s），失败最多重试 2 次，同一主机连续失败 4 次后本轮快速跳过；价格 3 并发（`--workers` 可调），中证 2 并发且请求间隔 0.3s。
- 任一来源失败时**保留** `data/store/*.csv` 中已有数据，只在 `warnings` 中说明，不清空。
- 所有 CSV 与 bundle 都**按日期去重、升序**，用临时文件 + `os.replace` **原子写入**。
- 首次运行时从只读缓存 `../布鲁斯的金融宝藏/replica/data/` 读取历史（**不修改**该目录），并从腾讯回补到 `--since`（默认 2005-01-01）；此后每次只回补最近 30 天。
- `data/manifest.json` 记录本次生成时间、参数、各指数覆盖、警告和被剔除的中证伪行数；`data/last_run.log` 是最近一次运行的日志（已加入 .gitignore）。

## 数据来源与口径

| 字段 | 来源 | 单位 | 说明 |
|---|---|---|---|
| price | 有缓存的指数标为“本地历史缓存 + 腾讯证券”，缓存原上游未标注、未验证；其余为腾讯证券日 K 收盘（`proxy.finance.qq.com/.../newfqkline/get`，旧 `web.ifzq.gtimg.cn` 端点作回退）；早期历史取本仓库只读缓存 | 点 | 指数不复权。缓存覆盖的日期（至 2026-11-10）保留缓存原值（3 位小数），之后用腾讯补新 |
| chg | 由同一 price 序列相邻两个观测计算 | % | 首个观测为 null |
| amt | 腾讯 newfqkline 第 9 列（万元 ÷ 1e4）；无腾讯时用中证 `tradingValue` | 亿元 | 每只指数只用一个来源，不逐日混拼；沪深300 2026-11-11 = 4421.28 亿，与中证官网一致 |
| volume | 腾讯（手 × 100）；缓存期为缓存原值 | 股 | 早期深市占位值（≤100 手）置 null；港股/美股口径不明，置 null |
| pe | 中证官网 `index-perf` 的 `peg`（官网滚动市盈率） | 倍 | 只用这一个口径。`indicator.xls` 的 PE1/PE2 只存进 `data/store/indicator_*.csv`，**不**和 peg 长历史拼接 |
| dy | 中证 `indicator.xls` 的“股息率2（计算用股本）D/P2” | % | 官方文件只有近期若干交易日，每次运行累积；样本很少，分位没有长期意义 |
| componentNum | 中证 `consNumber` 最新值 | 只 | componentDate 是该值的实际日期 |
| pb / mcap / turn / eps / roe / bps（及港美 pe/dy/amt/volume） | ROUND2 provider（domestic / supplemental 缓存） | 见上 | 按“Provider 合并规则”整列接入；provider 未就绪时为 null。腾讯 K 线里有一列像换手率，但来源没有说明口径，未采用 |

**日期独立**：中证数据通常比腾讯晚约 2 个交易日。每只指数的 `coverage.<字段>.last` 是该字段的实际最新日期，前端应显示字段自己的日期，不能当作同一天。

**中证起始日伪行**：中证 `index-perf` 会把首条真实数据复制到请求的 `startDate` 那一天，比如科创50 用 20160101 请求也会返回 2016-01-01 的行。清理方法：
1. 窗口首尾重叠 1 天，每个窗口丢弃日期 ≤ startDate 的行（这一天已被上一窗口覆盖，或者早于基日）；
2. 丢弃早于该指数真实基日/可得首日（`floor`，科创50 为 2019-12-31）的行；
3. 按上证指数可靠交易日历过滤，日历末日之后只保留工作日。

只读缓存里由中证导出的文件（`csindex_000985.csv`、`x_sh0009xx.csv`）也带这种伪行（2005-01-01、2010-01-01 元旦），同样按日历剔除。

不使用的来源：乐咕乐股（403/401，不绕过）；参考站 lishenqi.vip 的数据接口（要求登录，不调用）；任何收费或需要凭据的接口。

## CSV 补充

缺失字段（PB、ROE 等）可以在页面上“导入 CSV”临时补充，只在本次会话有效。表头：

```
code,name,category,date,price,chg,pe,pb,dy,mcap,amt,turn,eps,roe,bps,volume
```

其中 code/name/date 必填，至少要有一个有效数字；空单元格表示缺失（不会当作 0）。单位与上表相同（百分数 1 表示 1%，金额用亿元）。页面可以下载空模板。

合并规则（前端 app.js 实现）：
- **pe / pb 整列替换**：只要 CSV 为某个代码提供了任一非空 pe（或 pb），该指数的这一列就整列换成 CSV 的观测，原来源（如中证 peg）该列其余日期全部清空，来源改标“用户导入CSV，未经核验”。这是为了避免跨口径估值拼接。CSV 没给 pe/pb 时原列不受影响。
- 其他字段（price/chg/dy/mcap/amt/turn/eps/roe/bps/volume）按日期合并：导入的非空值覆盖同日值，空单元格保留原值，新日期追加。

## 2026-11-16 扩展：新增 27 只行业/主题指数（共 63 只）

清单在 `fetch_data.INDICES`（代码/全称/基日均核对中证官网 `index-basic-info`），详见 `reports/new-index-expansion.md`。
- **价格**：8 只有腾讯日K（`tsym`，自腾讯可得首日起）；19 只（93xxxx/H3xxxx/990001）腾讯无日K，点位/成交额/PE 取中证 `index-perf`，
  以 `data/store/csi_*.csv` 初始化，runner 的“生产已有中证 store”名单因此自动包含它们；新指数都不依赖外部研究目录缓存。
- **估值**：PE 中证官网滚动市盈率；股息率中证 indicator.xls D/P2（近约 20 日，逐次累积）；PB/ROE 仅蛋卷列表有同一指数代码的 5 只
  （399997/399989/399998/931079/H30269），其余为 null 并写明原因；EPS/BPS/换手率不合成。市值/成分股数取中证 index-feature 快照。
- **初始化不刷新旧指数**：`providers/domestic.py --missing-only`（已有 raw 的接口不联网）、`providers/supplemental.py --only <codes>`
  （只为所列指数下载，不写 `_last_online.json`）；旧 36 只的 provider 条目原样保留。中证收盘 ≤0 的无效行整行丢弃。

## 当前覆盖（2026-11-15 第三轮：domestic 107 项 + supplemental 41 项）

> 本节是 2026-11-15 扩容前的历史快照（当时 36 只）。现在的指数数量与字段覆盖以 `data-bundle.js` 和 `reports/refresh/last-refresh.md` 为准；页面侧栏、榜单按数据包动态统计。相关 ETF 目录见 `etf-catalog.js` 与 `docs/index-panorama.md`「ETF 目录」。

最近一次生产重建：`.venv/bin/python fetch_data.py --enrich-only`（默认两个 provider，退出码 0，不联网），共 36 只（中证2000 的价格单独取自中证 index-perf，已清理伪行）。两个 provider 都没有字段被拒收，前后对比里没有任何字段丢数据；原有 price/chg/amt/volume 按日期逐值保留。

| 字段 | 有数据/36 | 仍缺 |
|---|---|---|
| price | 36 | — |
| chg | 36 | — |
| pe | 35 | IXIC.US |
| pb | 24 | 000906.SH、000985.SH、932000.CSI、000986.SH、000987.SH、000988.SH、000990.SH、000992.SH、000994.SH、000995.SH、IXIC.US、DJI.US |
| dy | 34 | 399303.SZ、IXIC.US |
| mcap | 30 | HSI.HK、HSTECH.HK、HSCEI.HK、SPX.US、IXIC.US、DJI.US |
| amt | 33 | SPX.US、IXIC.US、DJI.US |
| turn | 0 | 全部 36 只 |
| eps | 15 | 21 只（原站名册无 16 只；港美 5 只原站 eps 全空），见 `reports/original-eps-coverage.json` |
| roe | 22 | 000001.SH、000906.SH、000985.SH、399303.SZ、932000.CSI、000986.SH、000987.SH、000988.SH、000990.SH、000992.SH、000994.SH、000995.SH、IXIC.US、DJI.US |
| bps | 0 | 全部 36 只 |
| volume | 29 | 932000.CSI、HSI.HK、HSTECH.HK、HSCEI.HK、SPX.US、IXIC.US、DJI.US |
| componentNum | 34 | SPX.US、DJI.US |

口径要点：
- **PE/PB/股息率**：A 股 PE 主要是中证官网日频（2011-06 起）；深市 399001/399006 是蛋卷周频（2016-11 起）；PB 主要是蛋卷周频（蛋卷自有口径）；股息率是中证 indicator.xls 的近期 20 日。港股 HSI/HSCEI 的 PE/股息率来自恒生官网日报，**只有 30 个日度观测**；美股 SPX/DJI 是 WSJ **单期**。
- **市值**：A 股 30 只只有**单期**。27 只中证指数是**自由流通市值**（`sources.mcap.marketCapBasis=free_float`，不是总市值），3 只国证指数是总市值。港美没有市值。
- **港股成交额**：恒生官方港元成交额 × 同日 ECB 参考汇率换算为**人民币亿元（派生）**，30 个观测，原币保存在 provider extras。美股没有指数成交额。
- **成分股数**：34/36（SPX、DJI 缺），每只都带披露日期和来源。
- **ROE**（第三轮新增）：22 只，来自蛋卷基金周频（自有口径，接口给小数，乘 100 后为 %）。港美的 HSI/HSTECH/HSCEI/SPX 另外新增了蛋卷 PB 周频；HSTECH 的 PE 为蛋卷周频，股息率为单期。
- **仍为空**：turn/eps/bps 36 只全空（没有官方公开字段，不由 PE/PB/点位合成）；roe 缺 14 只；PB 缺 12 只；volume 缺中证2000 和港美 6 只；IXIC 没有任何估值。缺失原因见 bundle 各指数的 `availability.<字段>.reason`，逐指数明细见 `reports/round2-integration.md`、`reports/round2-coverage.json`。
