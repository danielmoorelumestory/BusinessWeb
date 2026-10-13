# 数据维护台账

最近盘点及数据刷新：**2026-10-13**，时区 Asia/Yerevan（UTC+4）。本文件是以后例行更新的入口；每次盘点保留一份日期报告，不覆盖历史证据。

- [本次盘点、数量及证据](research/data-freshness-audit-2026-10-13.md)
- [本轮更新结果、真实数据日期与剩余缺口](research/data-refresh-2026-10-13.md)
- [按数据组维护的 CSV 台账](data-maintenance.csv)：优先级、状态、文件、更新入口、周期及验收条件。
- [本轮更新后报价与状态明细](research/company-price-refresh-2026-10-13.csv)：另存更新后1,299条，包含2条受限证券标记，原盘点CSV不覆盖。
- [四市场公司 JSON 更新前价格明细](research/company-price-audit-2026-10-13.csv)：1,299 条来源记录，可按状态、市场、价格日期筛选。它不是页面合并后的公司总表。

## 如何判断过期

维护时分开记录 **研究日期、报价时间、报告期末、披露日、实际核验时间、下次检查日**。文件修改时间、Git 提交时间和 `generatedAt/asOf` 都不能代替字段本身的数据日期。

| 状态 | 含义 | 处理 |
| --- | --- | --- |
| 已超期 | 超过项目现有规则，或明确的事件检查日期已过 | 优先重新取数或核实事件结果 |
| 待刷新 | 带日期的有效快照，但不足以代表当前行情 | 使用现价、估值、赔率前刷新；历史研究仍保留 |
| 待核 | 缺核验日期、来源停更、版本或覆盖范围不一致 | 先查源及口径，不能靠改日期解除 |
| 等待披露 | 报告期较旧，但尚未确认有更新披露 | 保留原报表，轮询新公告；不编造新季度数据 |
| 按计划维护 | 尚在当前维护窗口内 | 到期检查，不因旧报告期自动重抓 |
| 历史归档／教学样例 | 固定案例、历史回测、假设输入或旧版留痕 | 不做日常刷新，纠错或新版本另建记录 |

现有量化规则：公司价格超过 **7 个自然日**才触发提示，见 [priceAnchor.ts](../src/features/dcf/priceAnchor.ts)；宏观使用 [quality.ts](../src/features/macro/quality.ts) 的逐指标阈值。提示未超期也不等于价格实时可用。月度指标日期通常代表统计月份，季度指标代表报告期间；阈值越界只表示需要查新，不证明源已经发布下一期。交易日判断以市场日历和接口实际行情日期为准，不按自然日机械补档。

## 2026-10-13 刷新后状态

原盘点报告和1,299条价格明细保留为更新前证据。本轮已使用真实 Yahoo／AkShare MCP、腾讯／Yahoo公开接口及官方原件：公司主库1,540条页面记录均取得供应商报价，其中1,538条一般报价更新至各市场10-12／13；601059／601198两条换股流程报价仅作历史参考、可交易性未认证。原1,105条超过7天的价格标签已替换，受限证券不能据此视为可交易；未来趋势625家上市公司报价已更新（加拿大MDA最新10-09按真实源保留），26家非独立上市／待核对象不造报价。固态68条有效上市报价、46家财务摘要和8家供应商预测已刷新；原H1原件控制值保留。

宏观原4项规则超期中，两项中国融资指标已更新，储蓄率和港元汇率查源后仍无更新观测；指数10项最新价格、5项PE汇总已更新。国家队55只ETF价格均标10-13，实名榜单仍停2025年末；已取得三只大型ETF的2026H1匿名持有人结构，但不能推算国家队最新实名份额。林奇1,517条PE字段已更新，原分类／增速／护城河证据日期仍未知，不算全套分类重建。

PEP最新Q3、官方事件日历、8项ETF费用／规则及纳指QQQ持仓代理名单已核验。后续优先级以CSV的刷新后状态为准；以下顺序保留原盘点的工作分类，具体进展见更新报告。

## 优先处理顺序

1. **日历、价格及派生计算**：先核实已过期的 PEP 事件；刷新实际持有／候选／核心研究公司的价格，再重算涨跌空间、赔率、股息率、PE/PEG、阈值及相关文字。四份 JSON 中有 1,105 条价格超过 7 天，但只改 JSON 可能被手工详情覆盖，须检查最终页面。
2. **宏观与指数**：宏观 4 项触发现有超期规则；日频／周频读数及指数最新价格应提高刷新频率。现有定时配置每月一次，不能持续覆盖这些指标。
3. **国家队 ETF 与无日期数据**：ETF 持有人最新期停在 2025-12-31，需核对基金原件／采集源；林奇分类 1,517 条记录缺日期，需先补来源与可复现生成入口。
4. **公司新财报与事件**：逐家查询新披露，更新盈利、现金、股本与情景；H1/Q2 旧期末不单独作为“已发布新报表”的证据。
5. **版本与慢变量**：未来趋势覆盖统计、名单、ETF 产品费率、政策／费用规则、Notion 导入和书籍 PDF 按各自周期维护。

