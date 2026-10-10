# Public Markets Investing 融合来源

更新日期：2026-10-07。输入为用户提供的 `xtt-public-markets-investing.skill` ZIP；包内 README 标注 0.11.0 主/子技能架构。Copyright 2026 Moonshot AI，随附的许可声明完整保留于 [LICENSE](LICENSE)。

本目录五份方法文件为修改后的中文融合版本，并非原插件原样安装。保留原作者归属，供项目统一 `stock-analysis` 按需加载；无需原压缩包或原平台。旧股票研究专家、腾讯六专家和项目研究标准仍在上层入口及原参考目录中。

## 融合映射与修改

| 新参考 | 主要吸收内容 |
| --- | --- |
| [business-model.md](business-model.md) | 收费机制、单位经济、驱动树、竞争对比、核心假设与敏感性 |
| [earnings-and-valuation.md](earnings-and-valuation.md) | 原始/标准化财务、两期预测、归因、DCF 桥接、方法分歧 |
| [industry-and-macro.md](industry-and-macro.md) | TAM/SAM/SOM、历史当时证据、行业周期、宏观传导 |
| [evidence-and-delivery.md](evidence-and-delivery.md) | 能力需求、工具可用性、证据类别、跨模块数据与交付核对 |
| [quant-and-portfolio.md](quant-and-portfolio.md) | 按需回测、稳健性、持仓数据边界、组合压力与监测 |

六种中性分析角度映射到原六专家，继续区分公司质量与证券价格，以证据和分歧解决变量裁决。统一入口保留项目的条件化评级与三情景赔率纪律。

适配变化：去除原平台专属调用和路径依赖；沿用用户语言、格式和已授权范围；不继承强制双语、反复确认输出格式、自动多人编排、看板部署或交易执行。数据连接器、原插件脚本和图形模板未随融合版安装，专题计算由当前环境工具按任务执行。

纠正原文口径：港股与 A 股的会计准则、币种、交易限制和手数不合并默认；相对 1% 与绝对 1 个百分点分开；无旧快照不能称预测修正；完整持仓不可从 13F 推断；现行和历史市场规则在实际研究时向官方来源核验。原包内部的硬性页数和图表数量不作为本项目统一要求。

## 可追溯指纹

输入包 SHA-256：`43708a7809530fed2907df2f0ae0325f579ad903d318d2aff48e7f530767b8cd`。

以下是实际读取并用于融合的原始文件指纹，便于与用户提供的包核对；摘要不是数据来源或现时市场证据。

| 原包内路径（省略顶层目录） | SHA-256 |
| --- | --- |
| `README.md` | `82471f4a73a0a67ee19b6468b88c4b8aa01a6f450a56854c8f16ca614fa8eb62` |
| `references/execution-standard.md` | `92e9ad25028286a4bb6da51f480d65d9792a192ee87cad6127d8a1e41b4ec838` |
| `references/source-and-artifact-contracts.md` | `5fc621d9d18b0b42b75f6dca2fac8d2c21e905511f4c7afe885610990b4db117` |
| `agents/analytical-lens-panel.md` | `b4fe07360eb9f861933fba2583512f5fc6801a34465001014cf2fe4d320071eb` |
| `skills/company-research/subskills/business-model-decoder/SKILL.md` | `bbc4e02128da812e5263fcab9a8c1edc43b2f858c0b47d43e3c4503f65e95214` |
| `skills/company-research/subskills/competitive-landscape/SKILL.md` | `6c3efdb85f29857260e3715f42d524faa5bc502ebbcdf78d2b691ccbe0caa1c7` |
| `skills/company-research/subskills/financials-normalizer/SKILL.md` | `62b87f3b5a2619e4aee65dc066d189fe55b9e899262d88a567f8a0577ccc555a` |
| `skills/company-research/subskills/core-assumption-insight/SKILL.md` | `a8dc0e012f9a85670ceae97782b2fcbc894c6f3914bc0137929230da5baa2503` |
| `skills/company-research/subskills/earnings-forecasting/SKILL.md` | `6481d150bb240185f182c0c0650a107e9fbccc92f0b862eb53b400ed484a0a46` |
| `skills/industry-research/subskills/market-sizing/SKILL.md` | `37354988194b826fb06674949683d421ab1ce3056350018efbdbc29e931da1ee` |
| `skills/industry-research/subskills/industry-cycle/SKILL.md` | `39fdc54cf1dd5a27a4b26fd8fb8a0f27f540bf9e00a3abd6e7bf5dc1c38aa1e8` |
| `skills/macro-strategy/subskills/hk-overseas-strategy/SKILL.md` | `68413d5cd7b6a6b5a23ebe68416707d4a000d036676de1d8512db4909a616351` |
| `skills/valuation/subskills/dcf-model/SKILL.md` | `bf5967ac1700b55922a4cab6f314aec09c99e7a04633f057571b0a5c782eeaf0` |
| `skills/valuation/subskills/valuation-analysis/SKILL.md` | `3c92bfce980602859f494fb36dd1d235684111d393b6d4807449998fe5897121` |
| `skills/quant-research/subskills/quick-backtest/SKILL.md` | `cabd306f8e783c9c0719eb2d8b84d65470c1738ef8a1c3e202396ba6bf2868cb` |
| `skills/quant-research/subskills/robustness-check/SKILL.md` | `36fa175a7ce9fd7153fb6c773a84cf7edee4b92ba39dcb3d36b82d73c9e78c78` |
| `skills/portfolio-management/subskills/portfolio-risk-summary/SKILL.md` | `17b3ef2ee7514a5688b6b40288216078167aef69826446ff8242b7d89fb1a33e` |
| `skills/market-microstructure/subskills/institutional-ownership/SKILL.md` | `9fd5f30156def150ed25c186f1ba2d805ecb5d934687e76fce654cb655ba127f` |
| `skills/report-production/subskills/deliverable-qc/SKILL.md` | `4eed75fd9225e9d31560a878404cdc877a790955e7496b6ce0977a1d1a7aa407` |
