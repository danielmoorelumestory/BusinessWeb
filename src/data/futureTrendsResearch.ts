import index from './futureTrendsResearch.index.json'

export interface ResearchSource { title: string; url: string; status: string }
export interface ResearchScenario {
  name: string; eps: number | null; multiple: number | null; price: number | null
  probability: number | null; assumption: string
}
export interface ResearchSummary {
  id: string; key: string; name: string; code: string; asOf: string
  depth: string; rating: string; headline: string; price: number | null; priceText: string
  priceDate: string; currency: string; ratio: number | null; up: number | null; down: number | null
  threshold: number | null; breakEven: number | null; winRate: string; expected: number | null
  valuationStatus: string; primaryTrend: string; riskGroup: string; core: boolean
  moat: string; concern: string; certainty: string; sources: ResearchSource[]
}
export interface CompanyResearch extends ResearchSummary {
  trends: string[]; period: string; profile: string; segments: string[]; mechanism: string
  drivers: string[]; pros: string[]; cons: string[]; industry: string[]; metrics: string[][]
  growth: string[]; moatAnalysis: string[]; scenarios: ResearchScenario[]; modelNote: string
  secondMethod: string; sensitivity: string[]; probabilityNote: string; discipline: string[]
  falsification: string[]; debate: { perspective: string; stance: string; evidence: string; counter: string }[]
  verdict: string; pitfalls: string[]; missing: string[]; calendar: string[]; prior: string[]
}

export const RESEARCH_ASOF = '2026-10-09'
export const RESEARCH_INDEX = index as ResearchSummary[]
export const RESEARCH_BY_KEY = new Map(RESEARCH_INDEX.map(x => [x.key, x]))
export const RESEARCH_BY_ID = new Map(RESEARCH_INDEX.map(x => [x.id, x]))
export const researchPath = (key: string): string => `/future-trends/company/${encodeURIComponent(RESEARCH_BY_KEY.get(key)?.id ?? key)}`
export const researchForCode = (code: string): ResearchSummary | undefined => {
  const primary = code.split(/\s*[/（]\s*/)[0].trim()
  return RESEARCH_INDEX.find(x => x.code.split(/\s*[/（]\s*/)[0].trim() === primary)
}
export const researchForCompany = (name: string, code: string): ResearchSummary | undefined =>
  RESEARCH_INDEX.find(x => x.name === name) ?? researchForCode(code)
export const researchMoney = (n: number | null | undefined, currency = ''): string =>
  n == null ? '[MISSING]' : `${currency} ${n.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`.trim()
export const researchPercent = (n: number | null | undefined): string => n == null ? '[MISSING]' : `${(n * 100).toFixed(2)}%`
