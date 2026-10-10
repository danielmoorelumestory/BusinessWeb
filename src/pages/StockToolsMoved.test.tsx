import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

// NOTES_PATH 在模块加载时读取环境变量，所以每个用例都要重新加载模块
async function load(env: string | undefined) {
  vi.resetModules()
  if (env !== undefined) vi.stubEnv('VITE_NOTES_PATH', env)
  return import('./StockToolsMoved')
}
const renderAt = (Component: React.ComponentType, path: string) => render(<MemoryRouter initialEntries={[path]}><Component /></MemoryRouter>)

describe('stockToolTarget：旧路径对应的 lab 工具', () => {
  it('板块轮动与涨停分析（含尾斜杠与子路径）', async () => {
    const { stockToolTarget } = await load('')
    expect(stockToolTarget('/sector-rotation')).toEqual({ target: 'lab/stock/#sector-rotation', name: '板块轮动' })
    expect(stockToolTarget('/sector-rotation/')).toEqual({ target: 'lab/stock/#sector-rotation', name: '板块轮动' })
    expect(stockToolTarget('/limit-up-analysis')).toEqual({ target: 'lab/stock/#stock-analysis', name: '大涨股解读' })
    expect(stockToolTarget('/limit-up-analysis/')).toEqual({ target: 'lab/stock/#stock-analysis', name: '大涨股解读' })
    expect(stockToolTarget('/limit-up-analysis/anything')).toEqual({ target: 'lab/stock/#stock-analysis', name: '大涨股解读' })
  })
})

describe('StockToolsMoved（没有 notes 的构建：GitHub Pages）', () => {
  it.each([
    ['/sector-rotation', '板块轮动已迁移', '打开板块轮动', 'https://businessweb-c0u.pages.dev/note/lab/stock/#sector-rotation'],
    ['/limit-up-analysis', '大涨股解读已迁移', '打开大涨股解读', 'https://businessweb-c0u.pages.dev/note/lab/stock/#stock-analysis'],
  ])('%s 显示迁移说明与线上 lab 的链接，不跳转', async (from, heading, linkName, href) => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    const { default: StockToolsMoved } = await load('')
    renderAt(StockToolsMoved, from)
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.getByRole('link', { name: linkName }).getAttribute('href')).toBe(href)
    expect(replace).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('StockToolsMoved（Cloudflare 构建与本地开发：前端兜底跳转）', () => {
  it.each([
    ['/sector-rotation', '/note/lab/stock/#sector-rotation'],
    ['/limit-up-analysis', '/note/lab/stock/#stock-analysis'],
  ])('%s 跳到 %s', async (from, to) => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    const { default: StockToolsMoved } = await load('/note/')
    renderAt(StockToolsMoved, from)
    expect(replace).toHaveBeenCalledWith(to)
    vi.unstubAllGlobals()
  })
})