## 例行维护节奏

以下是建议执行计划，**尚未修改或新增自动任务**。

| 周期 | 工作 | 完成条件 |
| --- | --- | --- |
| 每个开市日收盘后 | 每日分析归档；持仓／候选／核心研究报价；日频宏观与指数 | 校验实际行情日、收盘状态、缺失项；不能把抓取日期当行情日 |
| 每周一 | 全市场研究报价巡检、周频宏观、国家队、新公告、事件日历 | 输出超期／缺失清单；到期事件改为结果、延期或待确认 |
| 每月 8 日及其他指标实际发布后 | 宏观月度读数；林奇分类／护城河数值重算；指数名单差异 | 核对每项观测期与源；不能仅更新整文件日期 |
| 每次财报／重大公告后 | 正常化盈利、现金流、完全摊薄股本、共识、三情景、验证日历 | 数值与证据、情景、结论一致；不足保留 `[MISSING]` |
| 季度／指数调样时 | 研究池全量检查、产品成分、国家队成熟期切换 | 保留新旧比较；国家队覆盖满足项目成熟度条件 |
| 每半年及规则变更时 | ETF 费率／规则、交易费用、平台规则、税费说明 | 核对发行人／官方文件，记录核验日期；算例费率不冒充实际费率 |
| 书稿正式发布时 | 网页正文、HTML、PDF、数据索引和版本号 | 出版物版本一致；历史回测保留原样 |

## 已有更新入口

| 任务 | 入口 | 注意事项 |
| --- | --- | --- |
| 宏观三市场快照 | `npm run macro:update` | 对比各 `series.*.latest.date/value` 和 warnings；失败时可能沿用旧值 |
| 指数价格、估值与外部参考序列 | `npm run index:update` | 某个指数／参考源失败会保留旧字段；长历史外部序列可能自身停更 |
| 手动补指数 Forward PE | `npm run index:fpe -- <key> <value> <YYYY-MM>`；批量用 `index:fpe-import` | 先取得有日期有口径的源；空序列不都属于过期，部分指数本来没有免费序列 |
| 导入指数 PE 历史 | `npm run index:ref-import -- <key> <csv> "<来源>" [trailing]` | 区分滚动 PE 与 Forward PE，不混成同一历史序列 |
| 每日分析 | `npm run daily-analysis:update` | 北京时间 15:15 后且实际行情日为当天才落盘；历史补档见 [说明](daily-analysis.md) |
| 国家队个股与 ETF | `npm run national-team:update` | 个股可 `--rebuild` 离线重建；ETF `--deep` 扩大历史扫描，不能保证源会返回更新报告 |
| 未来趋势旧排序输入 | `FT_WORK=/private/tmp/businessweb-ft-YYYYMMDD npm run future-trends:picks` | 用新的空工作目录，避免海外 `us.json` 被永久复用；这不是当前研究索引的完整更新入口 |
| 未来趋势当前研究 | `scripts/fetch-future-trends-review.py` → 公司取证／模型复核 → `scripts/generate-future-trends-review.py` | 目前目录、研究日期及部分输入写死 10-09；先建立新日期目录并调整采集／生成配置。不能直接重跑后宣称全量已更新 |
| 固态电池 | 新采集 → `scripts/normalize-solid-state-mcp.py` → 核对各 review／research 层 | 脚本绑定 10-09 原始目录；注释所指采集脚本当前仓库缺失。10-10 材料需按实际消费关系核对 |
| A／港／ADR 公司复核 | `scripts/fetch-*-2026-10-07.py`、`review-*-2026-10-07.py`、`render-*-2026-10-07.mjs` 及手工详情 | 多个脚本绑定旧目录、检索截止日或缓存，必须先参数化／建立新轮次；重新渲染不是重新取证。ADR 重生成后须合入 SOFI，见 `src/data/details/sofi.ts` |
| 公司行情、供应商摘要、林奇PE | 本轮新增 `collect-market-mcp.py`／`collect-market-refresh.mjs` → `normalize-market-refresh.py` → `apply-companies`，完整命令见下文 | 原分类／增速／护城河与估值仍需逐公司复核；不以新报价认证旧模型 |

已有 GitHub Actions：每日分析工作日北京时间 **15:35、17:10**；国家队每周一 **10:30**；宏观＋指数每月 8 日 **14:00**。配置见 [.github/workflows](../.github/workflows)。本次 GitHub CLI 未登录，未核验远端最近运行／部署状态。任务存在不等于已经成功运行。

## 一次更新如何验收与留痕

