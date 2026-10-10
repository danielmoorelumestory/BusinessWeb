// 纳指100：成分名单取自维基百科「List of NASDAQ-100 companies」（2026-08 更新版，100 个证券条目，GOOGL/GOOG 为同一公司两类股）。
// 其中 90 家已在「标普500」或「美股非标普」有研究页，纳指100 页签直接引用；其余 10 家为本页新增，详情见 details/ndx.ts。
import type { Company } from './companies'

export const NDX_CODES: string[] = [
  'ADBE', 'AMD', 'ABNB', 'ALNY', 'GOOGL', 'GOOG', 'AMZN', 'AEP', 'AMGN', 'ADI',
  'AAPL', 'AMAT', 'APP', 'ARM', 'ASML', 'ALAB', 'ADSK', 'ADP', 'AXON', 'BKR',
  'BKNG', 'AVGO', 'CDNS', 'CTAS', 'CSCO', 'CCEP', 'CMCSA', 'CEG', 'CPRT', 'CRWV',
  'COST', 'CRWD', 'CSX', 'DDOG', 'DXCM', 'FANG', 'DASH', 'EXC', 'FAST', 'FER',
  'FTNT', 'GEHC', 'GILD', 'HONA', 'HON', 'IDXX', 'INTC', 'INTU', 'ISRG', 'KDP',
  'KLAC', 'LRCX', 'LIN', 'LITE', 'MAR', 'MRVL', 'MELI', 'META', 'MCHP', 'MU',
  'MSFT', 'MSTR', 'MDLZ', 'MPWR', 'MNST', 'NBIS', 'NFLX', 'NVDA', 'NXPI', 'ORLY',
  'ODFL', 'PCAR', 'PLTR', 'PANW', 'PAYX', 'PYPL', 'PDD', 'PEP', 'QCOM', 'REGN',
  'RKLB', 'ROP', 'ROST', 'SNDK', 'STX', 'SHOP', 'SPCX', 'SBUX', 'SNPS', 'TMUS',
  'TTWO', 'TER', 'TSLA', 'TXN', 'TRI', 'VRTX', 'WMT', 'WDC', 'WDAY', 'XEL',
]

export const NDX_ASOF = '价格 2026-10-06 美股收盘；财务为公司 2026Q2（或 H1）公告摘要与 aktools 单季财务；成分名单来自维基百科（2026-08 更新），未与纳斯达克官方名单逐项核对。情景价格为研究假设，不是目标价。'

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
