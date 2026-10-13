/**
 * 十个赛道的产业链观察池。catalog 同时生成 stock-analysis 的按赛道参考文件。
 * 候选业务关联不代表已验证收入、盈利或股价受益；证据边界逐条列示。
 */
import catalog from './futureTrends.catalog.json'

export const FUTURE_TRENDS_ASOF = catalog.asOf

export interface TrendCompany {
  name: string
  /** 同一发行人的多地上市代码合写；私营主体、子公司和待核状态须明确。 */
  code: string
  role: string
  exposure: string
  evidence: string
  sourceUrl: string
  sourceTitle: string
}

export interface ChainLink {
  link: string
  desc: string
  verify: string
  cn: TrendCompany[]
  /** 海外证券及私营主体，含美股、ADR、欧洲、日本、韩国等市场。 */
  us: TrendCompany[]
}

export interface Trend {
  id: string
  name: string
  oneLine: string
  stage: string
  why: string
  chain: ChainLink[]
  verify: string[]
  risks: string[]
  book: string
}

export const TRENDS: Trend[] = catalog.trends

/** 跨赛道和同赛道多个环节的重复敞口不作为新增公司计数。 */
export function companyIdentity(company: TrendCompany): string {
  const primaryCode = company.code.split('/')[0].trim().split('（')[0].trim()
  return /^(?:\d{6}|\d{4,6}\.[A-Z]+|[A-Z][A-Z0-9.-]*)$/.test(primaryCode)
    ? primaryCode
    : company.name
}

export function trendCoverage(trends: Trend[] = TRENDS): { segments: number; entries: number; companies: number } {
  const chains = trends.flatMap(t => t.chain)
  const companies = chains.flatMap(l => [...l.cn, ...l.us])
  return {
    segments: chains.length,
    entries: companies.length,
    companies: new Set(companies.map(companyIdentity)).size,
  }
}
