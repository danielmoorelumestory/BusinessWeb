export interface EtfItem {
  ticker: string
  name: string
  issuer: string
  /** 跟踪的指数 / 持仓方法 */
  tracks: string
  /** 一句话定位 */
  focus: string
  /** 详细介绍 */
  intro: string
  /** 适合谁 / 怎么用 */
  fit: string
  /** 主要风险 */
  risk: string
  /** 来自视频清单 */
  fromVideo?: boolean
}

export interface EtfSchool {
  id: string
  title: string
  /** 这个流派的核心思路 */
  idea: string
  etfs: EtfItem[]
}

export const ETF_DISCLAIMER =
  '以下为产品与投资思路介绍，不构成买卖建议。费率、规模、成分与调仓规则会变，以发行人官网和基金招募说明书为准；文中不给出收益预测。'

export const ETF_SCHOOLS: EtfSchool[] = [
  {
    id: 'broad',
    title: '一、宽基指数：买下整个市场',
    idea: '不选股、不选行业，按市值加权持有一篮子大市场，赚市场平均回报。成本最低、最省心，是大多数人的核心仓位。',
    etfs: [
      {
        ticker: 'VOO', name: 'Vanguard S&P 500 ETF', issuer: 'Vanguard',
        tracks: '标普 500 指数（美国大盘 500 家）',
        focus: '标普 500 的低成本代表',
        intro: '追踪标普 500，按市值加权，前十大权重股（苹果、微软、英伟达、亚马逊等）合计占比较高，因此“500 家”实际上明显偏向大型科技。Vanguard 以低费率著称，是长期定投美股最常见的底仓。同类产品还有 IVV（iShares）和 SPY（SPDR，流动性最好、期权最活跃，但费率略高）。',
        fit: '作为核心仓位长期持有、定期定额。不想研究个股、也不想判断行业的人。',
        risk: '市值加权会让少数巨头主导走势；熊市中大盘同样大幅回撤，历史上出现过跌去一半的阶段。',
        fromVideo: true,
      },
      {
        ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', issuer: 'Vanguard',
        tracks: 'CRSP 美国全市场指数（大中小盘）',
        focus: '覆盖美股全部上市公司',
        intro: '比 VOO 多覆盖了中小盘，成分数以几千只计，但因为市值加权，实际走势与标普 500 高度接近。',
        fit: '想“一只买下整个美国”的人；与 VOO 二选一即可，没必要同时持有。',
        risk: '与 VOO 一样受大型股主导，分散度提升有限。',
      },
      {
        ticker: 'QQQ', name: 'Invesco QQQ Trust', issuer: 'Invesco',
        tracks: '纳斯达克 100 指数（纳斯达克上市的最大 100 家非金融公司）',
        focus: '大型科技与成长股的代表',
        intro: '集中在科技、通信与可选消费，不含金融股。成分少、集中度高，因此长期波动和弹性都大于标普 500。同类还有更低费率的 QQQM（Invesco，同指数）。',
        fit: '愿意承受更大波动、看好科技成长的人，常作为核心仓位之外的“进攻”部分。',
        risk: '行业集中；2022 年这类成长股曾大幅回撤，估值收缩时跌幅显著大于标普 500。',
      },
      {
        ticker: 'IWM', name: 'iShares Russell 2000 ETF', issuer: 'iShares (BlackRock)',
        tracks: '罗素 2000 指数（美国小盘股）',
        focus: '美国小盘股',
        intro: '小公司对利率与国内经济更敏感，与大盘科技的走势经常错位。成分中不少公司盈利不稳定。',
        fit: '想补充大盘之外的分散，或押注利率下行与经济复苏的人。',
        risk: '波动大、盈利质量参差，长期相对大盘的表现并不稳定。',
      },
      {
        ticker: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', issuer: 'State Street (SPDR)',
        tracks: '道琼斯工业平均指数（30 家蓝筹）',
        focus: '价格加权的 30 只老牌蓝筹',
        intro: '道指按股价而不是市值加权，股价高的公司权重更大，结构与市场整体差别较大，金融、工业、医疗占比相对更高，科技占比低于标普 500。',
        fit: '想要偏传统蓝筹、较低科技占比的人。',
        risk: '只有 30 只，价格加权方法不反映公司真实规模。',
      },
    ],
  },
  {
    id: 'factor',
    title: '二、因子 / Smart Beta：按规则挑一类特征',
    idea: '仍是指数化，但不按纯市值，而是按动量、质量、低波动等“因子”筛选加权。目标是在某种市场环境里比大盘更好，代价是某些阶段会明显落后。',
    etfs: [
      {
        ticker: 'SPMO', name: 'Invesco S&P 500 Momentum ETF', issuer: 'Invesco',
        tracks: '标普 500 动量指数',
        focus: '追强势：从标普 500 里挑近期涨得最好的',
        intro: '在标普 500 成分股中按过去约一年的风险调整后涨幅排名，选出动量最强的一批并按动量得分与市值加权，定期（通常每半年）重新选择。因此它会自动偏向近期的领涨板块：牛市里科技占比高，行业轮动后持仓也会整体换血。同类有 MTUM（iShares，全市场动量）。',
        fit: '相信“强者恒强”的趋势类投资者，想要比标普 500 更偏进攻的版本。',
        risk: '动量在拐点处容易“接最后一棒”：风格突然反转（如 2022 年、急涨后的快速回调）时可能比大盘跌得更多；换仓周期固定，反应有滞后。',
        fromVideo: true,
      },
      {
        ticker: 'QUAL', name: 'iShares MSCI USA Quality Factor ETF', issuer: 'iShares (BlackRock)',
        tracks: 'MSCI USA 质量因子指数',
        focus: '高 ROE、低杠杆、盈利稳定的公司',
        intro: '用净资产收益率、负债率、盈利波动三类指标筛选质量高的公司，偏向盈利能力强的龙头。',
        fit: '想要“好公司”但不想自己判断个股的人。',
        risk: '“质量”的定义靠财务指标，可能在估值已很高时仍然买入；风格轮动时可能落后。',
      },
      {
        ticker: 'RSP', name: 'Invesco S&P 500 Equal Weight ETF', issuer: 'Invesco',
        tracks: '标普 500 等权重指数',
        focus: '500 家公司权重一样，对冲“巨头垄断”',
        intro: '每家公司权重相同并定期再平衡，因此对中小市值与非科技行业的暴露更大，等于用“卖出涨多的、买入跌多的”规则做再平衡。',
        fit: '担心大盘集中度过高、想要更分散的人。',
        risk: '科技巨头主导的行情中会落后；换手更多，成分里小公司的波动更大。',
      },
    ],
  },
  {
    id: 'dividend',
    title: '三、红利 / 股息：高分红派（美国与全球）',
    idea: '按股息率或“连续分红 + 财务健康”选股，现金流稳、偏价值与防御。细分三类：美国红利（质量型 / 增长型 / 高股息型）、美国之外的全球红利、A 股与港股红利。选法不同，持仓和风险差别很大，要看指数规则而不是只看名字里的“红利”。',
    etfs: [
      {
        ticker: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', issuer: 'Charles Schwab',
        tracks: 'Dow Jones U.S. Dividend 100 指数',
        focus: '股息 + 质量：高分红且财务健康的公司',
        intro: '不是单纯挑股息率最高的，而是先筛选连续多年分红、现金流与 ROE 较好的公司，再按市值加权，约 100 只。是美股“红利流派”里人气最高的代表之一。同类有 VIG（股息增长）、VYM（高股息）、DGRO。',
        fit: '看重现金流和分红、偏价值与防御风格的人。',
        risk: '科技成长占比低，大牛市里长期可能跑输标普 500；股息不是保证，公司削减分红会直接影响收益。',
      },
      {
        ticker: 'VIG', name: 'Vanguard Dividend Appreciation ETF', issuer: 'Vanguard',
        tracks: 'S&P U.S. Dividend Growers 指数',
        focus: '股息增长：连续多年提高分红的公司',
        intro: '看重“分红能持续增长”，不追高股息率，所以持仓偏向科技、医疗、必需消费等质量较好的龙头，股息率通常较低。同类有 DGRO（iShares），都属于股息增长流派。',
        fit: '想要“分红 + 成长”的平衡，不想追高股息的人。',
        risk: '当期股息率低，不适合靠分红生活；若指数中科技占比上升，防御性会下降。',
      },
      {
        ticker: 'VYM', name: 'Vanguard High Dividend Yield ETF', issuer: 'Vanguard',
        tracks: 'FTSE High Dividend Yield 指数',
        focus: '美国高股息大盘股',
        intro: '按预期股息率选取，持仓数百只，金融、医疗、工业、能源占比较高，科技占比低于标普 500。同类有 HDV（iShares，叠加质量筛选）、DVY（iShares，偏重公用事业与金融）。',
        fit: '偏价值、偏防御，想提高组合当期收入的人。',
        risk: '高股息有时是股价下跌造成的，可能买到“价值陷阱”；银行、能源占比使它受周期影响；牛市里常跑输标普 500。',
      },
      {
        ticker: 'VYMI', name: 'Vanguard International High Dividend Yield ETF', issuer: 'Vanguard',
        tracks: 'FTSE All-World ex US High Dividend Yield 指数',
        focus: '全球红利（除美国）：欧洲、日本、新兴市场的高股息股',
        intro: '把红利思路扩展到美国之外，覆盖欧洲、日本、加拿大、澳大利亚、新兴市场等，金融、能源、材料占比高。同类有 IDV（iShares International Select Dividend）、FGD（First Trust 全球股息）。海外分红一般要被来源国预扣税，实际到手股息低于标称。',
        fit: '已有美国红利 / 宽基，想再补美国之外分散的人。',
        risk: '汇率波动；金融与周期行业集中；预扣税降低到手收益；各国分红政策差异大。',
      },
      {
        ticker: 'SDIV', name: 'Global X SuperDividend ETF', issuer: 'Global X',
        tracks: 'Solactive Global SuperDividend 指数',
        focus: '全球最高股息率的 100 只股票，等权',
        intro: '专挑全球股息率最高的一批，包括地产、能源、航运和新兴市场公司，分红率很高，但成分质量参差。',
        fit: '只适合清楚高息风险、小仓位尝试的人。',
        risk: '极高股息常意味着基本面压力；历史上净值长期下滑、分红被削减的例子不少，“高分红”不等于“高总回报”。',
      },
    ],
  },
  {
    id: 'divlowvol',
    title: '四、红利低波：中国 / 香港 / 全球的主流代表',
    idea: '同时筛“股息高”和“波动低”，追求稳定现金流加更浅的回撤，是偏防御的组合。在 A 股、港股、美股和全球都有对应的主流产品，思路相近但规则不同，不要混为一谈。',
    etfs: [
      {
        ticker: '512890', name: '红利低波 ETF（华泰柏瑞）', issuer: '华泰柏瑞基金',
        tracks: '中证红利低波动指数（H30269）',
        focus: 'A 股红利低波的规模代表',
        intro: '指数选取 50 只流动性好、连续分红、股息率较高且波动率较低的公司，偏向银行、能源、煤炭、公用事业、交通运输等，是 A 股“红利低波”最主流的产品。对应美股的 SPHD / USMV 思路。',
        fit: '偏防御、看重分红与回撤控制的人，常作为 A 股的稳健底仓。',
        risk: '集中在少数传统行业，成长行情中易落后；资金大量涌入后估值已不低，高位时回撤也会很明显；分红政策变化直接影响股息。',
      },
      {
        ticker: '563020', name: '红利低波动 ETF（易方达）', issuer: '易方达基金',
        tracks: '中证红利低波动指数（H30269）',
        focus: '与 512890 同一指数的另一只主流产品',
        intro: '跟踪同一指数，持仓几乎一致；据公开信息，易方达红利类 ETF 的管理费与托管费合计约 0.2%/年（以招募说明书为准）。同指数产品之间的差别主要在费率、规模、流动性与溢折价，没必要重复持有。',
        fit: '想买同一指数、比较费率与流动性的人。',
        risk: '同 512890。',
      },
      {
        ticker: '515450', name: '红利低波 50 ETF（南方）', issuer: '南方基金',
        tracks: '标普中国 A 股大盘红利低波 50 指数',
        focus: '另一套选股规则的红利低波',
        intro: '指数编制方是标普，不是中证；选股范围偏大盘，规则与中证红利低波动不同，因此持仓和走势并不完全一样。买红利低波时要看清它跟踪的是哪一条指数。',
        fit: '想在红利低波内再分散一套指数规则的人。',
        risk: '同样集中于传统行业；不同指数规则下的风格暴露有差异。',
      },
      {
        ticker: '159545', name: '恒生红利低波 ETF（易方达）', issuer: '易方达基金',
        tracks: '恒生港股通高股息低波动指数',
        focus: '港股红利低波的主流产品',
        intro: '从港股通标的中选出 50 只股息率较高、股价波动相对较低的公司，偏向银行、能源、公用事业、电信等；据公开信息，管理费与托管费合计约 0.2%/年，指数股息率明显高于 A 股同类（数值随时点变化）。港股通渠道的红利税口径与 A 股不同，个人所得税需自行核对。',
        fit: '想在 A 股红利低波之外分散到港股的人。',
        risk: '港币汇率；行业集中在金融与能源；红利税与分红政策可能变化；港股流动性与估值波动大于 A 股。',
      },
      {
        ticker: 'SPHD', name: 'Invesco S&P 500 High Dividend Low Volatility ETF', issuer: 'Invesco',
        tracks: 'S&P 500 High Dividend Low Volatility 指数',
        focus: '美股最典型的“红利低波”',
        intro: '从标普 500 里选出股息率最高的 50 只中波动较低的股票，按股息率加权，持仓偏向地产（REITs）、公用事业、必需消费、能源与金融，月度分红。',
        fit: '想要美股版“高息 + 低波”的人。',
        risk: '利率上行时对利率敏感的行业（地产、公用事业）承压；高息股可能掩盖基本面问题；牛市里弹性弱。',
      },
      {
        ticker: 'SPLV', name: 'Invesco S&P 500 Low Volatility ETF', issuer: 'Invesco',
        tracks: 'S&P 500 低波动指数',
        focus: '标普 500 中波动最低的 100 只',
        intro: '按过去一年波动率最低选股并按波动率倒数加权，不看股息，防御属性更纯；与 USMV 的差别是 USMV 通过优化控制整体波动，SPLV 是直接按排名选。',
        fit: '想降低美股组合波动的人。',
        risk: '利率敏感；在快速上涨行情中落后；季度再平衡有滞后。',
      },
      {
        ticker: 'USMV', name: 'iShares MSCI USA Min Vol Factor ETF', issuer: 'iShares (BlackRock)',
        tracks: 'MSCI USA 最小波动率指数',
        focus: '低波动，追求更平缓的回撤',
        intro: '通过优化选出整体波动更低的组合并设行业偏离上限，常偏向公用事业、必需消费、医疗等防御行业。',
        fit: '对回撤敏感、想降低组合波动的人。',
        risk: '牛市中涨得慢；对利率上行较敏感（防御股常被当作债券替代）。',
      },
      {
        ticker: 'ACWV', name: 'iShares MSCI All Country World Min Vol Factor ETF', issuer: 'iShares (BlackRock)',
        tracks: 'MSCI ACWI 最小波动率指数',
        focus: '全球低波',
        intro: '在全球发达与新兴市场中，用优化方法构建整体波动更低的组合，美国占比最高，同时分散到日本、欧洲等。',
        fit: '想用一只产品做全球低波配置的人。',
        risk: '全球范围内仍有美国集中；汇率波动；上涨行情中弹性弱。',
      },
      {
        ticker: 'EFAV', name: 'iShares MSCI EAFE Min Vol Factor ETF', issuer: 'iShares (BlackRock)',
        tracks: 'MSCI EAFE 最小波动率指数',
        focus: '发达市场（除美国、加拿大）低波',
        intro: '覆盖欧洲、日本、澳洲等，用来分散美国之外的发达市场，与 VYMI 的区别是它按低波动而不是高股息选股。',
        fit: '想补美国之外发达市场且偏防御的人。',
        risk: '汇率；欧洲与日本的经济与政策风险；成分偏金融与必需消费。',
      },
    ],
  },
  {
    id: 'theme',
    title: '五、主题 / 产业赛道：押一条产业链',
    idea: '围绕一个产业主题（半导体、AI 硬件、存储等）集中持有。弹性大、集中度高，既可能大涨也可能大回撤，应当控制仓位，视为“卫星仓位”。',
    etfs: [
      {
        ticker: 'MAGS', name: 'Roundhill Magnificent Seven ETF', issuer: 'Roundhill Investments',
        tracks: 'Magnificent Seven（七巨头）等权',
        focus: '把七家美股巨头打包',
        intro: '只持有 Alphabet、亚马逊、苹果、Meta、微软、英伟达、特斯拉这七只股票，并以等权方式配置，按季度再平衡回到各约 1/7（据发行人披露，费率约 0.29%，2023 年 4 月上市）。相比 QQQ，它更“纯”，也更集中；等权让特斯拉这类波动大的股票权重高于其在市值加权指数中的占比。',
        fit: '想用一只产品直接持有七巨头、又不想自己再平衡的人。',
        risk: '只有 7 只股票，任何一家出问题影响都很大；这七家本就大量重叠于 VOO 和 QQQ，叠加持有会把集中度翻倍。',
        fromVideo: true,
      },
      {
        ticker: 'SOXX', name: 'iShares Semiconductor ETF', issuer: 'iShares (BlackRock)',
        tracks: 'NYSE Semiconductor 指数',
        focus: '半导体行业，持股数较多、单只上限较低',
        intro: '覆盖设计、制造、设备等半导体公司，成分数量较 SMH 多，单只权重上限更严，因此头部公司占比相对较低、分散度更好一些。',
        fit: '看好半导体周期、希望比 SMH 略分散的人。',
        risk: '半导体是强周期行业，库存与资本开支周期会带来大幅回撤；与 AI 主题强相关。',
        fromVideo: true,
      },
      {
        ticker: 'SMH', name: 'VanEck Semiconductor ETF', issuer: 'VanEck',
        tracks: 'MVIS US Listed Semiconductor 25 指数',
        focus: '半导体龙头，高度集中',
        intro: '只持有约 25 只美国上市的半导体龙头，英伟达、台积电 ADR 等占据很大权重，是“买 AI 芯片龙头”最直接的 ETF 之一。',
        fit: '想直接押注龙头、能接受高集中度的人。',
        risk: '前几大持仓决定了绝大部分走势，集中度比 SOXX 更高；龙头估值回落时跌幅更大。',
        fromVideo: true,
      },
      {
        ticker: 'DRAM', name: 'Roundhill Memory ETF', issuer: 'Roundhill Investments',
        tracks: '全球存储芯片与存储设备公司',
        focus: '押存储周期：DRAM、NAND、硬盘',
        intro: '据发行人及媒体披露，仅持有约 9 只股票，美光、三星电子、SK 海力士各约占四分之一，其余为 Kioxia、闪迪、西部数据、希捷等；三星与 SK 海力士不在美国上市，也不在 SOXX、SMH 里，所以 DRAM 提供了一条直接买韩国存储龙头的美股通道。费率约 0.65%，上市后规模增长极快。存储受 AI 服务器对 HBM 和大容量存储的需求推动。',
        fit: '明确想押存储这条细分链的人，作为小比例卫星仓位。',
        risk: '成立时间短、历史很短；持股只有个位数、前三大占约 75%；存储价格是出名的大周期，供过于求时价格和股价会一起下跌；包含韩国股票，还有汇率和跨市场交易时间差。',
        fromVideo: true,
      },
      {
        ticker: 'XLK', name: 'Technology Select Sector SPDR Fund', issuer: 'State Street (SPDR)',
        tracks: '标普 500 信息技术板块（带权重上限规则）',
        focus: '大盘科技板块',
        intro: 'SPDR 行业九兄弟之一，同系列还有 XLE（能源）、XLV（医疗）、XLF（金融）、XLY / XLP（可选 / 必需消费）、XLI（工业）、XLU（公用事业）、XLB（材料）、XLRE（地产）。行业 ETF 是最简单的行业轮动工具。',
        fit: '想按宏观周期（见“宏观温度”页）切换行业的人。',
        risk: '单一行业集中；行业轮动判断错误成本高。',
      },
      {
        ticker: 'ARKK', name: 'ARK Innovation ETF', issuer: 'ARK Invest',
        tracks: '主动管理（颠覆式创新）',
        focus: '主动管理的高成长创新股',
        intro: '不跟踪指数，由基金经理主动选股，集中持有基因、机器人、金融科技、自动驾驶等高成长公司，波动极大。',
        fit: '少量资金押高风险高弹性的创新主题。',
        risk: '主动管理加高集中度，在加息与成长股杀估值的阶段曾出现过非常深的回撤，业绩依赖基金经理。',
      },
    ],
  },
  {
    id: 'global',
    title: '六、全球 / 区域：分散到美国之外',
    idea: '把单一国家风险分散到全球或特定地区。美国之外的市场估值、行业结构和货币都不同，与美股的相关性并不是 100%。',
    etfs: [
      {
        ticker: 'VT', name: 'Vanguard Total World Stock ETF', issuer: 'Vanguard',
        tracks: 'FTSE Global All Cap 指数',
        focus: '一只买下全球股市',
        intro: '按市值加权覆盖发达和新兴市场，美国占比最高（约六成以上），其余为欧洲、日本、新兴市场。',
        fit: '想一步到位的全球配置者。',
        risk: '美国权重仍然很大，并不会比 VOO 分散很多；非美资产在美元强势时有汇率拖累。',
      },
      {
        ticker: 'VXUS', name: 'Vanguard Total International Stock ETF', issuer: 'Vanguard',
        tracks: 'FTSE Global All Cap ex US 指数',
        focus: '除美国外的全球股市',
        intro: '常与 VOO / VTI 搭配，补足美国之外的部分。',
        fit: '在美股核心仓位之外再加海外分散的人。',
        risk: '长期表现受汇率和各国政策影响；过去十多年整体弱于美股。',
      },
      {
        ticker: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', issuer: 'Vanguard',
        tracks: 'FTSE Emerging Markets 指数',
        focus: '新兴市场：中国、印度、台湾、巴西等',
        intro: '同类有 iShares 的 EEM、IEMG。注意不同指数商对台湾、韩国、中国 A 股的分类和权重不同，持仓会有明显差异。',
        fit: '看好新兴市场长期增长的人。',
        risk: '政策、地缘与汇率风险高；集中在少数国家，如中国、印度、台湾。',
      },
      {
        ticker: 'KWEB', name: 'KraneShares CSI China Internet ETF', issuer: 'KraneShares',
        tracks: '中证海外中国互联网指数',
        focus: '海外上市的中国互联网公司',
        intro: '持有腾讯、阿里巴巴、美团、拼多多等在港股和美股上市的中国互联网龙头。同类有 MCHI（全中国）、FXI（中国大盘）。',
        fit: '想直接押中国互联网平台经济的人。',
        risk: '监管政策与地缘风险；波动极大；VIE 结构存在法律不确定性。',
      },
    ],
  },
  {
    id: 'cn',
    title: '七、A 股 / 港股常见 ETF（场内）',
    idea: '国内场内 ETF 同样是“指数化、低成本”工具，常见一类是宽基指数，一类是行业 / 策略，另有跨境 ETF 投美股和商品。国内按交易所代码买入，具体份额与溢价请在行情软件中核对。',
    etfs: [
      {
        ticker: '510300', name: '沪深 300 ETF（华泰柏瑞）', issuer: '华泰柏瑞基金',
        tracks: '沪深 300 指数',
        focus: 'A 股大盘蓝筹宽基',
        intro: '覆盖沪深两市市值与流动性靠前的 300 家公司，金融、消费、工业、能源占比较高。同类有嘉实、易方达等多家的沪深 300 ETF，规模与成交量最大的几只流动性最好。',
        fit: '想配置 A 股核心资产的人。',
        risk: 'A 股波动与政策周期明显；金融和传统行业占比高，成长性弱于科创板块。',
      },
      {
        ticker: '510500', name: '中证 500 ETF（南方）', issuer: '南方基金',
        tracks: '中证 500 指数',
        focus: 'A 股中盘',
        intro: '沪深 300 之外、市值靠前的 500 家中盘公司，行业分布更分散，制造业与科技占比更高。',
        fit: '想补充大盘之外的中盘成长的人。',
        risk: '波动高于沪深 300；风格轮动明显。',
      },
      {
        ticker: '159915', name: '创业板 ETF（易方达）', issuer: '易方达基金',
        tracks: '创业板指数',
        focus: '成长风格：新能源、医药、电子',
        intro: '创业板是注册制下的成长型公司集中地，宁德时代等行业龙头占较大权重；同类有科创 50 ETF（如 588000），聚焦科创板硬科技。',
        fit: '看好成长风格的人。',
        risk: '估值与风格波动大，历史上有过较深回撤。',
      },
      {
        ticker: '513100', name: '纳指 ETF（国泰）', issuer: '国泰基金',
        tracks: '纳斯达克 100 指数',
        focus: '在国内场内投资美股科技',
        intro: '跨境 ETF，对应 QQQ 的指数。相关产品还有标普 500 ETF（如 513500）。注意跨境 ETF 受额度影响，场内价格会出现明显溢价，买入前要看溢价率。',
        fit: '没有海外账户、希望用人民币账户配置美股的人。',
        risk: '溢价风险；额度暂停申购时价格偏离净值；美元汇率与美股双重波动。',
      },
      {
        ticker: '518880', name: '黄金 ETF（华安）', issuer: '华安基金',
        tracks: '上海黄金交易所 Au99.99 价格',
        focus: '国内场内黄金',
        intro: '以实物黄金为基础的 ETF，用来对冲通胀、地缘风险与权益资产回撤。',
        fit: '想在组合中配置避险资产的人。',
        risk: '黄金不产生现金流，长期收益依赖价格；价格受实际利率与美元影响较大。',
      },
    ],
  },
  {
    id: 'bond',
    title: '八、债券 / 现金：组合的压舱石',
    idea: '提供票息、降低组合波动，并在股市下跌时承担缓冲作用。但 2022 年股债同跌说明，债券也不是绝对安全。',
    etfs: [
      {
        ticker: 'BND / AGG', name: 'Vanguard Total Bond / iShares Core U.S. Aggregate Bond', issuer: 'Vanguard / iShares',
        tracks: '美国综合债券指数（国债、企业债、MBS）',
        focus: '整个美国投资级债券市场',
        intro: '久期适中，是最常见的债券底仓。',
        fit: '股债平衡配置者。',
        risk: '利率上升时价格下跌；存续期越长，利率敏感度越高。',
      },
      {
        ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', issuer: 'iShares (BlackRock)',
        tracks: '美国 20 年以上长期国债',
        focus: '长久期国债，利率敏感度最高',
        intro: '在衰退与降息预期下弹性大，常被用作“股票大跌时的对冲”，但利率上行时回撤也很深（2022 年即是如此）。',
        fit: '想押利率下行或做组合对冲、能承受波动的人。',
        risk: '久期长，对利率变化极其敏感，波动不亚于股票。',
      },
      {
        ticker: 'SGOV / BIL', name: 'iShares 0-3 Month Treasury Bond / SPDR 1-3 Month T-Bill', issuer: 'iShares / SPDR',
        tracks: '美国短期国债（几个月内到期）',
        focus: '近似现金，赚短端利率',
        intro: '久期极短，价格波动很小，收益跟着短期利率走。适合停放等待加仓的现金。',
        fit: '作为“弹药仓位”的现金替代。',
        risk: '降息周期里收益下降；收益基本只跑赢通胀的一部分。',
      },
    ],
  },
  {
    id: 'commodity',
    title: '九、商品与另类：对冲与分散',
    idea: '与股债相关性较低，用来对冲通胀、货币贬值和系统性风险，但没有现金流，收益完全靠价格。',
    etfs: [
      {
        ticker: 'GLD / IAU', name: 'SPDR Gold Shares / iShares Gold Trust', issuer: 'State Street / iShares',
        tracks: '伦敦金价（实物黄金）',
        focus: '黄金',
        intro: 'GLD 规模最大、流动性最好；IAU 费率更低。两者本质都是持有实物黄金。',
        fit: '想配置避险资产的人。',
        risk: '无现金流；黄金价格在实际利率上行时承压。',
      },
      {
        ticker: 'SLV', name: 'iShares Silver Trust', issuer: 'iShares (BlackRock)',
        tracks: '白银现货价格',
        focus: '白银：兼具贵金属与工业属性',
        intro: '白银既是避险资产又大量用于光伏、电子等工业，价格波动明显大于黄金。本项目“宏观温度”里也有白银监控。',
        fit: '想要更高弹性的贵金属敞口。',
        risk: '波动远大于黄金；受工业需求与投机资金影响。',
      },
      {
        ticker: 'IBIT', name: 'iShares Bitcoin Trust', issuer: 'iShares (BlackRock)',
        tracks: '比特币现货价格',
        focus: '现货比特币 ETF',
        intro: '2024 年美国批准现货比特币 ETF 后上市，让传统账户可以持有比特币敞口，同类有 FBTC（Fidelity）。',
        fit: '想用传统证券账户参与加密资产的人，小仓位。',
        risk: '价格波动极大；监管与政策变化；没有现金流。',
      },
    ],
  },
  {
    id: 'income',
    title: '十、备兑 / 收益增强：用期权换现金流',
    idea: '在持有股票的同时卖出期权，把部分上涨空间换成当期的“高分红”。上涨市场里涨得慢，下跌里缓冲有限。',
    etfs: [
      {
        ticker: 'JEPI / JEPQ', name: 'JPMorgan Equity Premium Income / Nasdaq Equity Premium Income', issuer: 'J.P. Morgan',
        tracks: '主动管理（低波动股票 + 期权收益连结票据）',
        focus: '以股息形式分配较高的月度收入',
        intro: 'JEPI 对应标普 500 风格，JEPQ 对应纳指风格。同类还有 QYLD、XYLD（Global X，机械式备兑看涨）。',
        fit: '想要稳定月度现金流、看重当期收入的人。',
        risk: '上涨时被封顶、跑输指数；高分红中可能含资本返还，不等于真实盈利；下跌时仍会跌。',
      },
    ],
  },
  {
    id: 'leverage',
    title: '十一、杠杆 / 反向：短线工具，不是长期持有品',
    idea: '每日重置杠杆倍数，路径依赖强。长期持有会因为“波动损耗”偏离指数的倍数收益，应当只作短线工具。项目“宏观温度”页也有“减少杠杆 ETF 比例”的建议。',
    etfs: [
      {
        ticker: 'TQQQ / SQQQ', name: 'ProShares UltraPro QQQ / UltraPro Short QQQ', issuer: 'ProShares',
        tracks: '纳指 100 每日 3 倍 / 反向 3 倍',
        focus: '日内杠杆',
        intro: '同类还有半导体 3 倍的 SOXL / SOXS、标普 500 的 UPRO / SPXU 等。',
        fit: '只适合能盯盘、有严格止损纪律的短线交易者。与本书“不盯盘、不预测”的方法相反。',
        risk: '震荡市里即使指数回到原点也会亏损；单日暴跌可能造成接近归零的伤害；费率与跟踪误差较高。',
      },
    ],
  },
]

export const ETF_COUNT = ETF_SCHOOLS.reduce((n, s) => n + s.etfs.length, 0)
