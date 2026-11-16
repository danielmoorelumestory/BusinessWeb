# 指数全景 新增行业/主题指数扩展（2026-11-16）

数据 owner 报告。只改数据层文件，未改前端、`scripts/index-panorama-sync.mjs`、根工作流、ETF 目录文件；未 Git 提交。

## 1. 结果摘要

- 指数由 36 只扩为 **63 只**：新增 27 只，全部有真实价格与 PE，无空壳；旧 36 只在新数据包中**逐键完全一致**（d、12 字段数组、sources、availability、warnings、componentNum 全部相同）。
- 分类只用既有两类：**「行业指数」**＝中证全指样本空间、按中证行业分类的二/三级行业指数（6 只）；**「行业与主题」**＝产业/主题/细分行业指数（21 只）。不新增分类。
- 门禁：`refresh_runner.bundle_gate(生产旧包, 新包)` 通过（0 问题、0 修订）；`reports/manager_audit.py` outcome=passed（63 只）；离线 runner 全流程演练（`--mode offline --skip-eps`，在副本上）门禁+发布成功。
- 数据包 13.7 MB → **22.2 MB**（新增 27 只日频历史），前端/同步脚本 owner 请留意体积。

## 2. 代码核实（官方来源）

每只代码的全称、基日、基点、发布日均调用中证官网 `https://www.csindex.com.cn/csindex-home/indexInfo/index-basic-info/<代码>` 核对（2026-11-16），
并实测 `https://www.csindex.com.cn/csindex-home/perf/index-perf?indexCode=<代码>&startDate=20261101&endDate=20261116` 当日有收盘与 peg；
腾讯 `proxy.finance.qq.com/.../newfqkline/get?param=<sh|sz><代码>` 实测是否有日K。易混代码已排除：
- 931160 中证全指**通信设备** ≠ 000994 全指**通信服务**（两只独立收录，000994 原映射/数据不变）；
- 399976 **中证**新能源汽车 ≠ 蛋卷 SZ399417 **国证**新能源车（不借用其 PB/ROE）；
- 有色选 000819 中证申万有色金属（2004 基日、腾讯有日K），未收 930708 中证有色金属；
- 保险选 399809 中证方正富邦保险主题（中证官网检索“保险”结果中有跟踪产品标记）。
- 未能在中证 basic-info 查到的候选（H30085、399396、399441）未收录。

## 3. 新增清单与实际覆盖（生产数据包，asOf 2026-11-16）

