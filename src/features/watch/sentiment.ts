import type { DailySnapshot } from '../daily-analysis/types'

export type Mood = '偏热' | '中性' | '偏冷' | '数据不足'

/**
 * A 股当日情绪的粗略分档，只描述当天，不是买卖信号。
 * 阈值是经验值：涨跌家数比优先；缺家数时用涨停 / 跌停对比。
 */
export function moodOf(m: DailySnapshot['metrics']): { mood: Mood; reason: string } {
  const { upCount: up, downCount: down, ztCount: zt, dtCount: dt } = m
  if (up !== null && down !== null && up + down > 0) {
    const share = up / (up + down)
    const pct = `${Math.round(share * 100)}%`
    if (share >= 0.7 && (zt ?? 0) >= 60) return { mood: '偏热', reason: `上涨家数占 ${pct}，涨停 ${zt} 家` }
    if (share <= 0.3 || (dt ?? 0) >= 30) return { mood: '偏冷', reason: `上涨家数仅占 ${pct}${dt !== null ? `，跌停 ${dt} 家` : ''}` }
    return { mood: '中性', reason: `上涨家数占 ${pct}` }
  }
  if (zt !== null && dt !== null) {
    if (zt >= 80 && dt <= 10) return { mood: '偏热', reason: `涨停 ${zt} 家、跌停 ${dt} 家` }
    if (dt >= 30 || zt <= dt) return { mood: '偏冷', reason: `涨停 ${zt} 家、跌停 ${dt} 家` }
    return { mood: '中性', reason: `涨停 ${zt} 家、跌停 ${dt} 家` }
  }
  return { mood: '数据不足', reason: '缺少涨跌家数与涨跌停数据' }
}

/** 全球市场看板要展示的品种：按名称从行情接口结果里挑。商品、汇率、美债已在宏观读数里，不重复 */
export const MARKET_GROUPS: Array<{ id: 'us' | 'cn' | 'hk'; title: string; names: string[]; redUp: boolean }> = [
  { id: 'us', title: '美股', names: ['标普500', '纳斯达克', '道琼斯'], redUp: false },
  { id: 'cn', title: 'A股', names: ['上证指数', '沪深300', '深证成指', '创业板指'], redUp: true },
  { id: 'hk', title: '港股', names: ['恒生指数', '恒生科技', '恒生国企'], redUp: true },
]

export interface QuoteRow { symbol: string; name: string; price: number; changePercent: number }
export interface QuoteCache { at: string; rows: QuoteRow[] }
const CACHE_KEY = 'watch-quotes'

/** 每组最后一次成功取到的行情：接口失败时显示它，并标出缓存时间 */
export function readQuoteCache(): Record<string, QuoteCache> {
  try {
    const body: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, QuoteCache> : {}
  } catch { return {} }
}

export function writeQuoteCache(next: Record<string, QuoteCache>): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)) } catch { /* 隐私模式下忽略 */ }
}
