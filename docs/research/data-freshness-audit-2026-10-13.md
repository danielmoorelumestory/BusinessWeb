# 项目数据新鲜度盘点 · 2026-10-13

盘点时点：2026-10-13 08:24 UTC／12:24 Asia/Yerevan／16:24 北京时间。按当日日期统计自然日年龄。范围为本地仓库数据、源码消费关系、生成脚本及定时任务配置；未逐家查询最新外部公告，未检查浏览器个人记录、Obsidian 内容或云数据库，未验证线上部署副本。本轮只建立盘点与维护记录，未刷新业务数据或调整任务。

长期入口：[数据维护台账](../data-maintenance.md)；分组任务：[CSV](../data-maintenance.csv)；逐公司来源价格：[CSV](company-price-audit-2026-10-13.csv)。

## 本次结论

| 对象 | 已确认的仓库状态 | 判断 |
| --- | --- | --- |
| 宏观 | 39 项中 4 项超出现有阈值，其余 35 项未触发；美中总览计 3 项，港股单独计 1 项 | 已超期；这是项目规则结果，不证明源已发布下一期 |
| 四市场公司 JSON | 1,299 条来源记录中 1,105 条价格超过 7 天；194 条未超过 | 已超期报价＋待刷新报价，不等于全部公司财报过期 |
| 手工研究页 | 仍有 9 月旧行情、已过的下一财报日期；数据覆盖层可能优先于 JSON | 需逐页刷新／核验，不能仅更新四份 JSON |
| 未来趋势 | 651 家研究索引，583 家有报价、68 家缺报价；研究日期均为 10-09 | 现价待刷新、缺失待补；统计说明也需同步 |
| 固态电池 | 68 主体／70 上市记录，66 报价市场时间 10-09、4 缺失；另有 10-10 研究材料 | 现价待刷新；按消费层核对新材料覆盖 |
| 国家队个股 | 最新成熟期 2026-06-30，生成 10-11，793 只 | 等待／检查新披露，不仅因期末旧而认定过期 |
| 国家队 ETF | 生成 10-11，但持有人最新期仅 2025-12-31；49 在持、6 已退出 | 优先查源／新报告；生成时间掩盖不了报告期滞后 |
| 林奇分类 | 1,517 个 market:code 键；没有统一或逐条数据日期 | 无法证明新鲜，需补元数据及生成入口 |
| 每日分析 | 15 个归档日，最新 10-12；10-13 首次计划归档窗口已过、第二次未到 | 检查任务及当天实际行情，不认定整天已经漏档 |
| 书籍 PDF | 网页第 16 轮 10-11；PDF 第 14 轮 10-04且默认入口关闭 | 派生出版物版本落后，重新开放前需生成新版 |

## 宏观与指数

直接调用 [quality.ts](../../src/features/macro/quality.ts) 的 `checkQuality`、`checkHkQuality`，日期固定为 `2026-10-13T00:00:00Z`，得到美中 `ok=31, stale=3, invalid=0, missing=0`；港股 `ok=4, stale=1`。

| 市场／字段 | 最新读数日期／值 | 年龄 | 项目上限 | 处理 |
| --- | --- | --- | --- | --- |
| 美国 `saving` 储蓄率 | 2026-08-01／4.1 | 73 天 | 70 天 | 查新读数；统计月份较旧不等于已经发布下一月 |
| 中国 `marginGdp` 融资余额／GDP | 2026-09-30／1.77 | 13 天 | 10 天 | 刷新分子及对应分母口径 |
| 中国 `marginMcap` 融资余额／市值 | 2026-09-30／2.62 | 13 天 | 10 天 | 同步融资余额和市值日期 |
| 港股 `hkd` 港元汇率 | 2026-10-02／7.847 | 11 天 | 10 天 | 重新取汇率，保留观测日 |

原件为 [macro-us.json](../../public/data/macro-us.json)、[macro-cn.json](../../public/data/macro-cn.json)、[macro-hk.json](../../public/data/macro-hk.json)，三份生成日均为 10-08。美国 `hy/vix/tenYear` 停在 10-06，10-13 尚未超过 7 天，10-14 若无新值即越界；不能笼统把全部 10-08 快照视为过期或新鲜。

[index-history.json](../../public/data/index-history.json) 生成于 10-09：5 个美股指数 `latest.date=10-08`，恒生、上证、沪深300、中证500、创业板 5 个为 10-09。最新价格均需按实际市场交易日刷新。5 个成分汇总 PE（NDX／SOX／沪深300／中证500／创业板）`agg.date=10-09`，月度 FPE 点为 10-01；月初点标签不是实际采集日。

外部历史参考存在另一层日期：NDX、SOX、SPX 的 `ref.points` 末尾是 **08-05**，与文件生成日不同；恒生、上证的 Siblis 稀疏序列末尾是 **06-30**，需查新点或继续明示旧基准；中证300／500滚动 PE 历史末尾为 10-08。RSP／RUT 无免费 FPE 历史为既有限制，不算新发现的过期。

