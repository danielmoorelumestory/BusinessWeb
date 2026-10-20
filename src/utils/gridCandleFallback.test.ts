import { afterEach, expect, it, vi } from 'vitest'
import { getCandles } from '../../notes-site/src/lib/grid-trading'

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

it.each(['http', 'html'])('历史日线主入口返回%s错误时使用腾讯备用入口并缓存', async failure => {
  localStorage.clear()
  const fetcher = vi.fn(async (url: string) => {
    if (url.startsWith('https://web.ifzq.gtimg.cn/')) return { ok: failure === 'html', json: async () => { throw new Error('HTML拦截页') } }
    return { ok: true, json: async () => ({ data: { sh588800: { day: [['2026-10-19', '1.4', '1.42', '1.43', '1.39', '100'], ['2026-10-20', '1.43', '1.45', '1.46', '1.42', '100']] } } }) }
  })
  vi.stubGlobal('fetch', fetcher)
  const candles = await getCandles('588800', '2026-01-01', { force: true })
  expect(candles).toHaveLength(2)
  expect(candles[1]).toMatchObject({ date: '2026-10-20', close: 1.45 })
  expect(fetcher.mock.calls[1][0]).toContain('https://proxy.finance.qq.com/ifzqgtimg/')
  const cached = await getCandles('588800', '2026-01-01')
  expect(cached).toEqual(candles)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
