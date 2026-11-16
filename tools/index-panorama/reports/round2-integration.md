# ROUND2 集成报告（integration owner）

状态：**第三轮增量合并已完成**（domestic 107 项 + supplemental 41 项，共 36 只）。但字段**没有全部补齐**：turn/eps/bps 全空，roe 22/36，PB 24/36，详见“第三轮增量合并”。以下是按时间顺序保留的各阶段记录。

原状态：集成代码就绪，最终真实重建未执行。截至本报告，`data/providers/domestic.json`、`data/providers/supplemental.json` 都不存在（两个 provider owner 仍在工作），因此当前没有任何新来源数据可以接入，**不能称为已补齐**。provider 交付后由 manager 安排 followup 运行最终重建。

## 改动文件（均在 ROUND2 integration 所有权内）

| 文件 | 内容 |
|---|---|
| `fetch_data.py` | provider 缓存读取/校验、整列选源、availability、`--enrich-only`/`--collect-providers`/`--providers`/`--coverage-report`，严格 `--offline`，bundle 校验扩展，前后覆盖报告 |
| `providers/__init__.py` | 包标记（无逻辑），供显式 `--collect-providers` 导入 `providers.<name>` |
| `tests/test_enrichment.py` | 新增 20 项回归 |
| `README.md` | 刷新命令、provider 合并规则、当前真实缺口 |
| `reports/round2-integration.md` | 本报告 |

未改：前端/analytics、provider 实现与缓存、manager 审查脚本、`reports/round2-baseline.json`、`data-bundle.js`、`data/manifest.json`、`data/store/`（试跑写在临时目录）。`requirements.txt` 不需要新依赖（仍只有 xlrd，标准库实现）。`reports/round2-coverage.json` 尚未生成，留给最终重建。

## 实现要点

1. **读取**：`load_provider_cache(name)` 只读 `data/providers/<name>.json`；缺失 → `missing`，损坏/provider 名不符 → `invalid`，都返回空态，bundle 正常生成并写 warnings。默认绝不导入 provider 模块，只有显式 `--collect-providers` 才调 `collect(indices, as_of, offline=False)`，异常回退读缓存。`--offline` 与 `--collect-providers` 互斥（argparse 退出码 2）。
2. **严格离线**：`--offline` 与 `--enrich-only` 把网络函数替换为 `offline_get`（任何 URL 立即 FetchError），并且所有行情/中证更新走 store 只读分支。测试同时拦截 `socket.create_connection`/`socket.socket.connect`，证明没有连接。
3. **字段校验**（`normalize_provider_field`，出错整列拒收并写原因，不修补）：ISO 日期、严格升序去重、d/v 等长、有限数（拒绝 NaN/布尔/字符串）、null 不当 0、status 与数据一致、来源 label/url/method、频率白名单（含中文别名）、单位按契约核对不换算（pe/pb 倍；dy/turn/roe %；mcap/amt 亿元；volume 股；eps/bps 不得是“点”）。price/chg 不允许 provider 覆盖；未知 code 记录在 `unknownCodes`。
4. **整列选源**（`select_column`）：每个字段只选一个来源。amt/volume 有腾讯/中证数据时整列保留；其他字段在 现有中证/domestic/supplemental 中按「仍在更新(≤400天) → 样本数 → 最新日期 → 固定次序」选一列，落选候选及原因保存在 `availability.<f>.candidates`；`validate_bundle` 强制每个有数据的 provider 字段恰好一个选中来源。
5. **日期**：轴 = 价格日 ∪ 中证日 ∪ 选中列观测日。provider 报告日不按价格交易日历过滤（测试用 2026-10-31 周六月末报告日）；只裁掉 floor/`--since` 前与今天后的观测并记录 `rawCount`。chg 只连接真实价格观测。
6. **componentNum**：只收带 ISO 日期 + 来源 label/url 的正整数，多来源取最新日期，`sources.componentNum` 标来源；无日期的披露被拒并写入 `availability.componentNum.reason`。
7. **输出**：series 新增 `availability`（12 字段 + componentNum：status/provider/frequency/unit/count/first/last/reason/candidates），`sources.<f>` 增 `frequency`/`provider`；bundle 顶层增 `providers` 摘要；全局 warnings 按实际覆盖动态生成（不再硬编码“PB等全部为 null”）。`data/manifest.json` 增 mode/networkAllowed/providers（拒收字段明细）。schemaVersion 保持 1，均为新增键，前端读取的原字段不变。
8. **前后覆盖**：`build_coverage_report` 写 `reports/round2-coverage.json`：before 取 manager 基线 `round2-baseline.json`（并附上一版 bundle 覆盖），after 为本次 availability，逐字段 `filled`/`lost`/`delta`，`summary` 汇总每字段补齐与丢失的指数清单。

