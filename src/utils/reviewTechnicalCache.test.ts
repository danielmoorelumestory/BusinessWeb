import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { calculateReviewTechnical, isTechnicalFresh, technicalRefreshAfter, TECHNICAL_VERSION } from '../../notes-site/src/lib/review-technical'
import { loadReviewTechnical } from '../../notes-site/src/lib/review-technical-client'
import { SYNC_KEY_STORAGE } from '../../notes-site/src/lib/grid-trading'

const candles = Array.from({ length: 120 }, (_, i) => ({ date: new Date(Date.UTC(2026, 5, i + 1)).toISOString().slice(0, 10), close: 10 + Math.sin(i / 4), open: 10, high: 12, low: 8 }))
const entry = (date: string) => ({ version: TECHNICAL_VERSION, record: calculateReviewTechnical(candles)!, updatedAt: Date.parse(date) })
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T08:00:00Z')); localStorage.setItem(SYNC_KEY_STORAGE, 'test-review-key-12345678') })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })

it('交易时段15分钟过期，午休、周末和开盘前复用最近结果', () => {
  expect(new Date(technicalRefreshAfter(Date.parse('2026-10-20T02:07:00Z'))).toISOString()).toBe('2026-10-20T02:00:00.000Z')
  expect(new Date(technicalRefreshAfter(Date.parse('2026-10-20T04:40:00Z'))).toISOString()).toBe('2026-10-20T03:30:00.000Z')
  expect(new Date(technicalRefreshAfter(Date.parse('2026-10-20T01:00:00Z'))).toISOString()).toBe('2026-10-19T07:10:00.000Z')
  expect(new Date(technicalRefreshAfter(Date.parse('2026-10-24T05:00:00Z'))).toISOString()).toBe('2026-10-23T07:10:00.000Z')
  expect(new Date(technicalRefreshAfter(Date.parse('2026-10-26T01:00:00Z'))).toISOString()).toBe('2026-10-23T07:10:00.000Z')
})
it('首次读D1结果，第二次进入直接显示缓存且不发请求', async () => {
  const saved = entry('2026-10-20T07:30:00Z')
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ records: { '588800': saved } }) }))
  vi.stubGlobal('fetch', fetcher)
  const apply = vi.fn()
  await loadReviewTechnical(['588800'], apply)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(apply).toHaveBeenLastCalledWith('588800', saved.record)
  await loadReviewTechnical(['588800'], apply)
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('过期先显示旧值，仅数据库缺失/过期的标的触发后台补算', async () => {
  const old = entry('2026-10-19T08:00:00Z'), current = entry('2026-10-20T07:30:00Z')
  localStorage.setItem('etf-review-technical-v1', JSON.stringify({ '588800': old }))
  const fetcher = vi.fn(async (url: string, options: { method?: string }) => ({ ok: true, json: async () => options.method === 'POST' ? { snapshot: current } : { records: { '588800': old, '159687': current } } }))
  vi.stubGlobal('fetch', fetcher)
  const apply = vi.fn()
  await loadReviewTechnical(['588800', '159687'], apply)
  expect(apply.mock.calls[0]).toEqual(['588800', old.record])
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[1][0]).toContain('code=588800')
  await loadReviewTechnical(['588800', '159687'], apply)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('网络失败保留旧结果，不再从浏览器重拉整段K线；版本变化时缓存失效', async () => {
  const old = entry('2026-10-19T08:00:00Z')
  localStorage.setItem('etf-review-technical-v1', JSON.stringify({ '588800': old }))
  const fetcher = vi.fn(async () => { throw new Error('offline') })
  vi.stubGlobal('fetch', fetcher)
  const apply = vi.fn()
  await expect(loadReviewTechnical(['588800'], apply)).rejects.toThrow('offline')
  expect(apply).toHaveBeenCalledWith('588800', old.record)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(isTechnicalFresh({ ...entry('2026-10-20T07:30:00Z'), version: 0 })).toBe(false)
})
