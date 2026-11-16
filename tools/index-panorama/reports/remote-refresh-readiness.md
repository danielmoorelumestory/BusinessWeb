# 远端无人值守刷新：就绪报告

2026-11-16，Claude worker（task_d5aa4335e09a / ctx_306403e8e696）。本次只在本地准备可审查的文件：

- 没有做 Git 提交或推送，没有新建仓库，也没有启用任何远端任务；
- 没有改根目录 `.github/`：按 manager 的变更指令，workflow 只以模板形式放在应用目录内，由 BusinessWeb 整合方移植；
- 没有改前端，也没有改其他研究目录；
- 非 EPS 数据源的代码和选源规则都没有改动；
- 生产数据未被改动：`data-bundle.js` 仍是 07:06:29Z 生成的那一版。

## 1. 结论

- `refresh_runner.py` 是一个固定脚本，Linux GitHub Actions 上可以直接跑，不需要 Claude、Orca 或 MCP。
  - 刷新全部在隔离的 staging 目录里进行，经过 provider 门禁、EPS 门禁、数据包门禁和 manager_audit 复算后，才备份并原子替换生产数据。
  - 任何一步失败，生产数据都保持不变；结果按 **成功 / 部分成功 / 失败** 如实报告。
- **在线全流程已在应用的临时副本上真实跑通**（本机网络，跳过 EPS）：
  - 退出码 10，即部分成功并已发布（发布到副本，不是生产）；
  - 价格最新到 2026-11-16，A 股 PE/PB 最新到 2026-11-13，数据包门禁和 manager_audit 都通过，原子替换 108 个文件。
  - 部分成功的原因：恒生官网 HSTECH 月度 PE/DY xlsx 返回 404，supplemental 对这两个接口沿用了上一份有效 raw。
- **原站 EPS 在线冒烟成功**：只抓上证、创业板 2 只，用 Playwright 1.55 自带的 Chromium headless，耗时 20.9 秒，`errors=[]`，原站面板日 20261116，单位 yuan，周采样 step=5。门禁通过，未发布。
- 演练中发现并修复了两个会**悄悄改数据**的问题，详见第 4 节：
  1. 在线全量 `fetch_data` 会改变 50 多列的选源；
  2. 原站 EPS 的采样网格每天都会平移。

## 2. 可部署路径与打包清单（给整合方）

### 2.1 远端自包含所需文件（相对应用目录 `APP_DIR`，均在 `output/指数全景/` 内）

| 类别 | 路径 | 说明 |
|---|---|---|
| runner | `refresh_runner.py` | 唯一入口；按脚本自身位置定位，工作目录任意 |
| 管线代码 | `fetch_data.py`、`providers/{__init__,domestic,supplemental,original_eps}.py`、`providers/original_eps_capture.js` | 只用应用内相对路径 |
| 审计 | `reports/manager_audit.py`、`analytics.js` | 数据包门禁里的复算，需要 node（没有 node 时跳过并在报告中注明） |
| 基线 | `reports/round2-baseline.json` | fetch_data 生成覆盖报告时读取 |
| 依赖 | `requirements-ci.txt` | xlrd==2.0.1、playwright==1.55.0；另需 `python -m playwright install --with-deps chromium` |
| 测试 | `tests/`（119 个 Python 测试、55 个 JS 测试） | 刷新前的回归检查 |
| 数据（必须入库） | `python refresh_runner.py --print-commit-paths` 输出的 204 个文件，约 26 MB | 见下文 |
| 大 raw（不入库） | `python refresh_runner.py --print-cache-paths`：`data/providers/domestic_raw`（11 MB，其中 accum_* 入库）、`data/providers/supplemental_raw/shiller`（1.6 MB） | 用 actions/cache 保存，缓存未命中时在线重下 |
| 模板 | `ci/panorama-refresh.yml.example` | 集成方需要改 `APP_DIR`、`BUNDLE_OUT` |

**入库白名单**（`--print-commit-paths`）包括：

- 数据包与清单：`data-bundle.js`、`data/manifest.json`、`data/store/*.csv`（36 个，含全部价格历史）；
- 三个 provider 的 json；
- 原站 EPS 的脱敏 raw：`original_eps_raw/capture.json`；
- 累积型状态：`domestic_raw/accum_*.json`，以及 supplemental_raw 下按日期累积的快照（cnindex、csi_feature、ecb、hsi、nasdaq、wsj，不含 shiller）；
- 报告：`reports/round2-coverage.json`、`reports/refresh/last-refresh.{md,json}`。

白名单**不包含**：日志、`data/refresh-work/`、`data/refresh-backups/`、锁、可重下的大 raw。应用的 `.gitignore` 已同步加上这些排除项。