## 实际命令与结果

| 命令 | 退出码 | 结果 |
|---|---|---|
| `.venv/bin/python -m unittest discover -s tests -p 'test_fetch.py'` | 0 | 33 项通过（旧测试未退化） |
| `.venv/bin/python -W error::ResourceWarning -m unittest discover -s tests -p 'test_*.py'` | 0 | 53 项通过（33 旧 + 20 新） |
| `node --test tests/*.cjs` | 0 | 40 项通过 |
| 真实 store `--enrich-only` 试跑（BUNDLE/MANIFEST/coverage 指向 scratchpad 临时目录） | 0 | 35 只纳入；与现有 `data-bundle.js` 对比 35 只 × (d + 12 列) **0 处差异**；bundle 13.05 MB（原 12.97 MB，增量为 availability 元数据）；两个 provider 均 `missing`，coverage summary pe 0→0 |

旧测试总数 33 + 40 = 73，未退化；加上新增 20 项共 93 项。本轮没有对中证或任何外部来源发起网络请求。

## 最终重建（followup 待执行）

provider 两个缓存落盘后：

```sh
cd output/指数全景
.venv/bin/python fetch_data.py --enrich-only          # 只读 store + provider 缓存，不联网
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' && node --test tests/*.cjs
```

然后用 `reports/round2-coverage.json` 的 `summary` 与逐指数 `after.reason` 更新 README「当前缺口」与本报告。`data/manifest.json.providers.<name>.rejected` 会列出被拒收字段及原因，需要反馈给对应 provider owner。

## 第一次回修（manager 复审 task_e825d562f73f）

1. `normalize_provider_payload`：`node.fields` 为非对象（如 `["bad"]`、`"bad"`、数字）原先会 `AttributeError: .items()` 让整次更新崩溃。现在记入 `rejected`（`<code>.fields: 不是对象（list），整组字段拒收`），该指数字段为空，同节点的合法 componentNum 和其他指数照常接入。回归：`test_non_object_fields_rejected_not_crash`。
2. componentNum 未来披露：`build_series` 用 `until`（主流程为运行当天）过滤所有成分股数候选，晚于 until 的披露拒收并写入 `availability.componentNum.rejected`（如 `supplemental: 披露日期 2099-01-01 晚于 2026-11-15（未来日期），拒收 value=999`）；有真实已披露值时回落到它，没有时 componentNum/componentDate 为 null 且 reason 写明原因。回归：`test_future_component_disclosure_rejected_with_reason`。

结果：`.venv/bin/python -W error::ResourceWarning -m unittest discover -s tests -p 'test_*.py'` 退出码 0，55 项通过（旧 33 + 新 22）；`node --test tests/*.cjs` 退出码 0，40 项通过；真实 store `--enrich-only` 试跑（输出到临时目录）退出码 0，35 只 × (d+12列) 与现有 bundle 0 差异。生产 bundle/manifest/store 与 provider 缓存仍未改动。

**前端待修项（不属本 owner，manager 会另派）**：集成层对 single 频率只给出“不能生成历史分位”的 warning/metadata，但现有前端 `stats` 在 count=1 时仍算出 percentile=100% 并显示“偏热”。需前端在 count 过小/单期时不显示分位与温度结论；本 owner 未越界修改前端。

## 阶段 A：接入 domestic 的生产重建（task_426a510ebc89）

命令（均在 `output/指数全景`）：

