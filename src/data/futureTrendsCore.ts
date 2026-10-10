/** 核心是长期优先研究名单，不是已认证的现价买入组合。 */
import { POOL, PoolItem } from './futureTrendsPool'
import { RESEARCH_INDEX, ResearchSummary } from './futureTrendsResearch'
export interface CoreItem { key: string; chain: string; item: PoolItem; research: ResearchSummary }
export const CORE: CoreItem[] = RESEARCH_INDEX.filter(r => r.core).map(research => {
  const item = POOL.find(x => x.key === research.key)
  if (!item) throw new Error(`核心研究主体不在候选池：${research.key}`)
  return { key: research.key, chain: research.riskGroup, item, research }
})
export const CORE_ENTRIES = CORE