| 代码 | 名称 | 分类 | 中证代码 | 基日 | 价格源 | 价格首日~末日(观测) | PE(源/数) | 股息率 | PB | ROE | 市值 | 成分数 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| H30184.CSI | 全指半导体 | 行业指数 | H30184 | 2004-12-31 | 中证index-perf | 2005-01-04~2026-11-16(5308) | domestic·3253（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 87（2026-11-16） |
| H30202.CSI | 全指软件 | 行业指数 | H30202 | 2004-12-31 | 中证index-perf | 2005-01-04~2026-11-16(5308) | domestic·3253（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 931160.CSI | 全指通信设备 | 行业指数 | 931160 | 2004-12-31 | 中证index-perf | 2018-12-28~2026-11-16(1877) | domestic·1876（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 931775.CSI | 全指房地产 | 行业指数 | 931775 | 2004-12-31 | 中证index-perf | 2005-01-04~2026-11-16(5310) | csi·1263（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 69（2026-11-16） |
| 930697.CSI | 全指家电 | 行业指数 | 930697 | 2004-12-31 | 中证index-perf | 2005-01-04~2026-11-16(5310) | csi·2771（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 69（2026-11-16） |
| H30199.CSI | 全指电力 | 行业指数 | H30199 | 2004-12-31 | 中证index-perf | 2005-01-04~2026-11-16(5308) | domestic·3253（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 59（2026-11-16） |
| 990001.CSI | 半导体芯片 | 行业与主题 | 990001 | 2011-12-30 | 中证index-perf | 2020-02-27~2026-11-16(1630) | domestic·1630（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 930651.CSI | 中证计算机 | 行业与主题 | 930651 | 2004-12-31 | 中证index-perf | 2005-01-04~2026-11-16(5310) | csi·2792（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 930713.CSI | 人工智能 | 行业与主题 | 930713 | 2012-06-29 | 中证index-perf | 2012-07-02~2026-11-16(3492) | csi·2752（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| H30590.CSI | 机器人 | 行业与主题 | H30590 | 2010-12-31 | 中证index-perf | 2011-01-04~2026-11-16(3853) | csi·2870（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 64（2026-11-16） |
| 931079.CSI | 5G通信 | 行业与主题 | 931079 | 2015-12-31 | 中证index-perf | 2015-12-31~2026-11-16(2640) | csi·1837（末2026-11-16） | domestic·20 | domestic·390 | domestic·390 | supplemental·1 | 50（2026-11-16） |
| 931151.CSI | 光伏产业 | 行业与主题 | 931151 | 2012-12-31 | 中证index-perf | 2012-12-31~2026-11-16(3367) | csi·1840（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 399976.SZ | 新能源车 | 行业与主题 | 399976 | 2011-12-31 | 腾讯 | 2015-08-04~2026-11-16(2740) | domestic·2794（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 931719.CSI | 电池 | 行业与主题 | 931719 | 2014-12-31 | 中证index-perf | 2014-12-31~2026-11-16(2884) | csi·1349（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 399989.SZ | 中证医疗 | 行业与主题 | 399989 | 2004-12-31 | 腾讯 | 2015-08-04~2026-11-16(2740) | domestic·2794（末2026-11-16） | domestic·20 | domestic·516 | domestic·516 | supplemental·1 | 50（2026-11-16） |
| 931152.CSI | 创新药 | 行业与主题 | 931152 | 2014-12-31 | 中证index-perf | 2014-12-31~2026-11-16(2884) | csi·1840（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 930743.CSI | 生物科技 | 行业与主题 | 930743 | 2011-12-31 | 中证index-perf | 2012-01-04~2026-11-16(3609) | csi·2735（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 399997.SZ | 中证白酒 | 行业与主题 | 399997 | 2008-12-31 | 腾讯 | 2015-06-16~2026-11-16(2774) | domestic·2773（末2026-11-16） | domestic·20 | domestic·516 | domestic·365 | supplemental·1 | 17（2026-11-16） |
| 930653.CSI | 食品饮料 | 行业与主题 | 930653 | 2004-12-31 | 中证index-perf | 2005-01-04~2026-11-16(5310) | csi·2792（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 99（2026-11-16） |
| 399998.SZ | 中证煤炭 | 行业与主题 | 399998 | 2008-12-31 | 腾讯 | 2015-06-16~2026-11-16(2774) | domestic·2773（末2026-11-16） | domestic·20 | domestic·516 | domestic·365 | supplemental·1 | 31（2026-11-16） |
| 000819.SH | 有色金属 | 行业与主题 | 000819 | 2004-12-31 | 腾讯 | 2005-01-04~2026-11-16(5310) | domestic·3670（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 930606.CSI | 中证钢铁 | 行业与主题 | 930606 | 2008-12-31 | 中证index-perf | 2009-01-05~2026-11-16(4339) | csi·2839（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 49（2026-11-16） |
| 000949.SH | 中证农业 | 行业与主题 | 000949 | 2004-12-31 | 腾讯 | 2005-01-04~2026-11-16(5310) | domestic·3670（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 49（2026-11-16） |
| 399973.SZ | 中证国防 | 行业与主题 | 399973 | 2011-06-30 | 腾讯 | 2015-08-11~2026-11-16(2735) | domestic·2922（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 50（2026-11-16） |
| 931066.CSI | 军工龙头 | 行业与主题 | 931066 | 2012-12-31 | 中证index-perf | 2012-12-31~2026-11-16(3367) | csi·2140（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 30（2026-11-16） |
| H30269.CSI | 红利低波 | 行业与主题 | H30269 | 2005-12-30 | 中证index-perf | 2006-01-04~2026-11-16(5068) | csi·3146（末2026-11-16） | domestic·20 | domestic·516 | domestic·365 | supplemental·1 | 50（2026-11-16） |
| 399809.SZ | 保险主题 | 行业与主题 | 399809 | 2011-12-31 | 腾讯 | 2015-07-28~2026-11-16(2745) | domestic·2757（末2026-11-16） | domestic·20 | — | — | supplemental·1 | 18（2026-11-16） |

说明：PE 列的 `csi` 与 `domestic` 都是中证官网“滚动市盈率”（index-perf 的 peg / indexCsiDsPe 的 peg），由既有 `select_column`
规则按样本数整列择一，不逐日拼接。股息率 20 个观测为中证 indicator.xls 近期窗口，逐次累积。市值为中证 index-feature 自由流通市值单期快照。

数据可得性限制（真实披露，不补造）：
- 腾讯 sz399xxx 日K只到 2015 年（与既有 399967/399975/399986 相同）；中证 index-perf 对 931160 只返回 2018-12-28 起、990001 只返回 2020-02-27 起，虽然基日更早。
- PB/ROE：只有蛋卷估值列表（`/djapi/index_eva/dj`，63 项）有同一指数代码的 5 只（SZ399997、SZ399989、SZ399998、CSI931079、CSIH30269）接入，蛋卷自有口径周频；其余 22 只 PB/ROE 为 null，原因写在 availability。
- EPS/BPS/换手率：27 只均为 null（原站 EPS 名册不含新指数；不由 PE/PB/点位合成）。成交量：中证源指数无，19 只为 null；腾讯 8 只有。

## 4. 同源策略与持续刷新

| 情形 | 价格/成交额 | PE | 股息率 | PB/ROE | 市值/成分数 |
|---|---|---|---|---|---|
| 有腾讯日K（8 只） | 腾讯日K（price_*.csv） | domestic：中证 indexCsiDsPe peg | domestic：indicator.xls D/P2 累积 | 蛋卷同代码（若有） | supplemental：中证 index-feature |
| 无腾讯（19 只） | 中证 index-perf（csi_*.csv，同中证2000） | 中证 peg（csi store 或 domestic，整列择一） | 同上 | 同上 | 同上 |

