import { clsProxy } from '../../services/clsProxy'

export interface BoardStats { lbCount: number; maxBoard: number }
export type BoardBackfill = Record<string, BoardStats>

const CACHE_KEY = 'businessweb.daily-analysis.boards.v1'

/** 财联社涨停分析 → 连板股数与最高板；日期对不上或数据为空一律视为无效。 */
export function parseBoards(body: unknown, date: string): BoardStats | null {
  const data = (body as { code?: unknown; data?: { plate_stock?: unknown; continuous_limit_up?: unknown } } | null)
  if (data?.code !== 200 || !Array.isArray(data.data?.plate_stock) || !Array.isArray(data.data?.continuous_limit_up)) return null
  const times = data.data.plate_stock.flatMap(plate => Array.isArray((plate as { stock_list?: unknown })?.stock_list) ? (plate as { stock_list: Array<{ time?: unknown }> }).stock_list : [])
    .map(stock => String(stock?.time ?? '')).filter(time => /^\d{4}-\d{2}-\d{2}/.test(time))
  if (!times.length || times.some(time => time.slice(0, 10) !== date)) return null
  let maxBoard = 0, lbCount = 0
  for (const level of data.data.continuous_limit_up as Array<{ height?: unknown; stock_list?: unknown }>) {
    if (!Number.isInteger(level?.height) || !Array.isArray(level.stock_list)) return null
    maxBoard = Math.max(maxBoard, level.height as number)
    if ((level.height as number) >= 2) lbCount += level.stock_list.length
  }
  return { lbCount, maxBoard }
}

export function loadBoardCache(): BoardBackfill {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    if (!raw || typeof raw !== 'object') return {}
    return Object.fromEntries(Object.entries(raw).filter(([date, v]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger((v as BoardStats)?.lbCount) && Number.isInteger((v as BoardStats)?.maxBoard)))
  } catch { return {} }
}

export function saveBoardCache(cache: BoardBackfill): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch { /* 缓存失败不影响展示。 */ }
}

export async function fetchBoards(date: string, signal: AbortSignal): Promise<BoardStats | null> {
  const compact = date.replace(/-/g, '')
  const response = await fetch(clsProxy(`https://x/?date=${compact}&up_limit=0`), { signal })
  if (!response.ok) return null
  return parseBoards(await response.json(), date)
}

/** 历史交易日的连板数据不会再变，缓存后只请求缺失日期；并发 3 个，单个失败不影响其他。 */
export async function backfillBoards(dates: string[], cached: BoardBackfill, signal: AbortSignal, onUpdate: (next: BoardBackfill) => void): Promise<void> {
  const result = { ...cached }
  const queue = dates.filter(date => !result[date])
  const worker = async () => {
    for (let date = queue.shift(); date && !signal.aborted; date = queue.shift()) {
      try {
        const stats = await fetchBoards(date, signal)
        if (stats && !signal.aborted) { result[date] = stats; saveBoardCache(result); onUpdate({ ...result }) }
      } catch { /* 该日期暂时无法获取，下次进入页面再试。 */ }
    }
  }
  await Promise.all([worker(), worker(), worker()])
}
