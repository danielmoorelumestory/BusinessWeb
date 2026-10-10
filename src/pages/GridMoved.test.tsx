import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

// NOTES_PATH 在模块加载时读取环境变量，所以每个用例都要重新加载模块
async function load(env: string | undefined) {
  vi.resetModules()
  if (env !== undefined) vi.stubEnv('VITE_NOTES_PATH', env)
  return import('./GridMoved')
}
const renderAt = (Component: React.ComponentType, path: string) => render(<MemoryRouter initialEntries={[path]}><Component /></MemoryRouter>)

describe('notesTargetFor：旧路径对应的 notes 页面', () => {
  it('计算器、记录列表、记录详情（保留记录 id）', async () => {
    const { notesTargetFor } = await load('')
    expect(notesTargetFor('/grid-trading')).toBe('lab/grid-trading/')
    expect(notesTargetFor('/grid-trading/')).toBe('lab/grid-trading/')
    expect(notesTargetFor('/grid-trading/records')).toBe('lab/grid-trading/saved/')
    expect(notesTargetFor('/grid-trading/records/')).toBe('lab/grid-trading/saved/')
    expect(notesTargetFor('/grid-trading/records/abc123')).toBe('lab/grid-trading/detail/?id=abc123')
  })

  it('记录 id 里的特殊字符被安全编码，不会拼出额外参数', async () => {
    const { notesTargetFor } = await load('')
    expect(notesTargetFor('/grid-trading/records/a&b=c')).toBe('lab/grid-trading/detail/?id=a%26b%3Dc')
    expect(notesTargetFor('/grid-trading/records/a%20b')).toBe('lab/grid-trading/detail/?id=a%20b')
  })

  it('其他 /grid-trading/ 下的未知路径回到计算器', async () => {
    const { notesTargetFor } = await load('')
    expect(notesTargetFor('/grid-trading/whatever')).toBe('lab/grid-trading/')
  })
})

describe('GridMoved（没有 notes 的构建：Vercel、GitHub Pages）', () => {
  it('显示迁移说明与指向 Cloudflare 站点上计算器的链接，不跳转', async () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    const { default: GridMoved } = await load('')
    renderAt(GridMoved, '/grid-trading')
    expect(screen.getByRole('heading', { name: '网格交易已迁移' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '打开网格交易计算器' }).getAttribute('href')).toBe('https://businessweb-c0u.pages.dev/note/lab/grid-trading/')
    expect(replace).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('记录详情的旧路径也带上记录 id', async () => {
    const { default: GridMoved } = await load('')
    renderAt(GridMoved, '/grid-trading/records/abc123')
    expect(screen.getByRole('link', { name: '打开网格交易计算器' }).getAttribute('href')).toBe('https://businessweb-c0u.pages.dev/note/lab/grid-trading/detail/?id=abc123')
  })
})

describe('GridMoved（Cloudflare 构建：前端兜底跳转）', () => {
  it.each([
    ['/grid-trading', '/note/lab/grid-trading/'],
    ['/grid-trading/records', '/note/lab/grid-trading/saved/'],
    ['/grid-trading/records/abc123', '/note/lab/grid-trading/detail/?id=abc123'],
  ])('%s 跳到 %s', async (from, to) => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    const { default: GridMoved } = await load('/note/')
    renderAt(GridMoved, from)
    expect(replace).toHaveBeenCalledWith(to)
    vi.unstubAllGlobals()
  })
})
