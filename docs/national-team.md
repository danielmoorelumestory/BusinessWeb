# 国家队持仓（/invest/national-team）

汇金、证金、社保等「国家队」资金持有哪些 A 股，以及通过哪些 ETF 间接持有。页面五个视角：总览、个股、行业、走势、ETF，外加口径说明。

## 数据怎么来

| 口径 | 来源 | 频率 | 脚本 |
|---|---|---|---|
| 个股（直接持股） | 东方财富 datacenter「十大流通股东」，`RPT_F10_EH_FREEHOLDERS`，按报告期取全市场 | 季度 | `scripts/national-team-snapshot.mjs` |
| 个股所属行业 | 东方财富 `RPT_F10_CORETHEME_BOARDTYPE`，取 `BOARD_TYPE=行业` 里层级最小者 | 缺啥补啥 | 同上 |
| ETF 清单与价格 | 东方财富行情清单 `push2 clist`（沪深 ETF/LOF，约 1600 只） | 每次运行 | `scripts/national-team-etf-snapshot.mjs` |
| ETF 十大持有人 | 新浪财经 `CaihuiFundInfoService.getFundHolder` | 半年报/年报 | 同上 |

### 怎么认出国家队

`scripts/lib/national-team.mjs` 的 `classifyHolder`：**只认机构完整名称**（正则锚定首尾），不做「含某字」匹配。

踩过的坑（都有测试用例）：

- 「证金」会命中「华宝中证**金**融科技 ETF」「农业银行-嘉实中证金融资产管理计划」「证金私客」私募；
- 「国新」会命中个人股东「徐国新」「国新宏盛」「国新证券」；
- 「汇金」会命中「博海汇金增盈」等私募；
- 「社保」会命中「划转社保国有股权基金专户」，这是国资划转账户，不是社保自身持仓，明确排除。

`findUnclassified` 用东财自带的 `HOLDER_NEWTYPE`（国家队/社保）做交叉校验：东财认为是国家队、我们没认出的名称会在采集日志里提示，据此补规则。

### 几个口径细节

- **分页排序必须带 `HOLDER_RANK`**：只按 `SECURITY_CODE` 排序时，同股 10 行的次序不稳定，分页会重复并丢行（实测一期约 116 行）。排序用 `SECURITY_CODE,HOLDER_RANK`，并校验行数等于接口声明的 `count`。
- 老报告期源数据里偶有完全相同的重复行：去重保留；重复比例异常高才拒绝。
- 报告期「成熟」判断：覆盖个股数不低于上一成熟期的 90%，季报没披完的稀疏期不进快照。
- 市值 = 持股数 × 报告期末股价（东财直接给），所以历史每期是**点位**口径。
- 增减持用持股数比较，不用市值。
- 行业用**当前**分类套用到所有历史期。
- ETF 持有市值是估算：报告期持有份额 × 最近价格。ETF 口径与个股口径独立，不能相加。

## 数据落在哪

```
data-raw/national-team/          原始层，提交进仓库，保证可离线重建
├── periods/<报告期>.json          每期：覆盖数、国家队行；只有最新成熟期带完整十大
├── industry-map.json              代码 → 行业（缓存，取不到的不缓存，下次重试）
└── etf-holders.json               每只 ETF 每个报告期的国家队持有人

public/data/national-team/       前端读取
├── meta.json        报告期、合计、机构组快照
├── stocks.json      最新期持仓个股（含国家队持有人明细）
├── industries.json  行业快照
├── changes.json     新进、退出、增持、减持
├── series.json      总量/机构/行业的季度序列
├── history.json     每股历史（个股详情用，懒加载）
├── top10.json       最新期完整十大流通股东（个股详情用，懒加载）
└── etf.json         国家队 ETF 与各期持有
```

脚本在内容无实质变化（忽略 `generatedAt`/`fetchedAt`）时不写盘，定时任务没有新披露就不会产生提交。

## 怎么更新

```bash
npm run national-team:update            # 个股增量 + ETF 增量
node scripts/national-team-snapshot.mjs --full           # 重抓全部报告期（约 15 分钟）
node scripts/national-team-snapshot.mjs --rebuild        # 不联网抓十大，用原始层重建
node scripts/national-team-etf-snapshot.mjs --deep       # 所有 ETF 查全部报告期（很慢）
node --test scripts/national-team*.test.mjs              # 采集与聚合测试
```

线上由 `.github/workflows/national-team.yml` 每周一自动跑，有变化才提交并触发 Pages 部署；任一采集步骤出错会让任务失败，旧数据保持不变。

## 已知局限

- 十大流通股东季度披露，数据滞后 3 周到 4 个月；ETF 十大持有人半年披露，最长滞后约 6 个月。只统计进入前十的持仓，所以是下限。
- ETF 默认只对「已确认有国家队」的 ETF 查全部历史，其余只查最近 2 期；更早就已退出且从未被发现的 ETF 不在列表里（`--deep` 可补）。
- 汇金资管在不同报告期进入十大流通股东的个股数量波动很大（例如 2026 Q1 为 145 只，Q2 为 17 只，服务端精确查询也是 17 条），原因没有查实，页面说明里提醒了读者看具体个股的持股数，不要比较个股数量。
- 东财 `push2` 对部分 IP 会 302 到 `push2delay`，Node 的 `fetch` 默认跟随；深交所/上交所接口对境外 IP 有反爬，本模块不直接用它们。

## 灵感来源

思路参考开源项目 [h-jett/etf-radar](https://github.com/h-jett/etf-radar)（MIT）。采集代码、分类规则、聚合与前端均为本项目重写，并修正了它的关键词误匹配和分页丢行问题。