1. 从 CSV 选本轮条目，记录执行日期、操作者、数据源和计划覆盖范围；保留本轮开始前的原始证据或 Git 版本。
2. 先获取真实新输入，检查报价时间、报告期、披露日、币种、单位、复权、普通股／ADS、股本及合并／归母口径。没有新数据写“源无新披露”或“采集失败”，不算已完成刷新。
3. 按依赖顺序重算并同步：**源／输入 → 结构化索引与 JSON → 手工详情覆盖层 → 情景和赔率 → 报告网页／导出／统计元数据**。`loadCompanies` 的覆盖顺序见 [companies.ts](../src/data/companies.ts)，未来趋势实际消费见 [FutureTrends.tsx](../src/pages/FutureTrends.tsx)。
4. 对比更新前后字段和缺失数量；抽查最终页面、来源链接及研究结论。按修改范围运行已有检查，不因为只是例行取数而机械扩大测试范围。
5. 在 CSV 更新状态、`last_checked`、`next_review`；新增日期报告，附变更文件、源日期、采集失败项及验证结果。发布另按项目流程处理，未部署不能记录为线上已更新。

建议留痕模板：

```text
执行日期 / 操作者：
台账 ID / 覆盖对象：
原数据日期 → 新数据日期（价格、财报、披露日分别填写）：
源 / 原始证据位置：
派生字段与页面同步情况：
缺失 / 失败 / 仍待披露：
验证结果 / 提交或发布版本：
下次检查日：
```

现有 [书稿数字核对表](../public/first-book/数字核对表.md) 也规定行情随用随算、财务披露后复核、规则定期核对、教学假设无需例行更新，可与本台账配合。

## 本轮新增可复用工具

日期参数表示本轮存档目录；每一项内部仍保留真实报价日／观测期／披露日，不能用目录日期替代。

```bash
# 先生成当轮公司范围与证券列表，再采集；把日期换成实际执行日。
node scripts/collect-market-refresh.mjs universe YYYY-MM-DD
node scripts/collect-market-refresh.mjs macro YYYY-MM-DD
node scripts/collect-market-refresh.mjs indexes YYYY-MM-DD
node scripts/collect-market-refresh.mjs yahoo-quotes YYYY-MM-DD

# 用具备mcp/yfinance依赖的Python环境运行；共享启动器位于../.agents/mcp。
uvx --python 3.12 --from yfinance-mcp-server==1.0.4 python scripts/collect-market-mcp.py --date YYYY-MM-DD --mode probe
uvx --python 3.12 --from yfinance-mcp-server==1.0.4 python scripts/collect-market-mcp.py --date YYYY-MM-DD --mode retry-core
uvx --python 3.12 --from yfinance-mcp-server==1.0.4 python scripts/collect-market-mcp.py --date YYYY-MM-DD --mode collect
uvx --python 3.12 --from yfinance-mcp-server==1.0.4 python scripts/collect-market-mcp.py --date YYYY-MM-DD --mode quotes
uvx --python 3.12 --from yfinance-mcp-server==1.0.4 python scripts/collect-market-mcp.py --date YYYY-MM-DD --mode ak-financial
uvx --python 3.12 --from yfinance-mcp-server==1.0.4 python scripts/collect-market-mcp.py --date YYYY-MM-DD --mode quotes-etf

# 有限流时先冷却，再低频补采失败的完整公司资料。
uvx --python 3.12 --from yfinance-mcp-server==1.0.4 python scripts/collect-market-mcp.py --date YYYY-MM-DD --mode retry-info

# 检查原始证据后应用。生成companyMarketSnapshot并在最终覆盖层生效。
python3 scripts/normalize-market-refresh.py --date YYYY-MM-DD --dry-run
python3 scripts/normalize-market-refresh.py --date YYYY-MM-DD
node scripts/collect-market-refresh.mjs apply-companies YYYY-MM-DD
node scripts/collect-market-refresh.mjs universe-after YYYY-MM-DD
```

MCP入口会实际initialize／list_tools／call_tool，不直接冒充MCP调用。当前注册配置有迁移前旧绝对路径，本轮使用工作区父目录中已存在的启动器，未改外部配置。独立迁移项目时需要一并配置可用启动器和其依赖；缺失时先修正环境，不把空返回当数据。

`normalize-market-refresh.py`只应用已保留的有效输入：行情不能倒退，旧北交所代码占位报价不能成为现价，空报表不能覆盖原件。旧研究／模型日期独立保留，已撤回的PEP盈利模型不会因新价格恢复赔率。它不会代替公司一手取证、完整估值、私人记录同步或PDF重新出版，也没有新增定时任务。

## 下次盘点的可复用任务

> 按 `docs/data-maintenance.md` 和 `docs/data-maintenance.csv` 做本轮数据新鲜度盘点。以当天 Asia/Yerevan 日期和各市场实际交易日为基准，逐字段检查数据日期，不用生成日替代。先输出超期、待刷新、缺失、等待披露及历史归档清单，保存新的日期报告和公司价格明细；若本轮同时授权更新，再按台账入口取新输入、更新派生结果并验收。旧原件、回测和书籍案例保留。无法访问的私有／远端数据单列，不能声称已经全部检查。