| 命令 | 退出码 | 结果 |
|---|---|---|
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` | 0 | 81 项通过（含其他 owner 新增） |
| `node --test tests/*.cjs` | 0 | 47 项通过 |
| `.venv/bin/python fetch_data.py --enrich-only --providers domestic` | 0 | 35 只；domestic 0 个字段被拒收 |
| 只对 932000.CSI 调 `update_csi`（中证 index-perf，2 个窗口，没有重抓全市场） | 成功 | 3126 行，2013-12-31~2026-11-11；丢弃 2 行伪行（请求起始日 2013-12-30、窗口边界），全部在上证交易日历内 |
| 再次 `.venv/bin/python fetch_data.py --enrich-only --providers domestic` | 0 | **36 只**（中证2000 首次纳入），13.5 MB |

supplemental 按 manager 指示**没有接入**（`--providers domestic`），也没有读取或修改它的缓存。

**补齐结果**（A 股 29 只原有 + 中证2000 共 30 只；before 是 manager 基线，全部为 0）：
- PE：30/30（29/29 原有 A 股）。399303.SZ 国证2000 只有单期。
- PB：20/30。缺 000906、000985、000986、000987、000988、000990、000992、000994、000995、932000，原因见各指数 `availability.pb.reason`（蛋卷未覆盖，没有同口径公开来源）。000001.SH、399303.SZ 只有单期。
- 股息率：29/30。缺 399303.SZ。399001.SZ、399006.SZ 只有单期，其余是中证 indicator.xls 的 20 个近期日。
- componentNum：1 只（932000.CSI，2000 只，2026-11-11，中证 consNumber）。其余 A 股的 componentNum 等 supplemental 提供。
- 抽查：000001.SH 2026-11-11 的 PE 14.64、PB 1.38，与 manager 独立 GET 一致。932000.CSI 的中证 peg 和 domestic PE 有 827 个共同日，差值为 0（整列选源同分时按次序选了中证 store）。

**保留历史**：比较重建前 bundle（备份在 scratchpad）和现在的 bundle，35 只原有指数的 price/chg/amt/volume 按日期**逐值没有变化**，`round2-coverage.json` 的 `summary.*.lost` 全部为空。日期轴只增加估值观测日：蛋卷 PB 周频有 3 个周六（2020-01-11、2022-04-02、2024-12-07），这天 price 为 null；部分主题指数的 PE 历史早于点位首日（例如 399967 PE 从 2014-04-02 开始）。

港美 6 只仍然没有任何估值、成交额和成交量，mcap/turn/eps/roe/bps 全部为空，都等 supplemental 修好口径后二次合并。前端单期分位问题已经由 sparse-ui 修复（manager 告知）。

| 指数 | PE | PB | 股息率 | 成分股数 |
|---|---|---|---|---|
| 000001.SH 上证指数 | 3666（日，2011-06-28~2026-11-11，中证指数官网） | 1（单期，2026-11-11~2026-11-11，中证指数官网 每日指数信息-指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 399001.SZ 深证成指 | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 1（单期，2026-11-13~2026-11-13，蛋卷基金指数估值） | — |
| 399006.SZ 创业板指 | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 1（单期，2026-11-13~2026-11-13，蛋卷基金指数估值） | — |
| 000688.SH 科创50 | 1541（日，2020-07-06~2026-11-11，中证指数官网） | 355（周，2019-12-31~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000016.SH 上证50 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000300.SH 沪深300 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000905.SH 中证500 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000852.SH 中证1000 | 3488（日，2012-06-29~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000903.SH 中证A100 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000906.SH 中证800 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000985.SH 中证全指 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 399303.SZ 国证2000 | 1（单期，2026-11-13~2026-11-13，国证指数官网） | 1（单期，2026-11-13~2026-11-13，国证指数官网） | — | — |
| 932000.CSI 中证2000 | 827（日，2023-06-13~2026-11-11，中证指数） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | 2000 |
| 000922.CSI 中证红利 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000932.SH 中证消费 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 399967.SZ 中证军工 | 3066（日，2014-04-02~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 399975.SZ 证券公司 | 2792（日，2015-05-18~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 399986.SZ 中证银行 | 2792（日，2015-05-18~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 399971.SZ 中证传媒 | 2920（日，2014-11-06~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000827.SH 中证环保 | 3668（日，2011-07-08~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000986.SH 全指能源 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000987.SH 全指材料 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000988.SH 全指工业 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000989.SH 全指可选 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000990.SH 全指消费 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000991.SH 全指医药 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000992.SH 全指金融 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000993.SH 全指信息 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | 516（周，2016-11-14~2026-11-13，蛋卷基金指数估值） | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000994.SH 全指通信 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |
| 000995.SH 全指公用 | 3668（日，2011-06-28~2026-11-11，中证指数官网） | — | 20（日，2026-10-15~2026-11-11，中证指数官网 indicator.xls） | — |

## 最终合并（domestic + supplemental，task_92b972659a2f）

命令（均在 `output/指数全景`）：

| 命令 | 退出码 | 结果 |
|---|---|---|
| `.venv/bin/python fetch_data.py --enrich-only`（默认 `--providers domestic,supplemental`，不联网） | 0 | 36 只，13.6 MB，validate_bundle 通过 |
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` | 0 | 88 项通过（fetch/enrichment/domestic/supplemental） |
| `node --test tests/*.cjs` | 0 | 52 项通过 |
| `node --check` analytics/app/home/detail/data-bundle | 0 | 语法通过 |
| 用真实 bundle 调 `PanoMath.stats`（36 只 × 6 指标 × 5 区间 = 1080 次）和 `compare`（取前 8 只） | 0 | 0 异常 |

`reports/manager_audit.py` 会改写 manager 的 `manager-math-audit.json`，属于 manager 的审查脚本，本 owner 没有运行，留给 manager 的独立数学审查。

**拒收与丢失**
- domestic：status ok，79 个 ok 字段，rejected=[]，errors=0。
- supplemental：status ok，retrievedAt 2026-11-15T18:31:43Z，41 个 ok 字段，rejected=[]。errors 有 2 条，都是 HSTECH 月末 PE/股息率 xlsx 302→404，属于来源侧记录，没有字段被拒收。
- `round2-coverage.json`：所有字段 `summary.*.lost` 为空。
- 原值保留：与 ROUND2 之前的原始 bundle 相比，36 只的 price/chg/amt/volume 按日期逐值没有变化。唯一的新增是 HSI/HSTECH/HSCEI 的 amt，从 0 个观测变成 30 个，这是 supplemental 用恒生官方港元成交额 × 同日 ECB 参考汇率换算出的**人民币亿元派生值**，原币保存在 provider extras.amtHKD（HSI 2026-11-13 为 775.92）。A 股 amt/volume 仍是腾讯原列，没有被 provider 覆盖。

**口径提醒（不是全部补齐）**
- mcap：30 只 A 股都只有**单期**。27 只中证指数是**自由流通市值**（`sources.mcap.marketCapBasis=free_float`），399001/399006/399303 三只国证指数是总市值（`total`）。港美 6 只没有市值。
- 港股：HSI/HSCEI 的 PE/股息率和 3 只港股的成交额都只有 **30 个日度观测**（2026-10-02~2026-11-13），分位只反映近期。HSTECH 没有 PE/股息率。
- 美股：SPX/DJI 的 PE/股息率只有 WSJ 的**单期**。IXIC 没有估值（WSJ 只有 Nasdaq 100，不能替代）。美股没有成交额，SPX/DJI 没有成分股数。
- PB 20/36：10 只中证全指/行业/中证800/中证2000 和港美 6 只缺。000001/399303 的 PB 只有单期。
- turn/eps/roe/bps：36 只**全部为空**。没有官方公开字段，禁止由 PE/PB/点位合成，原因见各指数 `availability.<f>.reason`。
- volume：932000.CSI 和港美 6 只为空（官方源只给成交额或单位无文档）。

### 逐字段补齐数量

| 字段 | 有数据/36 | 仍缺 |
|---|---|---|
| price | 36 | — |
| chg | 36 | — |
| pe | 34 | HSTECH.HK、IXIC.US |
| pb | 20 | 000906.SH、000985.SH、932000.CSI、000986.SH、000987.SH、000988.SH、000990.SH、000992.SH、000994.SH、000995.SH、HSI.HK、HSTECH.HK、HSCEI.HK、SPX.US、IXIC.US、DJI.US |
| dy | 33 | 399303.SZ、HSTECH.HK、IXIC.US |
| mcap | 30 | HSI.HK、HSTECH.HK、HSCEI.HK、SPX.US、IXIC.US、DJI.US |
| amt | 33 | SPX.US、IXIC.US、DJI.US |
| turn | 0 | 全部 36 只 |
| eps | 0 | 全部 36 只 |
| roe | 0 | 全部 36 只 |
| bps | 0 | 全部 36 只 |
| volume | 29 | 932000.CSI、HSI.HK、HSTECH.HK、HSCEI.HK、SPX.US、IXIC.US、DJI.US |
| componentNum | 34 | SPX.US、DJI.US |

### 逐指数（观测数+频率；— 表示空）

| 指数 | PE | PB | 股息率 | 市值 | 成交额 | 成分股数 |
|---|---|---|---|---|---|---|
| 000001.SH 上证指数 | 3666日 | 1单期 | 20日 | 1单期·自由流通 | 5309日 | 2236 |
| 399001.SZ 深证成指 | 516周 | 516周 | 1单期 | 1单期·总市值 | 5309日 | 500 |
| 399006.SZ 创业板指 | 516周 | 516周 | 1单期 | 1单期·总市值 | 3994日 | 100 |
| 000688.SH 科创50 | 1541日 | 355周 | 20日 | 1单期·自由流通 | 1663日 | 50 |
| 000016.SH 上证50 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 5309日 | 50 |
| 000300.SH 沪深300 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 5309日 | 300 |
| 000905.SH 中证500 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 5309日 | 500 |
| 000852.SH 中证1000 | 3488日 | 516周 | 20日 | 1单期·自由流通 | 5309日 | 1000 |
| 000903.SH 中证A100 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 5067日 | 100 |
| 000906.SH 中证800 | 3668日 | — | 20日 | 1单期·自由流通 | 5309日 | 800 |
| 000985.SH 中证全指 | 3668日 | — | 20日 | 1单期·自由流通 | 5309日 | 5117 |
| 399303.SZ 国证2000 | 1单期 | 1单期 | — | 1单期·总市值 | 3070日 | 2000 |
| 932000.CSI 中证2000 | 827日 | — | 20日 | 1单期·自由流通 | 3126日 | 2000 |
| 000922.CSI 中证红利 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 5309日 | 100 |
| 000932.SH 中证消费 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 4218日 | 36 |
| 399967.SZ 中证军工 | 3066日 | 516周 | 20日 | 1单期·自由流通 | 2734日 | 79 |
| 399975.SZ 证券公司 | 2792日 | 516周 | 20日 | 1单期·自由流通 | 2734日 | 47 |
| 399986.SZ 中证银行 | 2792日 | 516周 | 20日 | 1单期·自由流通 | 2734日 | 42 |
| 399971.SZ 中证传媒 | 2920日 | 516周 | 20日 | 1单期·自由流通 | 2734日 | 50 |
| 000827.SH 中证环保 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 3608日 | 100 |
| 000986.SH 全指能源 | 3668日 | — | 20日 | 1单期·自由流通 | 3711日 | 50 |
| 000987.SH 全指材料 | 3668日 | — | 20日 | 1单期·自由流通 | 3711日 | 158 |
| 000988.SH 全指工业 | 3668日 | — | 20日 | 1单期·自由流通 | 5309日 | 362 |
| 000989.SH 全指可选 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 3711日 | 140 |
| 000990.SH 全指消费 | 3668日 | — | 20日 | 1单期·自由流通 | 5309日 | 50 |
| 000991.SH 全指医药 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 3711日 | 119 |
| 000992.SH 全指金融 | 3668日 | — | 20日 | 1单期·自由流通 | 3711日 | 127 |
| 000993.SH 全指信息 | 3668日 | 516周 | 20日 | 1单期·自由流通 | 3711日 | 147 |
| 000994.SH 全指通信 | 3668日 | — | 20日 | 1单期·自由流通 | 5309日 | 57 |
| 000995.SH 全指公用 | 3668日 | — | 20日 | 1单期·自由流通 | 5309日 | 50 |
| HSI.HK 恒生指数 | 30日 | — | 30日 | — | 30日·CNY派生 | 95 |
| HSTECH.HK 恒生科技 | — | — | — | — | 30日·CNY派生 | 30 |
| HSCEI.HK 恒生国企 | 30日 | — | 30日 | — | 30日·CNY派生 | 50 |
| SPX.US 标普500 | 1单期 | — | 1单期 | — | — | — |
| IXIC.US 纳斯达克综指 | — | — | — | — | — | 3395 |
| DJI.US 道琼斯工业 | 1单期 | — | 1单期 | — | — | — |

## 第三轮增量合并（domestic +28 项，task_5f0faf9b2a87）

命令（均在 `output/指数全景`）：

| 命令 | 退出码 | 结果 |
|---|---|---|
| `.venv/bin/python fetch_data.py --enrich-only`（读取 domestic 107/136 和 supplemental 41 两份缓存，不联网） | 0 | 36 只，13.7 MB，validate_bundle 通过 |
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` | 0 | 91 项通过 |
| `node --check data-bundle.js` 加真实 bundle 的 `PanoMath.stats`（36 只 × 7 指标含 roe × 5 区间 = 1260 次） | 0 | 0 异常 |

前端由另一位 Claude 独占，本轮没有改动前端，也没有跑前端 UI 测试。

**拒收与保留**
- domestic：status ok，retrievedAt 2026-11-15T18:43:18Z，107 个 ok 字段，rejected=[]，errors=0。
- supplemental：41 个 ok 字段，rejected=[]，errors 仍是 HSTECH 月末 xlsx 404 那 2 条来源侧记录。
- 与合并前的 bundle 逐值比较，36 只 × 12 列中已有数据（含 componentNum）**0 处变化**，coverage 里没有任何字段丢数据，新增全部来自原本为空的列。HSI/HSCEI 仍用恒生官方 PE/股息率，SPX/DJI 仍用 WSJ 单期 PE/股息率。HSTECH 的 PE 列只有 domestic 一个有效候选（supplemental 为空），整列选源没有拼接。

**新增 28 项（全部是蛋卷基金指数估值，匿名接口，蛋卷自有口径，非指数公司官方值）**
- roe 22 只（周频，约 2019-10~2026-11）：A 股 18 只（399001、399006、000688、000016、000300、000905、000852、000903、000922、000932、399967、399975、399986、399971、000827、000989、000991、000993），以及 HSI、HSTECH、HSCEI、SPX。单位：接口给的是小数，provider 乘 100 后为 %（1=1%）。本 owner 抽查原始文件：000300 的 roe_history 末值 0.0993 → 9.93%，SPX 的 0.2239 → 22.39%，都与 bundle 一致。
- pb 4 只（周频）：HSI、HSCEI、SPX 为 516 个观测（2016-11-14~2026-11-13），HSTECH 为 326 个（2020-07-27 起）。抽查原始文件：HSTECH 末值 2.0545、SPX 末值 5.2883，都与 bundle 一致。
- HSTECH 的 pe 为周频 326 个（末值 20.0276，与原始文件一致），dy 为单期 1.2%。

### 当前逐字段覆盖

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
| eps | 0 | 全部 36 只 |
| roe | 22 | 000001.SH、000906.SH、000985.SH、399303.SZ、932000.CSI、000986.SH、000987.SH、000988.SH、000990.SH、000992.SH、000994.SH、000995.SH、IXIC.US、DJI.US |
| bps | 0 | 全部 36 只 |
| volume | 29 | 932000.CSI、HSI.HK、HSTECH.HK、HSCEI.HK、SPX.US、IXIC.US、DJI.US |
| componentNum | 34 | SPX.US、DJI.US |

仍未补齐：turn/eps/bps 36 只全空；roe 缺 14 只；PB 缺 12 只；IXIC 没有任何估值；港美的市值和成交量缺失；美股没有成交额；SPX/DJI 没有成分股数。所有缺失都没有用代理指数或公式合成，原因见 bundle 的 `availability.<字段>.reason`。

## 已知风险 / 给 manager 的提示

- provider 的月末报告日若落在周末，A 股日期轴会出现非交易日（price 为 null）。这是 ROUND2 要求的行为；`reports/manager_audit.py` 若断言 A 股日期全是工作日，需要 manager 调整，本 owner 未改该脚本。
- 选源以「仍在更新 + 样本数」为主；如果 manager 希望某个字段固定使用指定 provider（例如官方口径优先于样本数），需要改为显式优先表。
- provider 若用非契约单位（如 dy 用小数、mcap 用万元）会被整列拒收，不会自动换算；需要 provider owner 按契约输出。
- 932000.CSI（中证2000）无价格来源，即使 provider 有估值也不纳入（全局 warning 会注明）。
