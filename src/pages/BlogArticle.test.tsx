import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BlogArticle from './BlogArticle'
import type { BlogEntry } from '../features/blog/catalog'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const entry = (slug: string, category = '投资', status: BlogEntry['status'] = 'published'): BlogEntry => ({ slug, title: `标题${slug}`, summary: `摘要${slug}`, category, tags: [], publishedAt: slug === 'before' ? '2026-10-12' : slug === 'after' ? '2026-10-14' : '2026-10-13', updatedAt: '2026-10-14', file: `src/content/blog/posts/${slug}.md`, status })
const posts = [entry('before'), entry('current'), entry('after'), entry('draft', '投资', 'draft')]
const markdown = async () => '## 观察\n\n正文\n\n## 观察\n\n| 名称 | 值 |\n| --- | --- |\n| A | 1 |'
const renderAt = (slug: string) => render(<MemoryRouter initialEntries={[`/blog/${slug}`]}><Routes><Route path="/blog/:slug" element={<BlogArticle entries={posts} markdownLoader={markdown} />} /></Routes></MemoryRouter>)

describe('BlogArticle', () => {
  it('renders metadata, body, matching table of contents and adjacent reading links', async () => {
    renderAt('current')
    expect(screen.getByRole('heading', { name: '标题current' })).toBeTruthy()
    expect(screen.getByText('摘要current')).toBeTruthy()
    expect(screen.getByText(/2026.*10.*13/)).toBeTruthy()
    expect(screen.getByText(/2026.*10.*14/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText('正文')).toBeTruthy())
    expect(document.querySelector('#观察-2')).toBeTruthy()
    expect(document.querySelector('a[href="#观察-2"]')).toBeTruthy()
    expect(screen.getByRole('link', { name: /标题before/ }).getAttribute('href')).toBe('/blog/before')
    expect(screen.getByRole('link', { name: /标题after/ }).getAttribute('href')).toBe('/blog/after')
    expect(screen.getByRole('link', { name: /正念投资/ }).getAttribute('href')).toBe('/first-book')
  })
  it('copies the current link and reports success without Web Share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    renderAt('current')
    fireEvent.click(screen.getByRole('button', { name: /分享文章/ }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/链接已复制/))
    expect(writeText).toHaveBeenCalledOnce()
  })
  it('does not display unknown or draft slugs', () => {
    const view = renderAt('unknown')
    expect(screen.getByText('这一页不存在')).toBeTruthy()
    view.unmount()
    renderAt('draft')
    expect(screen.getByText('这一页不存在')).toBeTruthy()
  })
  it('offers an accessible mobile contents toggle', async () => {
    renderAt('current')
    await waitFor(() => expect(screen.getByText('正文')).toBeTruthy())
    expect(screen.getByText('文章目录')).toBeTruthy()
    expect(document.querySelector('.blog-toc-mobile summary')).toBeTruthy()
  })
})
