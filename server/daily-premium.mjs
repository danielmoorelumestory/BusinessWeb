// 打板溢价：昨日收盘涨停的股票今天相对昨收（即涨停价）的平均涨跌幅，分开盘与收盘两个口径。
// 停牌、未开盘的股票没有成交价，不计入样本；样本不足时不给数字，避免少数股票代表全体。
export const MIN_PREMIUM_COVERAGE = 0.8

const round = value => Math.round(value * 100) / 100
const percent = (price, base) => (price / base - 1) * 100

export const symbolOf = code => /^6/.test(code) ? `sh${code}` : /^[489]/.test(code) ? `bj${code}` : `sz${code}`

/** rows：每只股票的 { open, close, previousClose }；total：昨日涨停总数。 */
export function computePremium(rows, total) {
  const valid = rows.filter(row => row.open > 0 && row.close > 0 && row.previousClose > 0)
  if (!total || !valid.length || valid.length / total < MIN_PREMIUM_COVERAGE) return { open: null, close: null, sample: valid.length, total }
  const average = key => round(valid.reduce((sum, row) => sum + percent(row[key], row.previousClose), 0) / valid.length)
  return { open: average('open'), close: average('close'), sample: valid.length, total }
}
