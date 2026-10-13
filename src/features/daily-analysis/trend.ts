import type { HistoryCandle } from '../../components/pulse/chinaHistory'
import type { BoardBackfill } from './backfill'
import type { DailySnapshot } from './types'

export type TrendSymbol = 'sh000001' | 'sz399001' | 'sz399006'
export type IndexChanges = Record<string, Partial<Record<TrendSymbol, number>>>
export type TrendMetric = 'ztCount' | 'ztSealRate' | 'ztOpen' | 'dtCount' | 'volume' | 'lbCount' | 'maxBoard' | 'lbRate'
export const trendMetrics: TrendMetric[] = ['ztCount', 'ztSealRate', 'ztOpen', 'dtCount', 'volume', 'lbCount', 'maxBoard', 'lbRate']

export interface TrendRow extends Record<TrendMetric, number | null> {
  date: string
  backfilled: boolean
  index: { sh: number | null; sz: number | null; cy: number | null }
  inflow: string[]
  outflow: string[]
  amountTop: RankPick[]
  turnoverTop: RankPick[]
}

/** 成交额 / 换手率前五的单只股票（成交额单位亿元，换手率单位 %）。 */
export interface RankPick { code: string; name: string; value: number; change: number }

const round = (value: number) => Math.round(value * 100) / 100

/** 把日 K 收盘价转成日涨跌幅（%），按日期索引。 */
export function candlesToChanges(candles: HistoryCandle[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (let i = 1; i < candles.length; i++) out[candles[i].date] = round((candles[i].close / candles[i - 1].close - 1) * 100)
  return out
}

function picks(snapshot: DailySnapshot | undefined, key: 'amount' | 'turnover'): RankPick[] {
  return (snapshot?.rankings[key] ?? []).flatMap(stock => stock[key] === null ? [] : [{ code: stock.code, name: stock.name, value: stock[key]!, change: stock.change }])
}

/** 最新在前。有快照用快照；没有快照的日期只填回补的指数涨跌与连板数/最高板，其余留空。 */
export function buildTrend(snapshots: DailySnapshot[], backfill: IndexChanges, days: number, boards: BoardBackfill = {}): TrendRow[] {
  const byDate = new Map(snapshots.map(snapshot => [snapshot.dataDate, snapshot]))
  const dates = [...new Set([...byDate.keys(), ...Object.keys(backfill), ...Object.keys(boards)])].sort((a, b) => b.localeCompare(a)).slice(0, days)
  return dates.map(date => {
    const snapshot = byDate.get(date)
    const change = (symbol: TrendSymbol) => snapshot
      ? snapshot.indices.find(index => index.symbol === symbol)?.change ?? null
      : backfill[date]?.[symbol] ?? null
    const row = { date, backfilled: !snapshot, index: { sh: change('sh000001'), sz: change('sz399001'), cy: change('sz399006') },
      inflow: snapshot?.flows.inflow.slice(0, 2).map(flow => flow.name) ?? [], outflow: snapshot?.flows.outflow.slice(0, 2).map(flow => flow.name) ?? [],
      amountTop: picks(snapshot, 'amount'), turnoverTop: picks(snapshot, 'turnover') }
    const filled = Object.fromEntries(trendMetrics.map(key => [key, snapshot?.metrics[key] ?? null]))
    if (!snapshot) Object.assign(filled, { lbCount: boards[date]?.lbCount ?? null, maxBoard: boards[date]?.maxBoard ?? null })
    return Object.assign(row, filled) as unknown as TrendRow
  })
}

/** 与相邻更早一天的差值；任一侧缺失返回 null。 */
export function deltaOf(rows: TrendRow[], index: number, key: TrendMetric): number | null {
  const current = rows[index]?.[key], previous = rows[index + 1]?.[key]
  return current == null || previous == null ? null : round(current - previous)
}
