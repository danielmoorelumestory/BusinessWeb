import { afterEach, expect, it, vi } from 'vitest'
import { fetchQuotes } from '../../notes-site/src/lib/grid-trading'

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

it('仅解析 ETF 折溢价，保留零值并排除空值和股票字段', async () => {
  sessionStorage.clear()
  const response = (code: string, type: string, premium: string, nav: string) => {
    const fields = Array<string>(88).fill('')
    Object.assign(fields, { 1: 'ETF', 3: '0.513', 30: '20261019161458', 32: code === '513180' ? '-0.19' : code === '510300' ? '0' : code === '510500' ? '' : '0.49', 33: '0.514', 34: '0.510', 61: type, 77: premium, 78: nav })
    return `v_sh${code}="${fields.join('~')}";`
  }
  const body = response('513180', 'ETF', '-0.14', '0.5137') + response('510300', 'ETF', '0', '0.513') + response('510500', 'ETF', '', '0.513') + response('600989', 'GP-A', '3', '20')
  vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new TextEncoder().encode(body).buffer })))
  const quotes = await fetchQuotes(['513180', '510300', '510500', '600989'])
  expect(quotes.get('513180')?.changePercent).toBe(-0.19)
  expect(quotes.get('510300')?.changePercent).toBe(0)
  expect(quotes.get('510500')?.changePercent).toBeUndefined()
  expect(quotes.get('600989')?.changePercent).toBe(0.49)
  expect(quotes.get('513180')?.premiumRate).toBe(-0.14)
  expect(quotes.get('513180')?.referenceNav).toBe(0.5137)
  expect(quotes.get('510300')?.premiumRate).toBe(0)
  expect(quotes.get('510500')?.premiumRate).toBeUndefined()
  expect(quotes.get('600989')?.premiumRate).toBeUndefined()
})
