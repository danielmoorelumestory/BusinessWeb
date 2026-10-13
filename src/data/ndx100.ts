// 名单以 Invesco 官方 QQQ 持仓作代理（2026-10-09，2026-10-13核验），并核对 Nasdaq 的 MRNA 纳入公告。
// 101只权益证券、100家公司（GOOG/GOOGL同一发行人）；不是Nasdaq GIW官方权重导出。详情见下方源与边界。
import type { Company } from './companies'

export const NDX_CODES: string[] = [
  'ADBE', 'AMD', 'ABNB', 'ALNY', 'GOOGL', 'GOOG', 'AMZN', 'AEP', 'AMGN', 'ADI',
  'AAPL', 'AMAT', 'APP', 'ARM', 'ASML', 'ALAB', 'ADSK', 'ADP', 'AXON', 'BKR',
  'BKNG', 'AVGO', 'CDNS', 'CTAS', 'CSCO', 'CCEP', 'CMCSA', 'CEG', 'CPRT', 'CRWV',
  'COST', 'CRWD', 'CSX', 'DDOG', 'DXCM', 'FANG', 'DASH', 'EXC', 'FAST', 'FER',
  'FTNT', 'GEHC', 'GILD', 'HONA', 'HON', 'IDXX', 'INTC', 'INTU', 'ISRG', 'KDP',
  'KLAC', 'LRCX', 'LIN', 'LITE', 'MAR', 'MRVL', 'MELI', 'META', 'MCHP', 'MU',
  'MSFT', 'MSTR', 'MDLZ', 'MPWR', 'MNST', 'MRNA', 'NBIS', 'NFLX', 'NVDA', 'NXPI', 'ORLY',
  'ODFL', 'PCAR', 'PLTR', 'PANW', 'PAYX', 'PYPL', 'PDD', 'PEP', 'QCOM', 'REGN',
  'RKLB', 'ROP', 'ROST', 'SNDK', 'STX', 'SHOP', 'SPCX', 'SBUX', 'SNPS', 'TMUS',
  'TTWO', 'TER', 'TSLA', 'TXN', 'TRI', 'VRTX', 'WMT', 'WDC', 'WDAY', 'XEL',
]

export const NDX_ASOF = '名单采用2026-10-09 Invesco官方QQQ持仓代理，2026-10-13核验：101只权益证券、100家公司，GOOG/GOOGL合并为一家；新增MRNA与Nasdaq 10-09生效公告一致。现金、期货等5项已排除；不是Nasdaq GIW官方成分权重导出。各公司最新行情时间另列，财务与旧情景模型保留各自原期间，行情刷新不等于完成重估。'

// checkedAt 只表示查源时间；旧名单日期不可被核验日覆盖。
export const NDX_MEMBERSHIP_CHECK = {
  checkedAt: '2026-10-13',
  snapshotAsOf: '2026-10-09',
  status: 'issuer-holdings-proxy-verified',
  source: 'https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/QQQ/holdings/fund?idType=ticker&interval=monthly&productType=ETF',
  evidence: 'research/data-refresh-2026-10-13/official/qqq-equity-members-2026-10-09.json',
  securityCount: 101,
  companyCount: 100,
  reason: '发行人原始106项中筛选101只权益证券；GOOG/GOOGL合并为一家。Nasdaq公开接口404、GIW全表需登录，故明确使用基金持仓代理。',
  confirmedChanges: [{
    publishedAt: '2026-10-01', effectiveAt: '2026-10-09', added: 'MRNA', removed: 'WBD',
    source: 'https://ir.nasdaq.com/node/111076/pdf',
  }],
} as const

// 纳指100 新增 10 家的基础记录；评级、结论、情景等由 details/ndx.ts 覆盖。
const NEW: [string, string, string][] = [
  ['ALNY', 'Alnylam', '医疗保健'],
  ['ALAB', 'Astera Labs', '信息技术'],
  ['CCEP', '可口可乐欧洲太平洋', '日常消费'],
  ['CRWV', 'CoreWeave', '信息技术'],
  ['FER', 'Ferrovial', '工业'],
  ['HONA', '霍尼韦尔航空航天', '工业'],
  ['MSTR', 'Strategy（MicroStrategy）', '信息技术'],
  ['NBIS', 'Nebius', '信息技术'],
  ['RKLB', 'Rocket Lab', '工业'],
  ['TRI', '汤森路透', '工业'],
]

export const ndxBase: Company[] = NEW.map(([code, name, sector]) => ({
  code, name, market: 'ndx' as const, sector, batch: '纳指100 新增',
  rating: '观察', headline: '待补充', metrics: [], thesis: [], risk: [], next: [], asOf: NDX_ASOF,
}))
