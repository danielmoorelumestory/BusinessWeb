import { afterEach, describe, expect, it, vi } from 'vitest'
import { backfillBoards, parseBoards } from './backfill'

const body = (date: string, levels = [{ height: 9, stock_list: [{}] }, { height: 4, stock_list: [{}, {}] }, { height: 1, stock_list: [{}, {}, {}] }]) => ({
  code: 200, data: { plate_stock: [{ stock_list: [{ time: `${date} 09:25:01` }] }], continuous_limit_up: levels },
})
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

describe('parseBoards', () => {
  it('取最高板，并只统计 2 板及以上的连板股', () => {
    expect(parseBoards(body('2026-10-09'), '2026-10-09')).toEqual({ lbCount: 3, maxBoard: 9 })
  })
  it('日期不匹配、无涨停股或结构异常时返回 null', () => {
    expect(parseBoards(body('2026-10-12'), '2026-10-09')).toBeNull()
    expect(parseBoards({ code: 200, data: { plate_stock: [], continuous_limit_up: [] } }, '2026-10-09')).toBeNull()
    expect(parseBoards({ code: 500 }, '2026-10-09')).toBeNull()
    expect(parseBoards(body('2026-10-09', [{ height: 'x' as unknown as number, stock_list: [] }]), '2026-10-09')).toBeNull()
  })
})

describe('backfillBoards', () => {
  it('只请求未缓存的日期，失败的日期跳过，成功的写入缓存', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const date = new URL(String(url), 'http://x').searchParams.get('date')!
      if (date === '20261008') return new Response('{}', { status: 502 })
      return new Response(JSON.stringify(body(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`)))
    })
    vi.stubGlobal('fetch', fetchImpl)
    const updates = vi.fn()
    await backfillBoards(['2026-10-09', '2026-10-08', '2026-10-07'], { '2026-10-07': { lbCount: 1, maxBoard: 2 } }, new AbortController().signal, updates)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(updates).toHaveBeenLastCalledWith({ '2026-10-07': { lbCount: 1, maxBoard: 2 }, '2026-10-09': { lbCount: 3, maxBoard: 9 } })
    expect(JSON.parse(localStorage.getItem('businessweb.daily-analysis.boards.v1')!)).toHaveProperty('2026-10-09')
  })
})
