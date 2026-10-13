import type { DailySnapshot } from './types'

export const dailySnapshot = (date = '2026-10-12'): DailySnapshot => ({
  schemaVersion: 1, dataDate: date, fetchedAt: `${date}T08:00:00.000Z`, session: 'closed',
  metrics: { ztCount: 69, ztOpen: 14, ztSealRate: 83.1, dtCount: 8, dtOpen: null, dtSealRate: null, volume: 15378.31, upCount: null, downCount: null, lbCount: 13, maxBoard: 9, lbRate: null },
  indices: [{ symbol: 'sh000001', code: '000001', name: '上证指数', date, price: 3797.24, change: -0.43 }],
  upStocks: [{ code: '600825', name: '新华传媒', boards: 9 }],
  ladder: [{ boards: 9, stocks: [{ code: '600825', name: '新华传媒', boards: 9 }] }],
  rankings: { amount: [{ symbol: 'sz300308', code: '300308', name: '中际旭创', date, price: 724.47, change: -6.411, amount: 156.24, turnover: 1.9 }], turnover: [] },
  flows: { inflow: [{ name: '银行', amount: 2 }], outflow: [{ name: '软件', amount: -1 }] },
  sources: [
    { id: 'indices', label: '腾讯指数行情', url: 'https://qt.gtimg.cn/', date, status: 'ready', note: '' },
    { id: 'limitUp', label: '东方财富涨停股池', url: 'https://quote.eastmoney.com/ztb/', date, status: 'ready', note: '' },
    { id: 'brokenUp', label: '东方财富炸板股池', url: 'https://quote.eastmoney.com/ztb/', date, status: 'ready', note: '' },
    { id: 'limitDown', label: '东方财富跌停股池', url: 'https://quote.eastmoney.com/ztb/', date, status: 'ready', note: '' },
    { id: 'amountRank', label: '新浪成交额排名 / 腾讯报价', url: 'https://finance.sina.com.cn/', date, status: 'partial', note: '仅取得 1 只日期匹配的股票' },
    { id: 'turnoverRank', label: '新浪换手率排名 / 腾讯报价', url: 'https://finance.sina.com.cn/', date: null, status: 'unavailable', note: '未取得日期匹配的报价' },
    { id: 'flows', label: '新浪行业资金流', url: 'https://finance.sina.com.cn/', date: null, status: 'undated', note: '源未标注交易日期' },
  ],
})
