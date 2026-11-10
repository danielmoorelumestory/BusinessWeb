import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GridMoved, { notesTargetFor } from './GridMoved'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const renderAt = (Component: React.ComponentType, path: string) => render(<MemoryRouter initialEntries={[path]}><Component /></MemoryRouter>)

describe('notesTargetFor：旧路径对应的 notes 页面', () => {
  it('计算器、记录列表、记录详情（保留记录 id）', async () => {
    expect(notesTargetFor('/grid-trading')).toBe('lab/grid-trading/')
    expect(notesTargetFor('/grid-trading/')).toBe('lab/grid-trading/')
    expect(notesTargetFor('/grid-trading/records')).toBe('lab/grid-trading/saved/')
    expect(notesTargetFor('/grid-trading/records/')).toBe('lab/grid-trading/saved/')
    expect(notesTargetFor('/grid-trading/records/abc123')).toBe('lab/grid-trading/detail/?id=abc123')
  })

  it('记录 id 里的特殊字符被安全编码，不会拼出额外参数', async () => {
    expect(notesTargetFor('/grid-trading/records/a&b=c')).toBe('lab/grid-trading/detail/?id=a%26b%3Dc')
    expect(notesTargetFor('/grid-trading/records/a%20b')).toBe('lab/grid-trading/detail/?id=a%20b')
  })

  it('其他 /grid-trading/ 下的未知路径回到计算器', async () => {
    expect(notesTargetFor('/grid-trading/whatever')).toBe('lab/grid-trading/')
  })
})

describe('GridMoved（前端兜底跳转）', () => {
  it.each([
    ['/grid-trading', '/note/lab/grid-trading/'],
    ['/grid-trading/records', '/note/lab/grid-trading/saved/'],
    ['/grid-trading/records/abc123', '/note/lab/grid-trading/detail/?id=abc123'],
  ])('%s 跳到 %s', async (from, to) => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    renderAt(GridMoved, from)
    expect(replace).toHaveBeenCalledWith(to)
    vi.unstubAllGlobals()
  })
})
