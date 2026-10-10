// 周期框架：康波、美股长周期、A 股牛熊、库存周期。
// 这些周期没有公认的精确日期，下面的区间是公开研究（康波：周金涛一脉；美股：长牛长熊划分；库存周期：基钦）的大致范围，
// 加上本站的判断。页面上一律画成"范围"，并写明理由和反证，不用于择时。
export type BandKind = 'up' | 'peak' | 'flat' | 'down' | 'turn'

export interface Band { from: number; to: number; label: string; kind: BandKind; note: string }
export interface CycleView {
  id: string
  title: string
  length: string
  start: number
  end: number
  bands: Band[]
  /** 当前所处位置：区间 + 一句话结论 + 置信度 */
  now: { from: number; to: number; verdict: string; confidence: '低' | '中' }
  reasons: string[]
  counter: string[]
}

export const KONDRATIEFF: CycleView = {
  id: 'kondratieff',
  title: '康波周期（约 50–60 年）',
  length: '一轮约 50–60 年，由一组核心技术推动：蒸汽机、铁路、电气、汽车石油、信息技术',
  start: 1985, end: 2050,
  bands: [
    { from: 1985, to: 1991, label: '上一波尾声', kind: 'flat', note: '第四波（汽车、石油、电子）的后期，1980 年代末进入衰退与调整。' },
    { from: 1991, to: 2000, label: '回升', kind: 'up', note: '第五波起点：个人电脑与互联网扩散，通胀回落，美股长牛。' },
    { from: 2000, to: 2008, label: '繁荣', kind: 'peak', note: '全球化、中国入世、信贷与地产扩张，增长最快、泡沫也最大。' },
    { from: 2008, to: 2016, label: '衰退', kind: 'down', note: '金融危机、QE、增长中枢下移；靠货币宽松维持，技术红利递减。' },
    { from: 2016, to: 2030, label: '萧条', kind: 'flat', note: '去杠杆与债务消化；疫情与大放水可能把这个阶段拉长，所以画得宽。' },
    { from: 2030, to: 2040, label: '新一轮回升', kind: 'turn', note: '若 AI、新能源、生物技术等形成新的核心技术簇并带来广泛投资与生产率提升。' },
    { from: 2040, to: 2050, label: '繁荣', kind: 'peak', note: '纯推演，误差极大，仅用来示意下一轮的位置。' },
  ],
  now: { from: 2024, to: 2032, verdict: '萧条后期，向新一轮回升过渡', confidence: '低' },
  reasons: [
    '时间：以 1991 年为第五波起点、一轮约 55 年，则萧条应落在 2020 年代，新一轮回升在 2030 年前后。',
    '技术：互联网红利已充分扩散，AI、机器人、新能源是下一个技术簇的候选，但还没有看到它们推高整体生产率的证据，所以判断为“过渡”而不是“回升”。',
    '债务：全球政府和居民债务占 GDP 处在历史高位，增长靠加杠杆维持，符合萧条期“消化债务”的特征。',
    '全球化倒退：贸易摩擦、产业链重构、地缘冲突，与前几轮萧条期的政治经济特征相似。',
  ],
  counter: [
    '康波只有 4–5 个完整样本，起点和阶段划分在研究者之间有 5–10 年的分歧。',
    '技术扩散可能提前或延后；政策放水（如 2020 年）会让阶段被人为拉长或打断。',
    '它对未来 3–5 年的股价没有指导意义，只用来提醒：长期回报率可能比过去 30 年低。',
  ],
}

export const US_SECULAR: CycleView = {
  id: 'us-secular',
  title: '美股长周期（长牛长熊，约 13–18 年）',
  length: '以十几年为单位的长牛与长熊（或长期横盘）交替',
  start: 1965, end: 2040,
  bands: [
    { from: 1965, to: 1982, label: '长期横盘', kind: 'flat', note: '高通胀、两次石油危机，名义价格几乎不涨。' },
    { from: 1982, to: 2000, label: '长牛', kind: 'up', note: '通胀与利率持续下行，科技与全球化，估值从 8 倍涨到 30 多倍。' },
    { from: 2000, to: 2013, label: '长期横盘', kind: 'flat', note: '互联网泡沫和次贷危机两次腰斩，十几年指数几乎没有净涨幅。' },
    { from: 2013, to: 2032, label: '新长牛（含后段）', kind: 'up', note: '低利率与 QE、平台科技巨头；起点有 2009 与 2013 两种常见划分。' },
  ],
  now: { from: 2026, to: 2032, verdict: '长牛后段：已超过历史长牛的下限，顶部大致落在这个区间', confidence: '低' },
  reasons: [
    '时间：从 2013（或 2009）算起已经 13–17 年，落在历史长牛 13–18 年的后半段。',
    '估值与杠杆：美国保证金债务占 GDP 已高于 2021 年的峰值（见「美国宏观」页），历史上杠杆分位极高时，市场对下跌的缓冲更薄。',
    '集中度：少数科技巨头贡献了大部分涨幅，类似 1999 年前后的结构。',
  ],
  counter: [
    '长牛终点通常需要“估值极端 + 央行转向收紧 + 信用事件”同时出现，目前后两项没有出现。',
    'AI 如果真的带来生产率跃升，盈利增长可以支撑更高估值，把长牛延长。',
    '时间长度没有因果作用，13–18 年只是过去几轮的统计范围。',
  ],
}

