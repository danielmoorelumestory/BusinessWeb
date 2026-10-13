import { describe, expect, it } from 'vitest'
import { resolveSeo } from './seo'
import type { BlogEntry } from '../features/blog/catalog'

const post: BlogEntry = { slug: 'slow-investing', title: '慢投资笔记', summary: '关于长期投资的实践', category: '投资', tags: [], publishedAt: '2026-10-13', file: 'src/content/blog/posts/slow-investing.md', status: 'published' }

describe('blog route SEO', () => {
  it('recognizes the blog index', () => {
    expect(resolveSeo('/blog').known).toBe(true)
    expect(resolveSeo('/blog').noindex).toBeFalsy()
  })
  it('uses public article metadata', () => {
    expect(resolveSeo('/blog/slow-investing', [post])).toMatchObject({ known: true, title: '慢投资笔记｜博客', description: '关于长期投资的实践' })
  })
  it('does not index drafts or unknown article paths', () => {
    expect(resolveSeo('/blog/slow-investing', [{ ...post, status: 'draft' }])).toMatchObject({ known: false, noindex: true })
    expect(resolveSeo('/blog/unknown', [post])).toMatchObject({ known: false, noindex: true })
  })
})
