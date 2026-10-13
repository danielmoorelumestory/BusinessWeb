import { Marked } from 'marked'

export interface BlogHeading {
  id: string
  title: string
  depth: number
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function safeUrl(value: string, baseUrl: string): string | null {
  const trimmed = value.trim()
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('#')) return trimmed
  if (trimmed.startsWith('//') || /[\u0000-\u001f]/.test(trimmed)) return null
  if (trimmed.startsWith('/')) return `${baseUrl.replace(/\/$/, '')}${trimmed}`
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) || trimmed.startsWith('\\')) return null
  return `${baseUrl.replace(/\/$/, '')}/${trimmed.replace(/^\.\//, '')}`
}

export function renderBlogMarkdown(markdown: string, baseUrl: string): { html: string; toc: BlogHeading[] } {
  const toc: BlogHeading[] = []
  const seen = new Map<string, number>()
  const parser = new Marked({ gfm: true, renderer: {
    html({ text }) { return escapeHtml(text) },
    heading({ depth, text, tokens }) {
      const title = text.replace(/<[^>]*>/g, '').replace(/[`*_~]/g, '').trim()
      const stem = title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section'
      const count = (seen.get(stem) || 0) + 1
      seen.set(stem, count)
      const id = count === 1 ? stem : `${stem}-${count}`
      if (depth >= 2 && depth <= 3) toc.push({ id, title, depth })
      return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`
    },
    link({ href, title, tokens }) {
      const safe = safeUrl(href, baseUrl)
      const label = this.parser.parseInline(tokens)
      if (!safe) return label
      const external = /^https?:\/\//i.test(safe)
      return `<a href="${escapeHtml(safe)}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`
    },
    image({ href, title, text }) {
      const safe = safeUrl(href, baseUrl)
      if (!safe) return escapeHtml(text)
      return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy">`
    },
  } })
  return { html: parser.parse(markdown) as string, toc }
}