export const CN_MID: CycleView = {
  id: 'cn-mid',
  title: 'A 股牛熊周期（约 4–6 年）',
  length: '一轮牛熊约 4–6 年，由政策、流动性和风险偏好推动，波动远大于美股',
  start: 2005, end: 2031,
  bands: [
    { from: 2005.4, to: 2007.8, label: '牛', kind: 'up', note: '股改后的大牛市，上证指数从 1000 点到 6000 点。' },
    { from: 2007.8, to: 2008.9, label: '熊', kind: 'down', note: '金融危机，指数回撤超过 70%。' },
    { from: 2008.9, to: 2013.5, label: '震荡', kind: 'flat', note: '四万亿后的反弹与长期震荡。' },
    { from: 2013.5, to: 2015.5, label: '牛', kind: 'up', note: '杠杆资金推动的牛市，融资余额占 GDP 创历史新高。' },
    { from: 2015.5, to: 2016.1, label: '熊', kind: 'down', note: '去杠杆，三轮快速下跌。' },
    { from: 2016.1, to: 2019.0, label: '结构行情', kind: 'flat', note: '蓝筹慢牛后 2018 年回落。' },
    { from: 2019.0, to: 2021.2, label: '结构牛', kind: 'up', note: '核心资产与新能源，赛道股抱团。' },
    { from: 2021.2, to: 2024.7, label: '下行', kind: 'down', note: '地产下行、需求偏弱、外资流出，估值持续压缩。' },
    { from: 2024.7, to: 2028.0, label: '新一轮上行', kind: 'up', note: '2024 年 9 月政策转向后的修复行情；持续时间是推断，不是事实。' },
  ],
  now: { from: 2025.5, to: 2027.5, verdict: '新一轮上行的中段，距离上一轮牛市顶部的杠杆水平还有空间', confidence: '低' },
  reasons: [
    '节奏：历史上从底部到牛市顶部通常 1.5–3 年，本轮底部在 2024 年，所以大致处于中段。',
    '杠杆：融资余额占 GDP 目前远低于 2015 年的峰值（见「中国宏观」页的历史分位），说明这轮上涨还没有杠杆过热的迹象。',
    '基本面：PPI 转正、PMI 在荣枯线附近，盈利在修复，但内需和 M1 − M2 仍偏弱。',
  ],
  counter: [
    'A 股受政策影响大，一次政策转向就能把周期缩短或拉长。',
    '本轮的“牛熊”划分有事后诸葛的成分，位置判断的置信度低。',
    '融资余额占比低，也可能是监管限制杠杆的结果，而不是投资者仍然谨慎。',
  ],
}

export type InventoryPhase = '主动补库' | '被动补库' | '主动去库' | '被动去库'

/** 库存周期（基钦周期，约 3–4 年）：用 PMI 是否高于荣枯线判断需求，用 PPI 同比是否为正判断价格 */
export function inventoryPhase(pmi: number, ppi: number): { phase: InventoryPhase; text: string } {
  if (pmi >= 50 && ppi >= 0) return { phase: '主动补库', text: '需求回升、价格上行，企业主动加库存，盈利改善最明显的阶段。' }
  if (pmi < 50 && ppi >= 0) return { phase: '被动补库', text: '价格还在涨但需求走弱，库存被动堆积，是周期的后期。' }
  if (pmi < 50 && ppi < 0) return { phase: '主动去库', text: '需求和价格同时走弱，企业主动压缩库存，是最难受的阶段。' }
  return { phase: '被动去库', text: '需求回升但价格还没涨，库存被动消化，通常是周期的起点。' }
}