更新入口为 `npm run macro:update`、`npm run index:update`；页面刷新可能只更新会话，不能替代仓库快照发布。配置在 [.github/workflows/macro-snapshot.yml](../../.github/workflows/macro-snapshot.yml) 的每月 8 日一次，与日／周指标的 7、10、14 天阈值不匹配。应改进频率，但本次仅登记建议。

## 公司研究、未来趋势与固态电池

四市场统计仅扫描各来源记录 `metrics` 中价格项的明确 YYYY-MM-DD；**不代表最终页面合并后数量**，未把未来趋势／固态池与这些来源相加作为独立公司数。

| 文件 | 条数 | 价格日期分布 | 超过 7 天 |
| --- | --- | --- | --- |
| [us.json](../../public/data/us.json) | 294 | 294 条为 09-29 | 294 |
| [cn.json](../../public/data/cn.json) | 811 | 809 条为 09-30；2 条为 09-14 | 811 |
| [hk.json](../../public/data/hk.json) | 127 | 全为 10-07 延迟盘中 | 0 |
| [adr.json](../../public/data/adr.json) | 67 | 全为 10-06；含后加入 SOFI | 0（恰好 7 天） |
| 合计 | 1,299 | 价格与研究日分别记录 | 1,105 |

手工层见 [companies.ts](../../src/data/companies.ts)、[companyDetails.ts](../../src/data/companyDetails.ts)、[details](../../src/data/details)、[sp500Reassessment.ts](../../src/data/sp500Reassessment.ts)、[cnSectorResearch.ts](../../src/data/cnSectorResearch.ts) 等。加载时已有情景的手工研究可优先，复核层还会覆盖字段。部分旧手工价格只写“9/28”而没有年份，现有价格日期函数可能无法识别，不能据“未显示过期”判断新鲜。

具体事件：`companyDetails.ts` 中 PEP 仍保留“Q3 财报约 2026-10-08”作为加仓前提及下一事件，并使用 9/28 价格与“当前美债利率”旧值。日期已过，需核实实际结果／延期，再改日历和论点；本次未据此声称已发布财报。[InvestmentPlan2026.tsx](../../src/pages/InvestmentPlan2026.tsx) 的固定日历和估算事件也应滚动核验。

未来趋势当前页面使用 [futureTrendsResearch.index.json](../../src/data/futureTrendsResearch.index.json)／[逐公司 JSON](../../public/research/future-trends-2026-10-09/companies)，不是直接使用旧 Picks 文件的报价。651 家中有价 583 家：10-09 为 416、10-08 为 166、10-07 为 1；68 家缺报价。`README.md` 旧“20＋471”介绍、`coverage.json` 的 581 freshQuotes 与当前索引 583 非空报价存在口径／版本差异，应复核，不能直接把差异认作财务错误。旧自动买点、固定胜率等已经撤回，不应刷新后重新启用。

固态电池主行情源 [mcpSnapshot.json](../../src/data/solidState/mcpSnapshot.json) 中，68 主体的 70 上市记录有 66 个 10-09 行情时间、4 个缺失。贝特瑞行情失败应继续缺失，不沿用旧 21.82 当现价。[normalize-solid-state-mcp.py](../../scripts/normalize-solid-state-mcp.py) 绑定 10-09 目录与 H1 财务期间；注释所指 `.agents/mcp/collect_solid_state.py` 当前仓库不存在，亦未找到 `reviewSnapshot.json` 的生成器。

10-10 补充材料**已被页面消费**：[SolidStateReview.tsx](../../src/components/future-trends/SolidStateReview.tsx) 读取 [reviewSnapshot.json](../../src/data/solidState/reviewSnapshot.json)，包括研究分层、8家盈利预测、11家财务摘要；报价仍是 10-09。下方核心竞选和公司详情继续使用 10-09 基底。补充层明确保留已核高精度 H1 原件字段，因此不能直接用新聚合数据粗暴覆盖。应记录为“分层版本需桥接、采集生成入口不完整”，而非“10-10全部未同步”。

财报边界：港股和 A 股许多 `[STALE]` 是“报告期末超过 90 天”，同时保留“本轮取得最新报告／披露未超过90天”的说明。应列查新披露任务；不能把重新下载同一份 H1 报告算成更新到 Q3。

林奇分类 [lynch.json](../../public/data/lynch.json) 的 1,517 条记录有 PE／PEG、盈利增速、护城河评分等，但没有数据日期，仓库脚本中未找到统一生成入口。最近 Git 变更 09-30 只作线索，不作数据核验日。应与公司财务／价格同步重算，先补可追溯元数据。

## 每日分析、持仓与运行时数据

