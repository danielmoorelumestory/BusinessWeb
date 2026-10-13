import { describe, expect, it } from 'vitest'
import { findBlogPost, publishedPosts, type BlogEntry } from './catalog'

const post = (slug: string, publishedAt: string, status: BlogEntry['status'] = 'published'): BlogEntry => ({ slug, title: `标题 ${slug}`, summary: '摘要', category: '投资', tags: [], publishedAt, file: `src/content/blog/posts/${slug}.md`, status })

describe('blog catalog', () => {
  it('orders public posts newest first and excludes drafts', () => {
    const entries = [post('old', '2026-01-01'), post('draft', '2026-12-01', 'draft'), post('new', '2026-10-13')]
    expect(publishedPosts(entries).map(p => p.slug)).toEqual(['new', 'old'])
    expect(entries[0].slug).toBe('old')
  })
  it('does not find an unknown or unpublished article', () => {
    expect(findBlogPost('unknown')).toBeUndefined()
    expect(findBlogPost('draft')).toBeUndefined()
  })
})