- `refresh_runner.py` 无需新增步骤：S1 腾讯 pass 刷新全部 `tsym`；`csi_codes_in_prod()` 以“生产已有 `data/store/csi_*.csv`”判定，
  新 19 只已用中证 store 初始化，因此自动在 S1 中证 pass 中刷新（名单 20 只＝中证2000+19）。新指数**不依赖**外部研究目录缓存
  （`cache=None`；腾讯 8 只自腾讯首日回补，中证 19 只自基日回补）。
- 未建 indicator_*.csv（与中证2000 一致：股息率由 domestic 提供；runner 丢弃新出现的 indicator store）。
- 保留：蛋卷滚动尾点替换规则（`is_replaceable_tail`/`ROLLING_TAIL_MAX_DAYS`）、原站 EPS 周采样门禁、十字光标代码均未改动。

## 5. 改动文件

- `fetch_data.py`：INDICES 新增 27 项（带核实注释）；`parse_csi_perf` 丢弃收盘 ≤0 的无效行，`build_series` 忽略 store 中此类行
  （2026-11-16 实测仅 H30184/H30199/H30202 的 2013-06-28 一行，旧 36 只的 store 中无此类行，故旧值不受影响）。
- `providers/domestic.py`：DANJUAN_ACTIVE 增 5 只；`DJ_SYM_OVERRIDE`（中证 93/H3 指数蛋卷代码用 CSI 前缀）。
- `providers/supplemental.py`：`collect(only=...)` / CLI `--only`：只为所列指数下载，不写 `_last_online.json`。
- `refresh_runner.py`：仅注释/文档（门禁不再写死 36 只；无腾讯指数经中证 store 持续刷新）。
- `tests/test_new_indices.py`（新增 7 项）、`tests/test_refresh_runner.py`（test_7 由写死 932000 改为按清单推导 20 只）。
- 数据：`data-bundle.js`、`data/manifest.json`、`reports/round2-coverage.json`、`data/providers/domestic.json`、`supplemental.json`（旧 36 条目原样 + 新 27 条目）、
  新增 `data/store/` 27 个文件、`domestic_raw/` 91 个、`supplemental_raw/csi_feature/` 27 个；README 新增扩展说明。

## 6. 采集过程（隔离、限速、不覆盖旧值）

1. 生产 `data/` 与 bundle 先快照，再整份复制到 scratch staging；所有联网都在 staging。
2. 腾讯：`fetch_data.py --only <8只> --no-csi --providers "" --workers 1`（其余指数 offline 读 store）。
3. 中证：19 只**逐只**单独调用 `fetch_data.py --only <code>`，每次间隔 2s（中证请求 0.3s 间隔），之后删除 indicator store。
4. domestic：`providers/domestic.py --missing-only`（已有 raw 的接口不联网，顺序请求，0.2s 间隔），新增 91 个 raw。
5. supplemental：`providers/supplemental.py --only <27只>`，只请求 27 个 index-feature（该函数内部 4 线程并发，27 次请求约 10s）。
6. **合并 provider JSON 而不重建旧条目**：发现生产 `domestic_raw` 早于 `domestic.json`（raw 采于 11-15，json 含 11-16 尾点），
   离线从 raw 重建会让 34/36 只旧条目回退（如 000300 PE 少 11-13/11-16）。因此 domestic/supplemental 的 36 只旧条目逐字取自生产 json，
   只追加 27 只新条目。（这一 raw/json 时差是既有状态，非本次引入；下一次在线 runner 会刷新 raw。离线演练中 HSI/HSTECH/HSCEI 的 componentDate/
   ECB unmatchedDates 也因此与生产不同，门禁判定无丢失。）
7. staging `fetch_data.py --enrich-only` → 与生产旧包逐键比较旧 36 只（0 差异）→ bundle_gate → manager_audit → 全部 Python/node 测试 → 只把新文件和上述 6 个文件拷回生产（拷前确认生产 data/ 与快照一致，仅 ETF owner 的 `data/etf_catalog.json` 为新增）。

## 7. 测试

- `python -m unittest discover -s tests -p 'test_*.py'`（生产目录，venv xlrd 2.0.1）：144 tests OK（含 ETF owner 新增测试）。
- `node --test tests/*.cjs`：70 pass / 0 fail。
- `reports/manager_audit.py`（staging）：passed，63 只。
- 离线 runner 演练（副本）：退出码 10（离线预期为 partial），门禁/发布 ok，修订 0。

## 8. 未完成 / 风险

- 未执行在线 runner（会刷新旧 36 只，按要求避免）；下次定时在线刷新会首次在线覆盖新 27 只，并沿用既有 provider_gate/bundle_gate。
- 22 只新指数无 PB/ROE；EPS/BPS/换手率全部为空。股息率样本仅 20 日。
- 数据包体积增至 22.2 MB。
