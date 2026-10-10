import type { Indicator, ModuleId } from './indicators'

// 中国宏观：国家统计局 / 中国人民银行公布的数据，经东方财富数据中心拉取（scripts/macro-snapshot.mjs）。
// 阈值是经验范围，用来判断“内需和价格是否在修复”，不用于择时。
export type CnKey = 'gdp' | 'pmi' | 'nmpmi' | 'cpi' | 'ppi' | 'ip' | 'm1m2' | 'lpr' | 'marginGdp' | 'marginMcap'

export const CN_MODULES: { id: ModuleId; name: string; question: string }[] = [
  { id: 'cn-growth', name: '增长与景气', question: '经济在扩张还是收缩？' },
  { id: 'cn-price', name: '价格', question: '是通胀还是通缩压力？' },
  { id: 'cn-money', name: '货币与信用', question: '钱有没有流进实体经济？' },
  { id: 'cn-leverage', name: '杠杆与资金', question: 'A 股里的杠杆有多重？' },
]

export const CN_INDICATORS: Indicator<CnKey>[] = [
  { key: 'gdp', name: '实际 GDP 增速（累计同比）', module: 'cn-growth', worse: 'below', yellow: 4.5, red: 3.5, digits: 1, freq: '季度',
    why: '和“5% 左右”的年度目标对照。低于 4.5% 说明托底力度不够。', limit: '季度公布，修正少但信息滞后；结构（消费、投资、出口）比总量更重要。' },
  { key: 'pmi', name: '制造业 PMI', module: 'cn-growth', worse: 'below', yellow: 50, red: 48.5, digits: 1, freq: '月度',
    why: '50 是荣枯线。高于 50 表示制造业在扩张，是最早公布的月度景气数据。', limit: '调查数据，有季节性（春节前后波动大）。' },
  { key: 'nmpmi', name: '非制造业 PMI', module: 'cn-growth', worse: 'below', yellow: 50, red: 48.5, digits: 1, freq: '月度',
    why: '覆盖服务业与建筑业，更贴近内需与就业。', limit: '建筑业受政策与天气影响大，会掩盖服务业变化。' },
  { key: 'ip', name: '工业增加值（同比）', module: 'cn-growth', worse: 'below', yellow: 4.5, red: 3, digits: 1, freq: '月度',
    why: '实际生产活动的硬数据，用来验证 PMI。', limit: '只覆盖规模以上企业。' },
  { key: 'cpi', name: 'CPI（同比）', module: 'cn-price', worse: 'below', yellow: 1, red: 0, digits: 1, freq: '月度',
    why: '中国当前的风险是通缩而不是通胀：CPI 长期低于 1% 说明需求偏弱，企业很难提价。', limit: '猪肉、能源价格波动会让单月读数失真，可配合核心 CPI 看。' },
  { key: 'ppi', name: 'PPI（同比）', module: 'cn-price', worse: 'below', yellow: 0, red: -3, digits: 1, freq: '月度',
    why: '出厂价格决定工业企业利润。PPI 转正通常意味着企业盈利开始修复。', limit: '受国际大宗商品价格驱动，不完全反映国内需求。' },
  { key: 'm1m2', name: 'M1 − M2 剪刀差', module: 'cn-money', worse: 'below', yellow: -2, red: -5, digits: 1, freq: '月度',
    why: 'M1 是企业活期存款，M2 包括定期存款。差值越负，说明钱趴在账上不愿花，企业投资与居民消费意愿弱。', limit: '2025 年起 M1 统计口径调整（纳入个人活期等），前后不完全可比。' },
  { key: 'lpr', name: '1 年期 LPR', module: 'cn-money', digits: 2, freq: '每月 20 日',
    why: '贷款定价基准，反映货币政策方向。', limit: '背景指标，不打分：降息本身既可能是利好，也说明经济需要刺激。' },
  { key: 'marginGdp', name: '融资余额 ÷ GDP', module: 'cn-leverage', crowded: 'high', digits: 2, freq: '每日',
    why: '两市融资余额（券商借给投资者的钱）占经济总量的比例。2015 年 6 月曾冲到 2% 以上，随后爆发去杠杆式下跌。', limit: '分母是滚动一年 GDP，每季度才更新；融资余额只含两融，不含场外配资和收益互换。' },
  { key: 'marginMcap', name: '融资余额 ÷ 流通市值', module: 'cn-leverage', crowded: 'high', digits: 2, freq: '每日',
    why: '换成市值口径看杠杆：行情越热这个比例越容易走高，和上一项对照可以区分“钱借多了”还是“市值涨多了”。', limit: '市值大涨时分母变大会压低比例，高位不一定意味着安全。' },
]
