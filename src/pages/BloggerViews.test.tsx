import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import BloggerViews from './BloggerViews'
import BloggerViewDetail from './BloggerViewDetail'
import { BLOGGER_VIEWS } from '../data/bloggerViews'
import { resolveSeo } from '../utils/seo'

afterEach(cleanup)

const renderDetail = (slug: string) => render(
  <MemoryRouter initialEntries={[`/invest/blogger-views/${slug}`]}>
    <Routes><Route path="/invest/blogger-views/:slug" element={<BloggerViewDetail />} /></Routes>
  </MemoryRouter>,
)

describe('博主观点整理', () => {
  it('列表页列出每位博主并链接到各自的详情页，带「不是本站方法」的说明', () => {
    render(<MemoryRouter><BloggerViews /></MemoryRouter>)
    expect(screen.getByRole('note').textContent).toContain('不是本站的方法')
    for (const view of BLOGGER_VIEWS) {
      expect(screen.getByRole('link', { name: new RegExp(view.name.replace(/[()（）]/g, '.')) }).getAttribute('href')).toBe(`/invest/blogger-views/${view.slug}`)
    }
  })

  it.each(BLOGGER_VIEWS.map(view => [view.slug, view] as const))('详情页 %s 渲染正文、目录和说明', (slug, view) => {
    renderDetail(slug)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(view.name)
    expect(screen.getByRole('note').textContent).toContain('不构成投资建议')
    const toc = screen.getByRole('navigation', { name: '本页目录' })
    expect(toc.querySelectorAll('a').length).toBeGreaterThan(2)
    for (const a of toc.querySelectorAll('a')) expect(document.querySelector(a.getAttribute('href')!)).not.toBeNull()
    // 每条技术思路都标了出处：正文里有指向具体视频的链接，且在新窗口打开
    const videoLinks = document.querySelectorAll('article a[href^="https://www.douyin.com/video/"]')
    expect(videoLinks.length).toBeGreaterThan(50)
    expect(videoLinks[0].getAttribute('target')).toBe('_blank')
    // 正文里不出现只在整理者电脑上才有意义的路径
    expect(document.querySelector('article')!.textContent).not.toMatch(/transcripts\/|videos\/|\/Users\//)
  })

  it('slug 互不重复，正文都以一级标题开头', () => {
    expect(new Set(BLOGGER_VIEWS.map(v => v.slug)).size).toBe(BLOGGER_VIEWS.length)
    for (const view of BLOGGER_VIEWS) expect(view.markdown.startsWith('# '), view.slug).toBe(true)
  })

  it('未登记的 slug 显示 404', () => {
    renderDetail('no-such-blogger')
    expect(screen.queryByRole('navigation', { name: '本页目录' })).toBeNull()
  })

  it('列表页和详情页都不让搜索引擎收录', () => {
    expect(resolveSeo('/invest/blogger-views').noindex).toBe(true)
    expect(resolveSeo('/invest/blogger-views/xinfa-sidao').noindex).toBe(true)
  })
})
