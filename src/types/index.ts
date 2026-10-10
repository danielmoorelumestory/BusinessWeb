export type ExampleData = {
  message: string
}

// 投资标的数据类型
export type InvestmentTarget = {
  symbol: string
  name: string
  currentPrice: number
  targetPrice2026: number
  currentPE: number | null
  forwardPE: number | null
  priceToSales: number | null
  investmentTargetPrice: number
  description?: string
  category: 'stock' | 'commodity'
}

export type StockQuote = {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume?: number
  market?: string
  rsi?: number // RSI 指数
}

export type MarketData = {
  usStocks: StockQuote[]
  chinaIndices: StockQuote[]
  hkIndices: StockQuote[]
  commodities?: StockQuote[]
  forex?: StockQuote[]
  timestamp: string
}

// 复盘数据类型
export type DailyReview = {
  date: string           // 日期 YYYY-MM-DD
  weekday: string        // 周几
  ztCount: number        // 涨停板数
  ztSealRate: string     // 涨停封板率
  ztOpen: number         // 涨停打开数
  dtCount: number        // 跌停板数
  dtSealRate: string     // 跌停封板率
  dtOpen: number         // 跌停打开数
  volume: number         // 量能（亿）
  upDown: string         // 涨-跌
  shszcy: string         // 沪深创
  lbRate: string         // 连板晋级率
  lbCount: number        // 连板数量
  maxBoard: number       // 最高板
  top5Amount: number     // 成交金额前五
  top5Turnover: number   // 换手率前五
  inflow: string         // 流入板块
  outflow: string        // 流出板块
  updatedAt?: string     // 最后修改时间（ISO），云同步用于判定新旧
}

// 重要消息类型
export type ImportantNews = {
  id: string
  date: string           // 日期 YYYY-MM-DD
  title: string          // 消息标题
  impact: 'high' | 'medium' | 'low'  // 影响程度
  category: string       // 分类：美联储/经济数据/地缘政治/财报/其他
  source?: string        // 来源
  link?: string          // 链接
  notes?: string         // 备注
}

// 消息源类型
export type NewsSource = {
  id: string
  name: string           // 消息源名称
  url: string            // 网址
  category: 'official' | 'news' | 'data' | 'social' | 'other'  // 分类
  priority: 'high' | 'medium' | 'low'  // 优先级
  description?: string   // 描述
  icon?: string          // 图标
  enabled: boolean       // 是否启用
}

// 市场分类
export type MarketCategory = {
  key: string
  title: string
  icon: string | React.ReactNode
  color: string
  bgColor: string
  data: StockQuote[]
}

// 板块/主题数据类型
export type SectorData = {
  code: string        // 板块代码
  name: string        // 板块名称
  price: number       // 最新价
  change: number      // 涨跌额
  changePercent: number  // 涨跌幅
  volume: number      // 成交量
  amount: number      // 成交额（万元）
  stockCount: number  // 成分股数量
  upCount: number     // 上涨家数
  downCount: number   // 下跌家数
  rsi?: number        // RSI 指数
}

// 板块分类
export type SectorCategory = {
  type: 'industry' | 'concept'  // 行业板块 | 概念板块
  title: string
  icon: string | React.ReactNode
  color: string
  bgColor: string
  data: SectorData[]
}

