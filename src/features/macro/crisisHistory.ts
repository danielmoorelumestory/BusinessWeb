// 金额来自美联储公报原表（已核对扫描页），单位为百万美元。
// GDP 为 2026-10-07 读取的 FRED GDP 修订值，单位为十亿美元、季度季调折年。
// 只作事件参照，不拼接到 FINRA 长历史或参与历史分位计算。
type ArchiveSource = { url: string; label: string }
type CustomerCredit = ArchiveSource & {
  kind: 'customer'
  debt: number
  marginCash: number
  cash: number
  gdp: number
  gdpQuarter: string
}
type BrokerBorrowing = ArchiveSource & { kind: 'broker'; borrowing: number }
export interface ArchivedCrisis {
  event: string
  phase: string
  month: string
  archive: CustomerCredit | BrokerBorrowing
}

const source1929 = {
  url: 'https://fraser.stlouisfed.org/files/docs/publications/FRB/1920s/frb_121929.pdf#page=33',
  label: '1929-12 公报 · 第 783 页',
}
const source1987 = {
  url: 'https://fraser.stlouisfed.org/files/docs/publications/FRB/1980s/frb_061988.pdf#page=68',
  label: '1988-06 公报 · 表 1.36（A25）',
}

export const ARCHIVED_US_CRISES: ArchivedCrisis[] = [
  { event: '1929 年大崩盘', phase: '崩盘前一个月 · 历史代理', month: '1929-09',
    archive: { ...source1929, kind: 'broker', borrowing: 8549 } },
  { event: '1929 年大崩盘', phase: '黑色星期四／星期二当月 · 历史代理', month: '1929-10',
    archive: { ...source1929, kind: 'broker', borrowing: 6109 } },
  { event: '1973–1974 年熊市', phase: '高位与下跌启动当月 · NYSE 旧口径', month: '1973-01',
    archive: {
      kind: 'customer', debt: 7975, marginCash: 413, cash: 1883, gdp: 1377.490, gdpQuarter: '1973 Q1',
      url: 'https://fraser.stlouisfed.org/files/docs/publications/FRB/1970s/frb_011974.pdf#page=104',
      label: '1974-01 公报 · A36 页',
    } },
  { event: '1973–1974 年熊市', phase: '熊市低位附近 · NYSE 旧口径', month: '1974-10',
    archive: {
      kind: 'customer', debt: 4080, marginCash: 431, cash: 1419, gdp: 1599.679, gdpQuarter: '1974 Q4',
      url: 'https://fraser.stlouisfed.org/files/docs/publications/FRB/1970s/frb_021975.pdf#page=100',
      label: '1975-02 公报 · A31 页',
    } },
  { event: '1987 年黑色星期一', phase: '1987-10-19 崩盘前一个月 · NYSE 旧口径', month: '1987-09',
    archive: { ...source1987, kind: 'customer', debt: 44170, marginCash: 4270, cash: 15895, gdp: 4884.555, gdpQuarter: '1987 Q3' } },
  { event: '1987 年黑色星期一', phase: '1987-10-19 崩盘当月 · NYSE 旧口径', month: '1987-10',
    archive: { ...source1987, kind: 'customer', debt: 38250, marginCash: 8415, cash: 18455, gdp: 5007.994, gdpQuarter: '1987 Q4' } },
]