### 2.2 旧缓存依赖检测（REPLICA_DIR）

- `fetch_data.CACHE_DIR = ../布鲁斯的金融宝藏/replica/data` **只在** `data/store/price_*.csv` 不存在时才读（`update_prices`）。
- 读取用的 `read_csv_rows` 遇到缺失路径直接返回 `[]`。
- 现有 store 已含 35 个 price 文件和中证2000 的 csi 文件，包含全部历史。
- 来源标签「本地历史缓存 + 腾讯证券」取自 store 每行的 `src` 列，不依赖外部目录。
- 结论：只要提交 `data/store`，远端就不需要任何其他研究目录。
- 演练副本用 rsync 复制，排除了外部目录。由于 store 齐全，代码从未走到读取 CACHE_DIR 的分支。
- 模块路径：providers 只引用 `fetch_data.INDICES`（通过 `sys.path.insert(应用根)`），runner 在 staging 里以子进程运行这些 CLI，与工作目录无关。

### 2.3 runner 调用方式

```sh
cd $APP_DIR
python refresh_runner.py --mode online [--bundle-out $GITHUB_WORKSPACE/public/index-panorama/data-bundle.js]
python refresh_runner.py --mode online --skip-eps        # 只读 EPS 缓存（整合方若暂不跑浏览器）
python refresh_runner.py --mode offline --skip-eps       # 不联网演练
python refresh_runner.py --eps-smoke 000001.SH,399006.SZ # EPS 小样本冒烟，不发布
python refresh_runner.py --print-commit-paths | --print-cache-paths
```

退出码：

| 退出码 | 含义 |
|---|---|
| 0 | 全部在线成功并已发布 |
| 10 | 部分成功：有来源沿用旧缓存，或未联网/跳过 EPS；验证已通过并已发布 |
| 20 | 失败，生产数据未改；保留 `data/refresh-work/<UTC>/` 现场与各步日志 |
| 3 | 锁 `data/.refresh-runner.lock` 已存在，本次跳过，不删除未知锁 |

每次都会写 `reports/refresh/last-refresh.md` 和 `last-refresh.json`，内容包括：起止时间（UTC 和北京时间）、每步状态、问题明细、36 只指数的价格/PE/PB/股息率/EPS/ROE **真实最新日期、样本数和来源**、历史修订清单、裁头清单、备份路径。报告明确写出「生成时间不等于数据时间」。

`--bundle-out` 会把同一份数据包原子发布到前端 public 路径。该路径的旧文件也会一并备份，回滚时一起恢复。

## 3. 流程与保护

| 步 | 动作（全部在 `data/refresh-work/<UTC>/app` staging 内） | 失败处理 |
|---|---|---|
| S1 | `fetch_data.py --no-csi --providers ""` 刷新腾讯行情；再用 `--only <生产已有中证 store 的指数>`（目前只有 932000.CSI）刷新中证点位；新出现的中证 store 一律丢弃 | 某指数请求失败时 fetch_data 自身保留旧 store，runner 记为 fallback；进程退出码非 0 → 整体失败、不发布 |
| S2/S3 | `providers/domestic.py`、`providers/supplemental.py --as-of <A股最新交易日>`（CLI 会持久化 json） | **provider 门禁**：原有 ok 字段不得消失、区间内不得丢观测、末日不得回退、裁头后新样本须 ≥ 原 90%。不合格时，该 provider 的 json 和 raw 在 staging 中整体恢复为生产旧版，记为 fallback |
| S4 | Playwright Chromium 打开 `https://lishenqi.vip/#/panorama`，等待页面自己完成匿名初始化（`PANO_IX` 就绪，最多 90 秒），然后 `page.evaluate` 执行现有的 `original_eps_capture.js` | 不读写 cookie/storage，不拦截请求，不改浏览器安全设置。异常/超时/要求登录 → 保留旧 raw，记为 fallback。**EPS 门禁**：无 errors、非子集、range=all、unit=yuan、freq=week/step=5、原有 EPS 指数不缺失、末日不回退、样本数不减少超过 2、最早日推迟不超过 14 天，并复用 `original_eps.load_raw` 的脱敏/白名单校验。通过后才写入 staging 的 raw 并解析 |
| S5 | `fetch_data.py --enrich-only`（默认 3 个 provider） | 进程退出码非 0 → 失败 |
| S6 | **数据包门禁**（对比生产包）：`validate_bundle`、36 只指数一只不少；每只每字段不丢观测、末日不回退、选源不切换（新增来源允许）；成分股数不消失；EPS 与 staging raw 一一对应且来源为 original_eps；有 node 时再跑 `manager_audit.py` 复算 | 任何一项不通过 → 失败，不发布 |
| S7 | 先把将被覆盖的生产文件备份到 `data/refresh-backups/<UTC>/`（保留最近 5 份），再逐文件临时写入后 `os.replace`，`data-bundle.js` 最后替换 | 任一写入出错，含 SIGTERM，已替换的文件全部恢复、新建的文件删除 |

