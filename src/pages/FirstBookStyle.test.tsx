import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import FirstBook from './FirstBook'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('书稿阅读页样式钩子', () => {
  it('章节正文使用 book-reader，翻页区使用 book-pager', async () => {
    vi.stubGlobal('fetch', (async () => ({ ok: true, text: async () => '# 标题\n\n正文一段。' })) as unknown as typeof fetch)
    const { container } = render(
      <MemoryRouter initialEntries={[`/first-book/read/${encodeURIComponent('开篇-美好的愿望.md')}`]}>
        <Routes>
          <Route path="/first-book/read/:file" element={<FirstBook />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('正文一段。')).toBeTruthy())
    expect(container.querySelector('.book-reader')).toBeTruthy()
    expect(container.querySelector('.book-pager')).toBeTruthy()
  })

  it('阅读页左侧有章节目录，当前章高亮，且数据来自书稿章节清单', async () => {
    vi.stubGlobal('fetch', (async () => ({ ok: true, text: async () => '# 标题\n\n正文一段。' })) as unknown as typeof fetch)
    render(
      <MemoryRouter initialEntries={[`/first-book/read/${encodeURIComponent('开篇-美好的愿望.md')}`]}>
        <Routes>
          <Route path="/first-book/read/:file" element={<FirstBook />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('正文一段。')).toBeTruthy())
    const nav = screen.getByRole('navigation', { name: '章节目录' })
    const cur = Array.from(nav.querySelectorAll('a')).find(a => a.getAttribute('aria-current') === 'page')
    expect(cur?.textContent).toContain('美好的愿望')
    // 全书大纲入口在目录顶部
    expect(Array.from(nav.querySelectorAll('a')).some(a => a.textContent?.includes('全书大纲'))).toBe(true)
  })

  it('目录与正文放在同一个两栏布局容器里', async () => {
    vi.stubGlobal('fetch', (async () => ({ ok: true, text: async () => '正文' })) as unknown as typeof fetch)
    const { container } = render(
      <MemoryRouter initialEntries={[`/first-book/read/${encodeURIComponent('开篇-美好的愿望.md')}`]}>
        <Routes>
          <Route path="/first-book/read/:file" element={<FirstBook />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(container.querySelector('.reader-layout')).toBeTruthy())
    const layout = container.querySelector('.reader-layout') as HTMLElement
    expect(layout.querySelector('.chapter-nav')).toBeTruthy()
    expect(layout.querySelector('.reader-main .book-reader')).toBeTruthy()
  })

  it('首次进入（含 StrictMode 双次副作用）不滚动，从目录换章才回到正文顶部', async () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    vi.stubGlobal('fetch', (async () => ({ ok: true, text: async () => '正文' })) as unknown as typeof fetch)
    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={[`/first-book/read/${encodeURIComponent('开篇-美好的愿望.md')}`]}>
          <Routes>
            <Route path="/first-book/read/:file" element={<FirstBook />} />
          </Routes>
        </MemoryRouter>
      </React.StrictMode>
    )
    await waitFor(() => expect(screen.getByText('正文')).toBeTruthy())
    expect(spy).not.toHaveBeenCalled()
    const nav = screen.getByRole('navigation', { name: '章节目录' })
    const outline = Array.from(nav.querySelectorAll('a')).find(a => a.textContent?.includes('全书大纲')) as HTMLElement
    fireEvent.click(outline)
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })
})
