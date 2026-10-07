import type { GridResult, SavedRecord } from './types'
export type ChartPoint = { date: string; value: number }
export function buildChartSeries(_record: SavedRecord, result: GridResult) {
  const keys = ['positionValue', 'capitalUsed', 'pnl', 'current', 'nextBuy', 'nextSell'] as const
  const labels = ['持仓市值', '占用本金', '总盈亏', '当前价格', '下一买价', '下一卖价']
  const colors = ['#6366f1', '#94a3b8', '#10b981', '#f59e0b', '#dc2626', '#1d4ed8']
  return keys.map((key, i) => ({ key, label: labels[i], color: colors[i], priceAxis: i >= 3,
    points: result.series.map(point => ({ date: point.date, value: key === 'nextBuy' || key === 'nextSell' ? result[key] : point[key] })) }))
}
export function nearestChartPoint(points: ChartPoint[], date: string): ChartPoint | null {
  const target = new Date(date).valueOf()
  return points.reduce<ChartPoint | null>((best, point) => !best || Math.abs(new Date(point.date).valueOf() - target) < Math.abs(new Date(best.date).valueOf() - target) ? point : best, null)
}