- 上游修订旧值（同一日期数值变化）不拒收，但都列在报告的「历史修订」中。例如 SPX.pb 2026-11-13 从 5.2883 改为 5.2884。
- EPS 只来自原站，每只指数一份历史；不前填，不与其他来源拼接。
- 原站请求只有一次页面加载加上抓取脚本自身的顺序请求：间隔 1.5 秒，遇错即停，**不重试**。

## 4. 演练发现（已修复，二审请重点看）

1. **在线全量 fetch_data 会改变选源。**
   - 现象：生产包生成时 `data/store` 里没有中证的 csi_*/indicator_*（`reports/data.md`：当时中证网络问题）。A 股 PE/股息率实际由 domestic 整列提供（同为中证官网 peg 和 indicator 口径）。
   - 第一次在线演练直接跑完整 `fetch_data`，新建了 27 份中证 store，`select_column` 随之把至少 50 列从 domestic 切到 csi/csi_indicator。门禁报告了 50 处「来源切换」，没有发布。
   - 旧的本机 `tasks/scheduled-refresh.md` 第 4 步如果照做，也会触发同样的切换。
   - 修复：S1 改为 `--no-csi` 加 `--only <生产已有中证 store>`，并丢弃新出现的中证 store。不改 fetch_data，也不改选源规则。
   - 第二次演练中，`--only 932000.CSI` 顺带新建了 `indicator_932000_CSI.csv`，会让中证2000 的股息率切源。这一处被兜底检查拦下，后来改为丢弃。
   - 第三次演练门禁通过。
2. **原站 EPS 的采样网格每天平移。**
   - 冒烟发现：服务端的 step=5 网格以最新交易日为锚。新抓到的上证、创业板 1206 和 799 个点，与 2026-11-15 的 raw **日期重合数为 0**：旧 raw 末段是 …1029、1105、1113，新抓取是 …1030、1106、1116。
   - 所以每次刷新都会用一整份新历史替换 EPS 列，日期全部换新。这仍然满足「每只一份原站历史、不拼接」，但前后两版的 EPS 日期不能按同日比较。
   - 修复：EPS 门禁和数据包门禁中的 eps 字段改用重采样规则（`judge_resampled`），其他字段仍按严格的同日规则。
3. **`fetch_data.py --collect-providers` 不会持久化 domestic。**
   - 它在进程内调用 `domestic.collect(out_path=None)`，结果只用于当次生成，不写 `domestic.json`；随后的 `--enrich-only` 会读到旧的 domestic 缓存。
   - 因此 runner 改为直接运行两个 provider 的 CLI（会写 json），再统一执行 `--enrich-only`。这与任务卡建议的两步法在效果上等价，而且结果正确。
4. **runner 被中断时锁会残留。** 已加 SIGTERM 处理：转成 SystemExit，让 finally 释放锁，并写失败报告。发布阶段捕获 BaseException 后先回滚。

## 5. 测试证据

| 命令 | 结果 |
|---|---|
| `.venv/bin/python -W error::ResourceWarning -m unittest discover -s tests -p 'test_*.py'` | Ran **119** tests OK（原 102 个，加上本次新增 `test_refresh_runner.py` 的 17 个） |
| `node --test tests/*.cjs` | pass **55** fail 0 |
| `test_refresh_runner` 门禁类测试 | 丢观测/末日回退/过度裁头被拒收，滚动裁头和修订放行并记录；provider 字段消失被拒、新增字段放行；EPS 的 errors、子集、单位、采样、缺失、末日回退、样本减少被拒，网格平移放行，冒烟子集校验；数据包的选源切换、指数减少、丢观测被拒，修订被记录；EPS 与 raw 不一致被拒；提交白名单不含 shiller/csi_pe/dj_ 等大 raw 和工作目录 |
| `test_refresh_runner` 端到端测试（在应用临时副本上，不联网） | 离线全流程退出码 10 且已发布，36 只 × 12 字段的非空值与原包逐日相同，`--bundle-out` 与应用内为同一份；EPS 抓取异常、坏数据都回退且 raw 不变；EPS 成功时会重新解析；门禁失败不发布且生产字节不变；发布中途出错全部回滚；锁占用时跳过且不删除他人的锁；在线 S1 的参数组合正确，新中证 store 被丢弃 |
| `refresh_runner.py --eps-smoke 000001.SH,399006.SZ`（真实在线一次） | 20.9 秒，门禁通过；结果在会话 scratchpad 的 `smoke/eps-smoke/eps-smoke-{capture,result}.json`，未发布 |
| `refresh_runner.py --mode online --skip-eps --keep-work --bundle-out …`（临时副本） | 第 1 次：退出码 20，门禁拦截 50 处来源切换（见 4.1）；第 2 次：S1 兜底拦截新建的 indicator 后修复；第 3 次：退出码 **10**，4 分 56 秒，发布 108 个文件，manager_audit 通过 |
| 生产目录核对 | `data-bundle.js` 的 sha1 为 e56afa81…，generatedAt 2026-11-16T07:06:29Z，与本任务开始前一致；没有 `reports/refresh/`、`refresh-work`、`refresh-backups`、锁残留 |

