import { z } from 'zod'
import type { DailySnapshot } from './types'
import { canReplaceSnapshot } from './quality.mjs'

const CACHE_KEY = 'businessweb.daily-analysis.snapshots.v1'
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
})
const count = z.number().int().nonnegative().max(100000).nullable()
const amount = z.number().finite().nonnegative().nullable()
const rate = z.number().min(0).max(100).nullable()
const boardStock = z.object({ code: z.string().regex(/^\d{6}$/), name: z.string().max(80), boards: z.number().int().nonnegative().max(1000) })
const index = z.object({ symbol: z.string().regex(/^(sh|sz|bj)\d{6}$/), code: z.string().regex(/^\d{6}$/), name: z.string().max(80), date, price: z.number().positive(), change: z.number().finite() })
const flow = z.object({ name: z.string().max(80), amount: z.number().finite() })
export const snapshotSchema = z.object({
  schemaVersion: z.literal(1), dataDate: date, fetchedAt: z.string().datetime(), session: z.enum(['intraday', 'closed', 'previous']),
  metrics: z.object({ ztCount: count, ztOpen: count, ztSealRate: rate, dtCount: count, dtOpen: count, dtSealRate: rate, volume: amount, upCount: count, downCount: count, lbCount: count, maxBoard: count, lbRate: rate }),
  indices: z.array(index).max(3), upStocks: z.array(boardStock).max(10000),
  ladder: z.array(z.object({ boards: z.number().int().min(2).max(1000), stocks: z.array(boardStock).max(10000) })).max(1000),
  rankings: z.object({ amount: z.array(index.extend({ amount, turnover: amount })).max(5), turnover: z.array(index.extend({ amount, turnover: amount })).max(5) }),
  flows: z.object({ inflow: z.array(flow).max(5), outflow: z.array(flow).max(5) }),
  sources: z.array(z.object({ id: z.enum(['indices', 'limitUp', 'brokenUp', 'limitDown', 'amountRank', 'turnoverRank', 'flows']), label: z.string().max(100), url: z.string().url().startsWith('https://'), date: date.nullable(), status: z.enum(['ready', 'partial', 'unavailable', 'undated']), note: z.string().max(500) })).min(1).max(7),
})

export function mergeSnapshots(...groups: DailySnapshot[][]): DailySnapshot[] {
  const rows = new Map<string, DailySnapshot>()
  for (const snapshot of groups.flat()) {
    const previous = rows.get(snapshot.dataDate)
    if (!previous || canReplaceSnapshot(previous, snapshot)) rows.set(snapshot.dataDate, snapshot)
  }
  return [...rows.values()].sort((a, b) => b.dataDate.localeCompare(a.dataDate)).slice(0, 60)
}

export function loadDailySnapshots(): DailySnapshot[] {
  try {
    const body: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]')
    if (!Array.isArray(body)) return []
    return mergeSnapshots(body.flatMap(row => {
      const parsed = snapshotSchema.safeParse(row)
      return parsed.success ? [parsed.data] : []
    }))
  } catch { return [] }
}

export async function loadDailyAnalysis(signal: AbortSignal): Promise<{ snapshots: DailySnapshot[]; liveError: string | null }> {
  const base = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
  const get = async (url: string, timeout: number): Promise<unknown> => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    const timer = setTimeout(abort, timeout)
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`行情服务 HTTP ${response.status}`)
      return await response.json()
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
  }
  const [live, archive] = await Promise.allSettled([
    get(`${base}/api/daily-analysis`, 18000).then(body => snapshotSchema.parse(body)),
    get(`${import.meta.env.BASE_URL}data/daily-analysis.json`, 8000).then(body => z.object({ schemaVersion: z.literal(1), snapshots: z.array(snapshotSchema).max(60) }).parse(body).snapshots),
  ])
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const snapshots = mergeSnapshots(loadDailySnapshots(), archive.status === 'fulfilled' ? archive.value : [], live.status === 'fulfilled' ? [live.value] : [])
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(snapshots)) } catch { /* 无法缓存不影响已取得的数据。 */ }
  const liveError = live.status === 'rejected'
    ? '最新数据获取失败，继续显示已保存的复盘；请稍后刷新。'
    : live.value.sources.some(source => source.status === 'unavailable' || source.status === 'partial')
      ? '部分行情源暂不可用或数据不完整，已优先保留同日已取得的数据；请查看采集时间并稍后刷新。'
      : null
  return { snapshots, liveError }
}
