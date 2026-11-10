import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Marked } from 'marked'
import { Callout, Page } from '../components/ui'
import { usePageSeo } from '../components/RouteSeo'
import { findBloggerView } from '../data/bloggerViews'
import { BLOGGER_VIEWS_NOTICE } from './BloggerViews'
import NotFound from './NotFound'
import '../styles/ai-learning.css'
import '../styles/skill-guide.css'

interface Rendered { html: string; sections: { title: string; id: string }[] }

// 只渲染仓库内审过的整理稿，不接收用户输入。
function renderSummary(markdown: string): Rendered {
  const sections: Rendered['sections'] = []
  const parser = new Marked({ renderer: {
    heading({ depth, text, tokens }) {
      if (depth === 1) return '' // 页面标题由页头提供
      const id = depth === 2 ? `blogger-view-section-${sections.length + 1}` : ''
      if (id) sections.push({ title: text, id })
      return `<h${depth}${id ? ` id="${id}"` : ''}>${this.parser.parseInline(tokens)}</h${depth}>\n`
    },
    link({ href, tokens }) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${this.parser.parseInline(tokens)}</a>`
    },
  } })
  return { html: parser.parse(markdown) as string, sections }
}

export default function BloggerViewDetail(): JSX.Element {
  const { slug } = useParams()
  const view = findBloggerView(slug)
  const rendered = useMemo(() => (view ? renderSummary(view.markdown) : null), [view])
  usePageSeo(view ? `${view.name}｜博主观点整理` : undefined, view?.summary)

  if (!view || !rendered) return <NotFound />

  return (
    <Page variant="reading" className="lab-page learning-page skill-guide-page">
      <Link to="/invest/blogger-views" className="lab-back">← 返回博主观点整理</Link>
      <header className="page-head">
        <h1>{view.name}</h1>
        <p>{view.summary}</p>
        <p>
          {view.platform}号 {view.account} · 覆盖 {view.coverage} · 整理于 {view.updated} ·{' '}
          <a href={view.homepage} target="_blank" rel="noopener noreferrer nofollow">{view.platform}主页</a>
        </p>
      </header>
      <Callout tone="muted">{BLOGGER_VIEWS_NOTICE}</Callout>
      <nav className="skill-guide-toc" aria-label="本页目录">
        <ol>{rendered.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
      </nav>
      <article className="learning-document" aria-label={`${view.name}观点整理`} dangerouslySetInnerHTML={{ __html: rendered.html }} />
    </Page>
  )
}
