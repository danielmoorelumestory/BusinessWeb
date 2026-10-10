import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NoteDetail from './NoteDetail'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path="/notes/:slug" element={<NoteDetail />} /></Routes></MemoryRouter>,
)
const stubFetch = (impl: (url: string) => Promise<Response>) => { const f = vi.fn(impl); vi.stubGlobal('fetch', f); return f }

describe('NoteDetail', () => {
  it('读取并渲染 Markdown：标题、日期、标签、表格与 <br>', async () => {
    const f = stubFetch(async () => new Response('## 小标题\n\n| 列A | 列B |\n| --- | --- |\n| 值1 | 行一<br>行二 |\n'))
    renderAt('/notes/robotics-industry-research')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('机器人行业研究')
    expect(screen.getByText(/2026-09-22/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText('小标题')).toBeTruthy())
    expect(screen.getByRole('columnheader', { name: '列A' })).toBeTruthy()
    expect(document.querySelector('td br')).not.toBeNull()
    expect(f).toHaveBeenCalledWith(expect.stringMatching(/notes\/robotics-industry-research\.md$/))
    expect(screen.queryByRole('link', { name: '打开完整报告' })).toBeNull()
  })

  it('带完整报告的笔记顶部有「打开完整报告」，指向 research 下的 HTML', async () => {
    stubFetch(async () => new Response('正文'))
    renderAt('/notes/etf-grid-trading-master-plan')
    const link = screen.getByRole('link', { name: '打开完整报告' })
    expect(link.getAttribute('href')).toMatch(/research\/etf-grid-master-plan-2026-09-23\.html$/)
    await waitFor(() => expect(screen.getByText('正文')).toBeTruthy())
  })

  it('slug 不存在显示「这一页不存在」，且不请求任何文件', () => {
    const f = stubFetch(async () => new Response('x'))
    renderAt('/notes/does-not-exist')
    expect(screen.getByRole('heading', { name: '这一页不存在' })).toBeTruthy()
    expect(f).not.toHaveBeenCalled()
  })

  it('正文加载失败（404 或网络错误）显示提示，不无限重试', async () => {
    const f = stubFetch(async () => new Response('', { status: 404 }))
    renderAt('/notes/swine-poultry-research')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('加载失败'))
    expect(f).toHaveBeenCalledTimes(1)
    cleanup()
    stubFetch(async () => { throw new Error('offline') })
    renderAt('/notes/swine-poultry-research')
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  })
})
