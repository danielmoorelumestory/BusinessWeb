import { blogMarkdownLoaders } from './generated-catalog'
import { publishedManifest } from './generated-manifest'

export interface BlogEntry {
  slug: string
  title: string
  summary: string
  category: string
  tags: string[]
  publishedAt: string
  updatedAt?: string
  file: string
  sourceFile?: string
  sourceUrl?: string
  status: 'published' | 'draft'
}

const entries = publishedManifest

export function publishedPosts(posts: BlogEntry[] = entries): BlogEntry[] {
  return posts.filter(post => post.status === 'published').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug))
}

export function findBlogPost(slug: string, posts: BlogEntry[] = entries): BlogEntry | undefined {
  return publishedPosts(posts).find(post => post.slug === slug)
}

export async function loadBlogMarkdown(file: string): Promise<string> {
  if (!/^src\/content\/blog\/posts\/[a-z0-9-]+\.md$/.test(file)) throw new Error('Invalid blog article path')
  const loader = blogMarkdownLoaders[file]
  if (!loader) throw new Error('Blog article content is unavailable')
  return String(await loader())
}
