import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Share2 } from 'lucide-react'
import { Page } from '../components/ui'
import NotFound from './NotFound'
import { findBlogPost, loadBlogMarkdown, publishedPosts, type BlogEntry } from '../features/blog/catalog'
import { renderBlogMarkdown, type BlogHeading } from '../features/blog/markdown'
import '../styles/blog.css'

type Rendered = { html: string; toc: BlogHeading[] }

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

const nextStep: Record<string, { path: string; label: string; description: string }> = {
  '投资': { path: '/first-book', label: '走进《正念投资》', description: '从文章回到一套完整的投资方法。' },
  'AI': { path: '/ai', label: '探索 AI 实验室', description: '看看这些想法如何做成真实的工具。' },
  '生活': { path: '/life', label: '看看自由空间', description: '继续读关于工作与生活的实践。' },
}

export default function BlogArticle({ entries, markdownLoader = loadBlogMarkdown }: { entries?: BlogEntry[]; markdownLoader?: (file: string) => Promise<string> }): JSX.Element {
  const { slug = '' } = useParams()
  const posts = publishedPosts(entries)
  const post = findBlogPost(slug, posts)
  const [body, setBody] = useState<Rendered | null>(null)
  const [error, setError] = useState(false)
  const [shareStatus, setShareStatus] = useState('')

  useEffect(() => {
    if (!post) return
    let active = true
    setBody(null)
    setError(false)
    markdownLoader(post.file).then(markdown => {
      if (active) setBody(renderBlogMarkdown(markdown, import.meta.env.BASE_URL || '/'))
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [post?.file, markdownLoader])

  if (!post) return <NotFound />
  const index = posts.findIndex(item => item.slug === slug)
  const adjacent = [posts[index - 1], posts[index + 1]].filter((item): item is BlogEntry => Boolean(item))
  const related = posts.filter(item => item.slug !== slug && item.category === post.category && !adjacent.some(other => other.slug === item.slug)).slice(0, 2)
  const cta = nextStep[post.category] || nextStep['投资']

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: post!.title, url })
        setShareStatus('分享已打开')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setShareStatus('链接已复制')
      } else {
        const input = document.createElement('textarea')
        input.value = url
        document.body.appendChild(input)
        input.select()
        const copied = document.execCommand?.('copy')
        input.remove()
        setShareStatus(copied ? '链接已复制' : `请复制链接：${url}`)
      }
    } catch {
      setShareStatus(`请复制链接：${url}`)
    }
  }

  const toc = body?.toc || []
  const tocLinks = toc.map(heading => <li key={heading.id} className={heading.depth === 3 ? 'is-subsection' : ''}><a href={`#${heading.id}`}>{heading.title}</a></li>)

  return <Page variant="reading" className="blog-reader">
    <Link to="/blog" className="blog-back"><ArrowLeft size={17} aria-hidden="true" /> 返回博客</Link>
    <header className="blog-article-head">
      <p className="blog-eyebrow">{post.category} / JOURNAL</p>
      <h1>{post.title}</h1>
      <p className="blog-article-head__summary">{post.summary}</p>
      <div className="blog-article-head__meta"><span>发布 <time dateTime={post.publishedAt}>{dateLabel(post.publishedAt)}</time></span>{post.updatedAt && <span>更新 <time dateTime={post.updatedAt}>{dateLabel(post.updatedAt)}</time></span>}</div>
      <div className="blog-article-actions"><button type="button" onClick={share}><Share2 size={17} aria-hidden="true" /> 分享文章</button><span role="status" aria-live="polite">{shareStatus}</span></div>
    </header>
    {toc.length > 0 && <details className="blog-toc-mobile"><summary>文章目录</summary><ol>{tocLinks}</ol></details>}
    <div className="blog-reader__layout">
      <div className="blog-reader__body">
        {error ? <div role="alert">文章暂时无法加载。<Link to="/blog">返回博客</Link></div> : !body ? <p role="status">文章加载中…</p> : <article className="blog-markdown" dangerouslySetInnerHTML={{ __html: body.html }} />}
        <div className="blog-article-cta"><span>下一步 / KEEP READING</span><h2>{cta.description}</h2><Link to={cta.path}>{cta.label} <ArrowRight size={18} aria-hidden="true" /></Link></div>
        <nav className="blog-adjacent" aria-label="前后文章">{adjacent.map(item => <Link key={item.slug} to={`/blog/${item.slug}`}><span>继续阅读</span><strong>{item.title}</strong></Link>)}</nav>
        {related.length > 0 && <section className="blog-related" aria-label="同主题文章"><h2>同主题文章</h2>{related.map(item => <Link key={item.slug} to={`/blog/${item.slug}`}>{item.title} <ArrowRight size={16} aria-hidden="true" /></Link>)}</section>}
      </div>
      {toc.length > 0 && <nav className="blog-toc-desktop" aria-label="文章目录"><span>本文目录</span><ol>{tocLinks}</ol></nav>}
    </div>
  </Page>
}