[daily-analysis.json](../../public/data/daily-analysis.json) 现有 15 个归档日，最新 10-12 收盘。盘点时北京时间16:24，15:35窗口已过、17:10窗口未到；需查首轮任务及是否推送。归档有历史缺日，历史回填单独处理，不自动填造行情。本次无法通过未登录的 GitHub CLI 读取 Actions 结果。

最新归档还存在独立的质量缺口：`dtOpen/dtSealRate/upCount/downCount/lbRate=null`；行业资金流源无交易日期，标为 `undated`。这些属于缺失／无日期，不是单纯过期，刷新验收须保留其状态。说明见 [daily-analysis.md](../daily-analysis.md)。

国家队个股 [meta.json](../../public/data/national-team/meta.json)：793 只、覆盖 5,611 只、最新成熟期 06-30、生成 10-11；下一期按覆盖不低于前期90%的规则进入，不能强制切换未披完的 Q3。ETF [etf.json](../../public/data/national-team/etf.json)：扫描 1,670 只，49 在持＋6退出，最新持有人期为 **2025-12-31**。应先比基金原件／采集源，再区分“无新披露”或“源漏新期”；ETF 的 `price` 没有独立报价日期，估算持有市值混合报告期份额与最近价格，不能按 10-11 生成日证明两者均最新。

运行时行情／情绪／板块轮动不以仓库日期直接判过期：一般 API 内存缓存30秒、网格报价60秒、网格日线按抓取日复用；板块已收盘且非空的历史快照长期复用，盘中／空缓存30秒。失败回退和浏览器缓存需在实际使用时检查来源时间。[WatchBoard.tsx](../../src/pages/WatchBoard.tsx) 宏观块只加载静态美股文件，实时行情块刷新不能证明宏观也刷新。

个人候选、网格记录、投资计划、复盘、公司笔记、知识中心以及本地导出报告属于用户记录。未访问它们的浏览器／云副本；不得批量“刷新”历史操作记录。需要按当前估值使用的旧报告必须重新采集并另存版本。[valuation-reports](../../valuation-reports) 的 10-04 本地报告是历史输出，不是当前行情源。

## 慢变量、版本与历史归档

| 数据 | 本次状态／后续行动 | 证据 |
| --- | --- | --- |
| ETF 产品介绍 | 无逐项核验日期；含费率、持仓、规则，先列待核，半年及规则变更复查 | [etfGuide.ts](../../src/data/etfGuide.ts) |
| 成分名单 | 中证50009-30快照不因13天自动过期；NDX维基08月名单未经官方逐项比对；服务端指数成员也要一同检查 | [csi500.ts](../../src/data/csi500.ts)、[ndx100.ts](../../src/data/ndx100.ts)、[indexMembersCn.mjs](../../server/indexMembersCn.mjs)、[indexes.mjs](../../server/indexes.mjs) |
| 恒生中文名对照 | `hsi.ts` 为名称映射，实际名单来自 TradingView，不把名称表当静态指数成分 | [hsi.ts](../../src/data/hsi.ts) |
| 规则／费用／平台资料 | 网格费用常量、ETF规则与电商规则定期核验；示例费用和4%提款假设不是行情，不按数值老旧判过期 | [fees.ts](../../src/features/grid-trading/fees.ts)、[dropshipping-strategy.md](../../src/content/dropshipping-strategy.md)、[cashflow.ts](../../src/features/plan/cashflow.ts) |
| 行业趋势 | `TREND_ASOF=10-13`，当前为逻辑与跟踪指标，未核数字已隔离；本轮不列过期 | [industryTrends.ts](../../src/data/industryTrends.ts) |
| Notion 导入 | 09-29历史笔记，不自动等于当前研究；有改动时同步，现价判断重新取数 | [notionNotes.ts](../../src/data/notionNotes.ts)、[notionLinks.ts](../../src/data/notionLinks.ts) |
| 书籍 PDF | 第14轮落后网页第16轮；重开入口前重新生成校对 | [书籍README](../../public/first-book/README.md) |
| 书籍案例、回测、压力情景、风险贡献样本 | 固定历史窗口保存；扩展样本另建版本，不覆盖旧证据 | [数据快照清单](../../public/first-book/数据快照清单.csv)、[stressScenarios.ts](../../src/data/stressScenarios.ts)、[riskContribution.ts](../../src/features/plan/riskContribution.ts) |
| 旧研究与样例 | `previous.json`、日期报告、宏观旧版、fixture、修订记录是归档／教学，不做常规更新 | [历史宏观入口](../../src/pages/Monitor.tsx)、[DCF样例](../../src/features/dcf/fixtures.ts) |

## 下次复核

2026-10-13 优先处理已超期项、PEP事件与当天归档；10-14 复查7日宏观阈值和新财报；10-19进行下一次周度全表巡检。以实际新源、字段日期及最终页面验证为完成依据，不能用脚本退出成功或日期标签变化代替。
