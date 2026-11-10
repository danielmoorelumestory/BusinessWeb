import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StockToolsMoved, { stockToolTarget } from './StockToolsMoved'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const renderAt = (Component: React.ComponentType, path: string) => render(<MemoryRouter initialEntries={[path]}><Component /></MemoryRouter>)

describe('stockToolTarget：旧路径对应的 lab 工具', () => {
  it('板块轮动与涨停分析（含尾斜杠与子路径）', async () => {
    expect(stockToolTarget('/sector-rotation')).toEqual({ target: 'lab/stock/#sector-rotation', name: '板块轮动' })
    expect(stockToolTarget('/sector-rotation/')).toEqual({ target: 'lab/stock/#sector-rotation', name: '板块轮动' })
    expect(stockToolTarget('/limit-up-analysis')).toEqual({ target: 'lab/stock/#stock-analysis', name: '大涨股解读' })
    expect(stockToolTarget('/limit-up-analysis/')).toEqual({ target: 'lab/stock/#stock-analysis', name: '大涨股解读' })
    expect(stockToolTarget('/limit-up-analysis/anything')).toEqual({ target: 'lab/stock/#stock-analysis', name: '大涨股解读' })
  })
})

describe('StockToolsMoved（前端兜底跳转）', () => {
  it.each([
    ['/sector-rotation', '/note/lab/stock/#sector-rotation'],
    ['/limit-up-analysis', '/note/lab/stock/#stock-analysis'],
  ])('%s 跳到 %s', async (from, to) => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    renderAt(StockToolsMoved, from)
    expect(replace).toHaveBeenCalledWith(to)
    vi.unstubAllGlobals()
  })
})
