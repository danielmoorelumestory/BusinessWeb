export interface GroupStat {
  id: string
  core: boolean
  mv: number
  mvPrev: number | null
  n: number
}

export interface NtMeta {
  checkedAt?: string
  refreshNote?: string
  generatedAt: string
  reportDate: string
  prevReportDate: string | null
  periods: string[]
  numStocks: number
  numIndustries: number
  totalMv: number
  totalMvPrev: number | null
  coverage: number
  groups: GroupStat[]
  groupDefs: { id: string; core: boolean }[]
}

export interface Holder {
  g: string
  h: string
  num: number
  ratio: number
  mv: number
}

export interface StockRow {
  c: string
  n: string
  ind: string
  mv: number
  mvPrev: number | null
  ratio: number
  ratioPrev: number | null
  num: number
  numPrev: number | null
  isNew: boolean
  groups: string[]
  holders: Holder[]
}

export interface IndustryRow {
  name: string
  n: number
  mv: number
  mvPrev: number | null
  ratio: number
  newN: number
}

export interface SeriesCell {
  mv: number[]
  n: number[]
}

export interface NtSeries {
  periods: string[]
  total: SeriesCell
  groups: Record<string, SeriesCell>
  industries: Record<string, SeriesCell>
}

export interface HistoryRow {
  n: string
  ind: string
  mv: number[]
  r: number[]
}

export type NtHistory = Record<string, HistoryRow>

export interface Top10Row {
  rank: number
  holder: string
  num: number
  ratio: number
  mv: number
  group: string
}

export type NtTop10 = Record<string, Top10Row[]>

export interface BriefStock {
  c: string
  n: string
  ind: string
  mv?: number
  mvPrev?: number | null
  num?: number
  numPrev?: number | null
  ratio?: number
  ratioPrev?: number | null
}

export interface ExitedStock {
  c: string
  n: string
  ind: string
  mvPrev: number
  ratioPrev: number
}

export interface NtChanges {
  reportDate: string
  prevReportDate: string | null
  newEntries: BriefStock[]
  exited: ExitedStock[]
  increased: BriefStock[]
  decreased: BriefStock[]
}

export interface EtfHolderRow {
  g: string
  h: string
  shares: number
  ratio: number
}

export interface EtfHistPoint {
  d: string
  shares: number
  ratio: number
  nt: EtfHolderRow[]
}

export interface EtfRow {
  priceDate?: string
  priceCheckedAt?: string
  priceSource?: string
  c: string
  n: string
  theme: string
  price: number | null
  scale: number | null
  status: 'hold' | 'exited'
  latest: { d: string; shares: number; ratio: number }
  prev: { d: string; shares: number; ratio: number } | null
  mv: number | null
  groups: string[]
  hist: EtfHistPoint[]
}

export interface EtfMeta {
  checkedAt?: string
  holderFreshnessNote?: string
  priceAsOf?: string
  generatedAt: string
  universeCount: number
  scanned: number
  numHolding: number
  numExited: number
  totalMv: number
  latestDate: string | null
  dates: string[]
  themes: { theme: string; n: number; mv: number }[]
}

export interface EtfData {
  meta: EtfMeta
  etfs: EtfRow[]
}