另有一次第 2 次演练时误未加 `--skip-eps`。我在 S1 阶段（尚未执行 EPS 步骤）就终止了它，没有发出原站请求，然后用 `--skip-eps` 重跑。

## 6. 尚未验证的远端条件

1. **GitHub 托管 runner（美国 IP）能否访问国内数据源**：腾讯 proxy.finance.qq.com、中证 csindex、蛋卷 danjuanfunds、国证 cnindex、恒生、WSJ、Nasdaq 都只在本机网络验证过。
   - 被屏蔽或限流时，runner 会降级为部分成功或失败并保持旧数据，不会写坏数据。
   - 但如果长期如此，就需要改用自托管 runner 或国内网络。
2. **原站在美国 IP、headless Chromium、未设置 locale 之外的环境下是否一样匿名可用**：本机 headless 冒烟成功，但远端出口 IP、CloudBase 匿名登录策略和风控都未验证。失败时 EPS 回退到旧 raw，报告会写明。
3. **ubuntu 上 `playwright install --with-deps chromium` 的耗时和系统库**：只验证过 macOS（Python 3.14 + playwright 1.55）。CI 计划用 Python 3.12，同样 pin 1.55.0；playwright 1.49 在 Python 3.14 上因 greenlet 编译失败而弃用。
4. **actions/cache 未命中时**（首次运行，或 7 天没跑被清除），domestic 需要全量重下约 140 个接口。本机约 3.7 分钟；远端更慢或失败时，provider 门禁会让它整体沿用已入库的旧 json。
5. **cron 时间**：`30 12 * * 1-5`（UTC）= 北京时间工作日 20:30。GitHub 定时任务可能延迟，高峰期会更久；节假日不跳过，但数据日期会如实保持不变。
6. **仓库增长**：`data-bundle.js` 是 13 MB 的单行 JSON（gzip 后约 2.7 MB），每天提交一次，git 增量压缩效果差，估计每天增长约 3 MB。建议二审决定：接受增长，或改为 Pages/Release 产物发布，或拆分数据包。
7. **push 权限和分支保护**：模板只申请 `contents: write`，push 前先 `pull --rebase`。目标仓库的分支保护、bot 推送规则和并发提交情况都未验证。
8. **workflow 模板本身没在 GitHub 上运行过**：只用 Ruby YAML 解析通过（10 个步骤），`APP_DIR`/`BUNDLE_OUT` 需要整合方按目标仓库填写。

## 7. 交接与后续

- 旧的本机定时任务（`tasks/scheduled-refresh.md`，依赖 Claude/MCP）**保留不动**，等远端成功运行后由 manager 停用。注意它的第 4 步会触发 4.1 的选源切换，建议在停用前不要再按原步骤手动执行。
- 整合方需要：
  - 按 2.1 复制应用目录；
  - 把模板移到目标仓库的 `.github/workflows/`，并改 `APP_DIR`、`BUNDLE_OUT`；
  - 首次运行建议先在 workflow_dispatch 下用 `--skip-eps` 验证国内源的可达性，再开启 EPS。
- 本次新增或修改的文件（均在 `output/指数全景/`）：
  - 新增：`refresh_runner.py`、`requirements-ci.txt`、`tests/test_refresh_runner.py`、`ci/panorama-refresh.yml.example`、`reports/remote-refresh-readiness.md`；
  - 修改：`providers/original_eps_capture.js`（新增可选参数 onlyCodes，不传时行为不变）、`providers/original_eps.py`（白名单允许 onlyCodes 键，门禁仍拒绝发布子集抓取）、`.gitignore`、`README.md`（新增「无人值守刷新」段落）。
