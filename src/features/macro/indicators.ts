import { SIGNALS, computeStage, type Tone } from './stages'

export type SeriesKey = 'gdp' | 'unrate' | 'sahm' | 'claims' | 'corePce' | 'realRate' | 'curve' | 'hy' | 'nfci' | 'vix' | 'dd' | 'kre' | 'marginGdp' | 'cashDebt' | 'dxy' | 'gold' | 'silver' | 'wti' | 'equityShare' | 'buffett' | 'debtService' | 'ccDelinq' | 'tenYear' | 'saving'

export interface Indicator<K extends string = SeriesKey> {
  key: K
  name: string
  module: ModuleId
  /** 'above'：越高越差；'below'：越低越差；undefined：只作背景，不打分 */
  worse?: 'above' | 'below'
  yellow?: number
  red?: number
  digits: number
  why: string
  limit: string
  freq: string
  /** 'high'：数值越高越拥挤（按历史分位 ≥80% 黄、≥95% 红）；'low'：越低越拥挤（≤20% 黄、≤5% 红）。设置后不用 yellow/red 绝对阈值 */
  crowded?: 'high' | 'low'
}

export type ModuleId = 'growth' | 'inflation' | 'credit' | 'market' | 'cn-growth' | 'cn-price' | 'cn-money' | 'leverage' | 'cn-leverage' | 'hk-market' | 'hk-money' | 'assets'

export const MODULES: { id: ModuleId; name: string; question: string }[] = [
  { id: 'growth', name: '增长与就业', question: '经济在扩张还是开始失速？' },
  { id: 'inflation', name: '通胀与政策', question: '央行是在踩刹车还是松油门？' },
  { id: 'credit', name: '信用与金融条件', question: '借钱的成本和意愿有没有收紧？' },
  { id: 'market', name: '市场与情绪', question: '市场有没有开始恐慌？' },
  { id: 'leverage', name: '杠杆与资金', question: '市场里的杠杆有多重、手里还剩多少现金？' },
]

// 与 2026 投资计划重合的指标直接沿用其阈值，两页结论一致
const signal = (id: string) => SIGNALS.find(s => s.id === id)!

