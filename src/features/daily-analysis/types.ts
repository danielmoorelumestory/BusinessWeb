export interface DailySource {
  id: 'indices' | 'limitUp' | 'brokenUp' | 'limitDown' | 'amountRank' | 'turnoverRank' | 'flows'
  label: string
  url: string
  date: string | null
  status: 'ready' | 'partial' | 'unavailable' | 'undated'
  note: string
}

export interface BoardStock { code: string; name: string; boards: number }
export interface DailyIndex { symbol: string; code: string; name: string; date: string; price: number; change: number }
export interface RankedStock extends DailyIndex { amount: number | null; turnover: number | null }
export interface DailySnapshot {
  schemaVersion: 1
  dataDate: string
  fetchedAt: string
  session: 'intraday' | 'closed' | 'previous'
  metrics: {
    ztCount: number | null; ztOpen: number | null; ztSealRate: number | null
    dtCount: number | null; dtOpen: number | null; dtSealRate: number | null
    volume: number | null; upCount: number | null; downCount: number | null
    lbCount: number | null; maxBoard: number | null; lbRate: number | null
  }
  indices: DailyIndex[]
  upStocks: BoardStock[]
  ladder: Array<{ boards: number; stocks: BoardStock[] }>
  rankings: { amount: RankedStock[]; turnover: RankedStock[] }
  flows: { inflow: Array<{ name: string; amount: number }>; outflow: Array<{ name: string; amount: number }> }
  sources: DailySource[]
}

export interface DailyArchive { schemaVersion: 1; snapshots: DailySnapshot[] }
