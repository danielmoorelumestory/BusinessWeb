import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import BlogIndex from './BlogIndex'
import type { BlogEntry } from '../features/blog/catalog'

afterEach(cleanup)
const entries: BlogEntry[] = [
  { slug: 'invest', title: '投资规则', summary: '慢慢投资', category: '投资', tags: ['规则'], publishedAt: '2026-10-13', status: 'published', file: 'src/content/blog/posts/invest.md' },
  { slug: 'ai', title: 'AI 工作流', summary: '写代码', category: 'AI', tags: ['工具'], publishedAt: '2026-10-12', status: 'published', file: 'src/content/blog/posts/ai.md' },
]
const renderAt = (url = '/blog', posts = entries) => render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/blog" element={<BlogIndex entries={posts} />} /></Routes></MemoryRouter>)

describe('BlogIndex', () => {
  it('shows published article title, summary and date with a working article link', () => {
    renderAt()
    expect(screen.getByRole('link', { name: /投资规则/ }).getAttribute('href')).toBe('/blog/invest')
    expect(screen.getByText('慢慢投资')).toBeTruthy()
    expect(screen.getByText(/2026.*10.*13/)).toBeTruthy()
  })
  it('restores combined search and category filters from the URL, and can reset no-match state', () => {
    renderAt('/blog?category=AI&q=不存在')
    expect(screen.queryByText('投资规则')).toBeNull()
    expect(screen.getByText(/没有找到/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }))
    expect(screen.getByText('投资规则')).toBeTruthy()
    expect(screen.getByText('AI 工作流')).toBeTruthy()
  })
  it('filters by search and category together', () => {
    renderAt('/blog?category=投资&q=慢慢')
    expect(screen.getByText('投资规则')).toBeTruthy()
    expect(screen.queryByText('AI 工作流')).toBeNull()
  })
  it('points to existing book and AI pages when there are no public posts', () => {
    renderAt('/blog', [])
    expect(screen.getByRole('link', { name: /我的书/ }).getAttribute('href')).toBe('/first-book')
    expect(screen.getByRole('link', { name: /AI 实验室/ }).getAttribute('href')).toBe('/ai')
  })
})
