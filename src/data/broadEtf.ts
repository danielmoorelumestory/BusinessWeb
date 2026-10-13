import rawData from './broadEtf.json'
import reductionData from './broadEtfReduction.json'

export type BroadEtfCandidate = {
  code: string
  name: string
  indexName: string
  managementFeePct: number
  custodyFeePct: number
  annualFeePct: number
  aumYi: number
  aumAsOf: string
  turnoverYi: number
  quoteAsOf: string
  sourceUrl: string
}

export type BroadEtf = BroadEtfCandidate & {
  family: string
  category: string
  coverage: string
  reason: string
  selectedAsOf: string
  candidates: BroadEtfCandidate[]
}

export const BROAD_ETFS = rawData as BroadEtf[]
export const BROAD_ETF_REDUCTIONS = reductionData
