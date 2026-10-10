import type { Indicator } from './indicators'

// 港股宏观：香港官方的 GDP、通胀、HIBOR 没有稳定的免费接口（港金管局接口常年 502），
// 所以这里只放能自动拉到的几项：恒指走势、联系汇率压力、美元利率和南向资金。阈值是经验范围，不用于择时。
export type HkKey = 'hsiDd' | 'hsi12m' | 'hkd' | 'fed' | 'south'

export const HK_MODULES: { id: 'hk-market' | 'hk-money'; name: string; question: string }[] = [
  { id: 'hk-market', name: '恒指与情绪', question: '港股处在什么位置、有没有深度回撤？' },
  { id: 'hk-money', name: '汇率与资金', question: '港元有没有承压、谁在买港股？' },
]

export const HK_INDICATORS: Indicator<HkKey>[] = [
  { key: 'hsiDd', name: '恒生指数距十年高点回撤', module: 'hk-market', worse: 'above', yellow: 15, red: 25, digits: 1, freq: '每周',
    why: '回撤越深，说明估值和情绪越悲观，也越接近“用规则分批买入”的区间。2018 年高点至今仍是港股长期套牢盘的位置。', limit: '价格指数，不含分红；十年窗口的高点（2018 年）离现在很远，更适合看位置而不是择时。' },
  { key: 'hsi12m', name: '恒指 12 个月涨跌幅', module: 'hk-market', worse: 'below', yellow: -10, red: -25, digits: 1, freq: '每周',
    why: '看趋势是否持续走弱。连续 12 个月下跌超过 10% 往往伴随外资撤出和流动性收紧。', limit: '受基数影响大：一年前如果是高点，今年的跌幅会被放大。' },
  { key: 'hkd', name: '港元兑美元汇率', module: 'hk-money', worse: 'above', yellow: 7.83, red: 7.849, digits: 4, freq: '每日',
    why: '联系汇率下港元只能在 7.75–7.85 之间波动。贴近 7.85（弱方保证）说明资金在流出港元，金管局会被迫买港元、抽紧银根，对港股流动性是压力。', limit: '汇率只反映资金流向，不等于经济好坏；2022–2023 年多次触及弱方保证，港股当时也确有承压。' },
  { key: 'fed', name: '联邦基金利率', module: 'hk-money', digits: 2, freq: '月度',
    why: '联系汇率下港元利率被动跟随美元利率。美元利率越高，港元流动性越紧，地产和高股息股的估值压力越大。', limit: '背景指标，不打分：降息通常利好港股，但降息本身往往也说明美国经济在走弱。' },
  { key: 'south', name: '南向资金近 20 日净买入', module: 'hk-money', digits: 0, freq: '每日',
    why: '内地资金通过港股通净买入多少。近年南向资金是港股最稳定的增量买盘之一，持续大额净流入说明内地资金在托底。', limit: '背景指标，不打分：净买入也可能是港股便宜，也可能是追涨，需要结合恒指位置一起看。' },
]