export const INDICATORS: Indicator[] = [
  { key: 'gdp', name: '实际 GDP 增速（环比折年）', module: 'growth', worse: 'below', yellow: 1.5, red: 0, digits: 1, freq: '季度',
    why: '经济总量的直接读数。低于 1.5% 算明显放缓，转负说明产出在收缩。', limit: '滞后约一个季度公布，且常被大幅修正，只能确认、不能预警。' },
  { key: 'unrate', name: '失业率', module: 'growth', digits: 1, freq: '月度',
    why: '就业是消费的底座。绝对水平本身说明不了太多，要看它从低点抬升了多少（见萨姆规则）。', limit: '受劳动参与率变化影响，单月波动大。' },
  { key: 'sahm', name: '萨姆规则读数', module: 'growth', worse: 'above', yellow: signal('sahm').yellow, red: signal('sahm').red, digits: 2, freq: '月度',
    why: '失业率 3 个月均值较过去 12 个月低点的上升幅度。达到 0.5 时，历史上美国通常已处于衰退早期。', limit: '它确认衰退而非预测衰退；劳动力供给突增时可能误报。' },
  { key: 'claims', name: '初请失业金（4 周均值）', module: 'growth', worse: 'above', yellow: signal('claims').yellow, red: signal('claims').red, digits: 1, freq: '每周',
    why: '企业裁员最早出现在这里，比失业率领先。', limit: '节假日与季节调整会造成噪音，所以看 4 周均值。' },
  { key: 'saving', name: '个人储蓄率', module: 'growth', digits: 1, freq: '月度',
    why: '居民收入里没花掉的比例，是家庭抵御冲击的缓冲垫。储蓄率压得越低，消费越依赖财富效应和借贷，股价一跌就容易传导到消费。', limit: '受收入口径修订和一次性补贴影响；只作背景，不打分。' },
  { key: 'corePce', name: '核心 PCE 通胀（同比）', module: 'inflation', worse: 'above', yellow: 2.5, red: 3.5, digits: 2, freq: '月度',
    why: '美联储盯的通胀口径。通胀越高，降息救市的空间越小。', limit: '滞后一个月公布；同比读数受基数影响。' },
  { key: 'realRate', name: '实际政策利率', module: 'inflation', worse: 'above', yellow: 1.5, red: 2.5, digits: 2, freq: '月度',
    why: '联邦基金利率减核心通胀。数值越高，货币政策越紧，经济承压越大。', limit: '“中性利率”本身不可观测，阈值只是经验范围。' },
  { key: 'tenYear', name: '10 年期美债收益率', module: 'inflation', digits: 2, freq: '每日',
    why: '全球资产定价的锚。收益率越高，股票相对债券的吸引力越低，高估值资产承压越明显；也直接决定房贷和企业融资成本。', limit: '只作背景，不打分：它的高低要和通胀、增长一起看，单独说明不了好坏。' },
  { key: 'curve', name: '10 年 − 2 年美债利差', module: 'credit', worse: 'below', yellow: 0, red: -0.5, digits: 2, freq: '每日',
    why: '倒挂（负值）说明市场预期未来要降息，历史上常出现在衰退前。', limit: '倒挂到衰退的时滞从几个月到两年不等，单独使用不能择时。' },
  { key: 'hy', name: '高收益债利差 HY OAS', module: 'credit', worse: 'above', yellow: signal('hy').yellow, red: signal('hy').red, digits: 0, freq: '每日',
    why: '信用市场对违约的定价，往往比股市更早反映企业融资困难。', limit: '利差处在低位时说明市场乐观，也意味着对坏消息缺乏缓冲。' },
  { key: 'nfci', name: '芝加哥联储金融条件指数', module: 'credit', worse: 'above', yellow: 0, red: 0.5, digits: 2, freq: '每周',
    why: '综合 100 多项利率、信用、杠杆指标。正值表示金融条件比历史平均更紧。', limit: '综合指数会掩盖结构问题（例如某一类贷款单独恶化）。' },
  { key: 'ccDelinq', name: '信用卡逾期率', module: 'credit', worse: 'above', yellow: 3.5, red: 5, digits: 2, freq: '季度',
    why: '家庭资产负债表最先出现裂缝的地方：收入吃紧时，人们最先停还信用卡。2009–2010 年峰值约 6.8%，2021–2022 年低点约 1.5%。', limit: '黄红灯阈值是按历史区间设的经验值，不是官方标准；季度公布，滞后约两个月。' },
  { key: 'kre', name: '区域银行 KRE 连续跑输标普', module: 'credit', worse: 'above', yellow: signal('kre').yellow, red: signal('kre').red, digits: 0, freq: '每周',
    why: '区域银行是美国信用链条里最脆弱的一环。连续多周跑输大盘，往往是存款流失或坏账担忧的早期迹象（2023 年硅谷银行事件前即如此）。', limit: '受个别银行消息与利率预期影响大，需要和信用利差一起看。' },
  { key: 'vix', name: 'VIX 波动率', module: 'market', worse: 'above', yellow: signal('vix').yellow, red: signal('vix').red, digits: 1, freq: '每日',
    why: '期权市场隐含的未来 30 天波动。超过 20 偏紧张，超过 30 进入恐慌。', limit: '同步指标，只描述当下情绪，不预示方向。' },
  { key: 'dd', name: '标普 500 距高点回撤', module: 'market', worse: 'above', yellow: signal('dd').yellow, red: signal('dd').red, digits: 1, freq: '每日',
    why: '用来对照“回撤梯度”：回撤越深，越需要按事先写好的规则行动，而不是凭感觉。', limit: '价格指数，不含分红；高点取 FRED 可得的约十年窗口。' },
  { key: 'marginGdp', name: '保证金债务 ÷ GDP', module: 'leverage', crowded: 'high', digits: 2, freq: '月度',
    why: '券商客户借钱炒股的规模占经济总量的比例。越高说明杠杆越重，下跌时被迫平仓的卖压越大；2000、2007、2021 年的高点之后都出现了大幅回撤。', limit: '只能说明脆弱程度，不能预测拐点；杠杆可以在高位停留很久。GDP 滞后公布，最新几个月沿用上一季。' },
  { key: 'equityShare', name: '股票占家庭金融资产比重', module: 'leverage', crowded: 'high', digits: 1, freq: '季度',
    why: '美国家庭与非营利机构直接和间接（含基金、养老金账户）持有的股票，占全部金融资产的比例。比例越高，家庭财富对股市的依赖越深，下跌时的财富效应冲击越大；2000 年互联网泡沫高点附近约 38.7%。', limit: '它衡量的是“押得多重”，不是“什么时候跌”；高位可以停留数年。季度公布，滞后约三个月；比例升高也可能只是股价上涨抬高了权重。' },
  { key: 'buffett', name: '企业股票市值 ÷ GDP', module: 'leverage', crowded: 'high', digits: 0, freq: '季度',
    why: '“巴菲特指标”的一种算法：美国非金融企业股票的市场价值，除以名义 GDP。越高说明股价相对经济产出越贵，未来长期回报的安全边际越薄。', limit: '这里用的是美联储资金流量表里的非金融企业口径（含未上市公司权益），绝对数值与常见的“总市值÷GDP”不同，只适合和自己的历史比。不能用来择时。' },
  { key: 'debtService', name: '家庭债务偿付比', module: 'leverage', crowded: 'high', digits: 2, freq: '季度',
    why: '家庭每年还本付息占可支配收入的比例。它用来区分“证券市场过热”和“整个家庭资产负债表脆弱”：2007 年前后它在历史高位，现在没有明显恶化。', limit: '只统计有债务的偿付额，不反映负债人群内部的分化；数据始于 2005 年，历史分位样本较短。' },
  { key: 'cashDebt', name: '客户现金 ÷ 保证金债务', module: 'leverage', crowded: 'low', digits: 1, freq: '月度',
    why: '券商账户里闲置现金相对借款的比例，反映散户手里还有多少子弹。比例越低，说明现金已经压到股市里，缺少新增买盘。', limit: '只统计 FINRA 会员券商，不含银行账户和货币基金里的现金；是存量比例，不等于散户整体仓位。' },
]

