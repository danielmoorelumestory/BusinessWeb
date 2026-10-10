import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { renderMarkdown } from '../components/MarkdownView'
import { usePageSeo } from '../components/RouteSeo'
import { findNote } from '../data/notes'
import NotFound from './NotFound'

export default function NoteDetail(): JSX.Element {
  const { slug } = useParams()
  const note = findNote(slug)
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState(false)
  usePageSeo(note?.title, note?.summary)

  useEffect(() => {
    if (!note) return
    let cancelled = false
    setContent(null); setError(false)
    fetch(`${import.meta.env.BASE_URL}notes/${note.slug}.md`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.text() })
      .then(text => { if (!cancelled) setContent(text) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [note])

  if (!note) return <NotFound />

  return (
    <main className="container animate-fade-in" style={{ maxWidth: 900 }}>
      <Link to="/notes" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <ArrowLeft size={15} /> 全部笔记
      </Link>
      <header className="page-head">
        <h1>{note.title}</h1>
        <p>{note.date} · {note.tags.join(' · ')}</p>
        {note.report && (
          <p><a className="btn-primary" href={`${import.meta.env.BASE_URL}${note.report}`}>打开完整报告</a></p>
        )}
      </header>
      <article className="report-card">
        {!content && !error && <p>加载中……</p>}
        {error && <p role="alert">笔记正文加载失败，请稍后重试。</p>}
        {content && renderMarkdown(content)}
      </article>
    </main>
  )
}
