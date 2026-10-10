import selection from './futureTrendsSelection.json'
import { ResearchSummary } from './futureTrendsResearch'

export type Priority = 1 | 2 | 3 | 4
export interface Selection { key: string; sector: string; industry: string; priority: Priority; reason: string; watch: string }
export const SELECTION = selection as Selection[]
const entries = new Map(SELECTION.map((x, i) => [x.key, { ...x, rank: i }]))
export const priorityNames: Record<Priority, string> = { 1: '优先候选', 2: '备选', 3: '入围候选', 4: '全部观察' }
export function presentation(r: ResearchSummary): Selection & { rank: number } {
  return entries.get(r.key) ?? { key: r.key, sector: r.primaryTrend, industry: '主营业务待核实', priority: 4, rank: 999,
    reason: r.moat.replace(/^待验证：/, ''), watch: '尚未完成公司级估值，保留观察，完整分析见公司页。' }
}
export const byPriority = (a: ResearchSummary, b: ResearchSummary): number => presentation(a).rank - presentation(b).rank || a.name.localeCompare(b.name, 'zh-CN')
export const displayText = (value: string): string => value.replace(/\[MISSING\]/g, '待核实').replace(/\[STALE\]/g, '历史数据')
const symbols: Record<string, string> = { CNY: '¥', HKD: 'HK$', USD: 'US$', EUR: '€', JPY: 'JP¥', DKK: 'DKK ' }
export function priceLabel(n: number | null, currency: string): string {
  return n === null ? '待补充' : `${symbols[currency] ?? currency}${new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
}
export function percentLabel(n: number | null): string { return n === null ? '待核实' : new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(n) }
export function dateLabel(value: string): string {
  const m = value.match(/(\d{4})[-/](\d{2})[-/](\d{2})(?: (\d{2}):(\d{2}))?/)
  if (!m) return '报价待补充'
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)))
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', month: 'numeric', day: 'numeric', ...(m[4] ? { hour: '2-digit', minute: '2-digit', hour12: false } as const : {}) }).format(date)
}
export function winLabel(r: ResearchSummary): string {
  const m = r.winRate.match(/假设胜率 (\d+%)/)
  return m && r.expected !== null ? `假设胜率 ${m[1]} · 期望 ${percentLabel(r.expected)}` : '胜率待校准'
}
/** 候选池分桶：价格可行（盈亏比≥0.75 且假设期望收益≥20%）=可买卖；已分析但不满足=好公司价格太贵；其余未建模=观察。 */
export type PoolBucket = 'buy' | 'rich' | 'watch'
export function poolBucket(r: ResearchSummary): PoolBucket {
  if (!entries.has(r.key)) return 'watch'
  return r.ratio !== null && r.ratio >= 0.75 && (r.expected ?? 0) >= 0.2 ? 'buy' : 'rich'
}
/** 价格可行但存在硬伤的公司：可买卖不等于无风险。 */
export const CAUTION: Record<string, string> = {
  '中国:002906': '转让价与现价口径冲突',
  '中国:300124': '经营现金流下降',
  '中国:688188': '经营现金流弱于利润',
  '中国:002415': '存货大增、现金流 -40%',
  '海外:BSX': '指引连续下调',
}
