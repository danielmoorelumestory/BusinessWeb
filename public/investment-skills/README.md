# 投资分析 Skill · 使用说明

「AI 工具」第一项为融合版 **股票分析（stock-analysis）**：融合项目研究方法、股票研究专家（严估深 / 研股股）、腾讯自选股投研专家团（圆汇众 + 六位专家）与 Public Markets Investing。融合版本：2026-10-07。

| Skill 文件夹 | 适合的问题 | 交付 |
| --- | --- | --- |
| stock-analysis | 美股、港股、A 股公司研究、商业模式、核心假设、盈利预测、估值、专家圆桌；按需回测与组合风险 | 结论卡、业务驱动树、假设与敏感性、预测桥、三情景与盈亏比、专家分歧解决变量、证据索引与验证日历 |
| trading-analysis-team | 多空辩论、交易情景、风险提案与裁决 | 多空交锋、交易情景、风险评估、Markdown 与 HTML 报告 |

## 安装

1. 解压 ZIP。股票分析和交易分析单套包各有一个 Skill 文件夹；投资分析合集有上表两套。旧名称兼容包包含旧入口与完整 stock-analysis，两者一起保留。
2. 保留整个文件夹，包括 `SKILL.md` 和全部 `references/`，不要只复制入口。
3. 放到项目的 `.agents/skills/`（Codex / Antigravity CLI）、`.claude/skills/`（Claude Code）、`.opencode/skills/`（OpenCode）或 `.codebuddy/skills/`（CodeBuddy Code）。统一入口示例：`.agents/skills/stock-analysis/SKILL.md`。
4. 重新打开会话，说明 Skill 名称、公司代码、市场、研究问题与期限。

## 示例

- 用股票分析研究腾讯（0700.HK），核实最新行情与财报，拆解赚钱机制与核心假设，给三情景估值、盈亏比、专家分歧解决变量和验证日历。
- 用股票分析拆解一家公司的商业模式，画出收入到现金的驱动树，找出最重要的三个变量及失效阈值。
- 用股票分析比较两期同年度盈利预测，区分业务变化、假设变化和股本变化；没有旧快照时说明缺口。
- 用股票分析对比 AAPL 与 MSFT，统一估值与财年口径，列出各自最大反证与下一次验证条件。
- 用股票分析更新已有研究，说明哪些旧结论保留、调整或撤回，以及原因。
- 用交易分析团队对 NVDA 做风险诊断，说明主要风险和失效条件。

## 内容与使用条件

统一 Skill 使用「立论 → 取数 → 估值 → 专家视角与对抗 → 收口」五步流程。`references/research-method.md` 收录完整项目研究方法；`references/equity/` 保留深度研究与模型资料；`references/roundtable/` 保留六位专家、圆桌及数据字段资料；`references/screening-rules.md` 记录程序化初筛规则与限制。

新增 `references/public-markets/` 按需加载商业模式与驱动树、核心假设、两期盈利预测与估值核对、市场空间与周期、数据证据与交付、回测与组合压力方法。普通研究不强制回测或组合分析。原平台连接器、脚本、看板部署及渲染模板未随包安装。

综合评级与专家立场分别呈现。证据不足写「等待证据」；区间与加减仓条件是研究假设。初筛赔率未经公司级核实不能作为深度认证结论。

这些文件供支持 Skill 的 AI 助手读取，数据工具不会随包安装。使用时查看可用工具，可通过 yfinance / akshare 或公开网页取数，财报以公司一手公告为准。缺失写 `[MISSING]`，保留日期和口径。原平台 WorkBuddy / westock 的工具名只作历史资料，不代表当前环境已有连接器。

统一股票分析不要求子代理：支持且获得授权时可并行；否则标明「单模型多视角复核」。交易分析团队按其入口要求编排。

原两套 ZIP 下载地址保留，旧名称入口转入融合版，兼容包内含完整 stock-analysis。新安装优先使用 stock-analysis；统一包已包含旧两套参考资料，无需另装旧包。

来源包括项目已有导出和用户提供的 xtt-public-markets-investing.skill。新增方法经过中文融合与平台适配，来源指纹、修改范围及 Moonshot AI 许可声明在 `references/public-markets/sources.md` 与 `LICENSE`。角色为研究方法模拟，不代表腾讯或 Moonshot 官方报告。AI 输出需核对数据来源与日期，不构成个人投资建议。

## 项目内更新下载包

在 BusinessWeb 目录执行 `npm run skills:package`，先将网站研究方法同步到统一 Skill，再生成单套与合集 ZIP。正式合集包含股票分析和交易分析团队两套；兼容旧下载地址的两套 ZIP 也会更新。

`.agents/skills/stock-analysis/` 为统一来源，供 Codex 与 Antigravity CLI 共用。打包时将统一 Skill 和两套旧名称兼容入口及资料同步到 `.claude/skills/`、`.opencode/skills/` 与 `.codebuddy/skills/`，保持五种工具的项目版本一致。从 BusinessWeb 目录启动对应工具；重新打开会话确认列表出现 `stock-analysis`，再提出研究任务。