/** 当前值在全部历史中的百分位（0-100）；样本不足 24 个返回 undefined */
export function percentileOf(long: [string, number][] | undefined, v: number): number | undefined {
  if (!long || long.length < 24) return undefined
  return Math.round((long.filter(([, x]) => x <= v).length / long.length) * 100)
}

/** 顶部"四大参照价格"：只作背景，不打分、不计入阶段 */
export const ASSET_INDICATORS: Indicator<'dxy' | 'gold' | 'silver' | 'wti'>[] = [
  { key: 'dxy', name: '美元指数', module: 'assets', digits: 1, freq: '每日',
    why: '美元强弱决定全球流动性松紧：美元走强时，新兴市场、大宗商品和以美元计价的资产通常承压。', limit: '只是对一篮子货币的汇率，欧元占比超过一半；不等于美元购买力。' },
  { key: 'gold', name: '黄金', module: 'assets', digits: 0, freq: '每日',
    why: '实际利率下行、美元信用担忧、地缘风险和央行购金都会推高金价；它是衡量避险情绪和货币信用的温度计。', limit: '不产生现金流，涨跌主要由情绪和利率驱动；高位不代表马上回落。' },
  { key: 'silver', name: '白银', module: 'assets', digits: 1, freq: '每日',
    why: '兼具贵金属和工业属性（光伏、电子）。金银比下降通常说明市场更偏向风险与工业需求。', limit: '波动比黄金大得多，流动性也更差，容易被短期资金放大。' },
  { key: 'wti', name: 'WTI 原油', module: 'assets', digits: 1, freq: '每日',
    why: '油价同时影响通胀、央行政策和企业成本：快速上涨会推高通胀预期，快速下跌往往伴随需求担忧。', limit: '期货主力合约换月时会有价差跳变；价格也受 OPEC 和地缘消息驱动，与宏观基本面无关。' },
]

export function toneOf(ind: Indicator<string>, v: number | undefined, long?: [string, number][]): Tone {
  if (ind.crowded) {
    const p = v === undefined ? undefined : percentileOf(long, v)
    if (p === undefined) return 'gray'
    return ind.crowded === 'high' ? (p >= 95 ? 'red' : p >= 80 ? 'yellow' : 'green') : (p <= 5 ? 'red' : p <= 20 ? 'yellow' : 'green')
  }
  if (v === undefined || !Number.isFinite(v) || !ind.worse || ind.yellow === undefined || ind.red === undefined) return 'gray'
  if (ind.worse === 'above') return v >= ind.red ? 'red' : v >= ind.yellow ? 'yellow' : 'green'
  return v <= ind.red ? 'red' : v <= ind.yellow ? 'yellow' : 'green'
}

export const thresholdText = (ind: Indicator<string>, unit: string): string => {
  if (ind.crowded) return ind.crowded === 'high' ? '历史分位：≥80% 黄灯 · ≥95% 红灯' : '历史分位：≤20% 黄灯 · ≤5% 红灯（越低越拥挤）'
  if (!ind.worse || ind.yellow === undefined || ind.red === undefined) return '背景指标，不打分'
  const op = ind.worse === 'above' ? '≥' : '≤'
  return `黄灯 ${op} ${ind.yellow}${unit} · 红灯 ${op} ${ind.red}${unit}`
}

export interface SeriesData {
  fred?: string
  source?: string
  unit: string
  note?: string
  latest: { date: string; value: number }
  history: [string, number][]
  /** 全部月度历史（只有杠杆类指标有），用于长历史图和历史分位 */
  long?: [string, number][]
  /** 仅实时刷新时有：true = 这次刚拉到；false = 这次没拉到，沿用旧值 */
  live?: boolean
}

export interface MacroSnapshot<K extends string = SeriesKey> {
  generatedAt: string
  /** 实时刷新时才有：精确到秒的拉取时间 */
  fetchedAt?: string
  source: string
  series: Record<K, SeriesData>
}

/** 距今多少天：用来提示数据是否过期 */
export const ageInDays = (date: string, today = new Date()): number => Math.floor((today.getTime() - new Date(date).getTime()) / 86_400_000)

/** 从快照里取出阶段信号（KRE 需手动，不在快照里） */
export function stageFromSnapshot(snap: MacroSnapshot) {
  const s = snap.series
  return computeStage(signalValues(snap))
}

/** 阶段信号的当前读数；快照里缺的项（拉取失败）不计入 */
export function signalValues(snap: MacroSnapshot): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of ['sahm', 'claims', 'hy', 'vix', 'dd', 'kre'] as const) {
    const v = snap.series[id]?.latest.value
    if (v !== undefined) out[id] = v
  }
  return out
}
