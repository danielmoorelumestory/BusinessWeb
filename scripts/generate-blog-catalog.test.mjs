import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { generateBlogCatalog } from './generate-blog-catalog.mjs'

test('generated browser catalog imports only explicitly published articles', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'blog-catalog-'))
  const directory = path.join(root, 'src/content/blog/posts')
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'public.md'), '# public')
  await writeFile(path.join(directory, 'draft.md'), '# secret')
  const entries = [
    { slug: 'public', title: 'Published', summary: 'Summary', category: '投资', tags: [], publishedAt: '2026-10-13', file: 'src/content/blog/posts/public.md', status: 'published' },
    { slug: 'draft', title: 'Draft Secret', summary: 'Unpublished', category: '投资', tags: [], publishedAt: '2026-10-13', file: 'src/content/blog/posts/draft.md', status: 'draft' },
  ]
  await writeFile(path.join(root, 'src/content/blog/manifest.json'), JSON.stringify(entries))
  const output = path.join(root, 'src/features/blog/generated-catalog.ts')
  await generateBlogCatalog({ root, output })
  const code = await readFile(output, 'utf8')
  const metadata = await readFile(path.join(root, 'src/features/blog/generated-manifest.ts'), 'utf8')
  assert.match(code, /import\('\.\.\/\.\.\/content\/blog\/posts\/public\.md\?raw'\)/)
  assert.match(metadata, /Published/)
  assert.doesNotMatch(code, /draft|Draft Secret|Unpublished|secret/i)
  assert.doesNotMatch(metadata, /draft|Draft Secret|Unpublished|secret/i)
})
