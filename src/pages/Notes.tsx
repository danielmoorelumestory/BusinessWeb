import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { NOTES, allNoteTags } from '../data/notes'

export default function Notes(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const tags = allNoteTags()
  const active = params.get('tag')
  const shown = [...NOTES].sort((a, b) => b.date.localeCompare(a.date)).filter(n => !active || n.tags.includes(active))

  return (
    <main className="container animate-fade-in">
      <header className="page-head">
        <h1>行业研究笔记</h1>
        <p>行业与方案的深度笔记，按日期倒序。单家公司的研究请看「公司研究」。</p>
      </header>

      <nav className="etf-guide__nav" aria-label="按标签筛选" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 16px' }}>
        <button type="button" className={`tag${active ? '' : ' tag--active'}`} aria-pressed={!active} onClick={() => setParams({})}>全部 {NOTES.length}</button>
        {tags.map(({ tag, count }) => (
          <button key={tag} type="button" className={`tag${active === tag ? ' tag--active' : ''}`} aria-pressed={active === tag} onClick={() => setParams({ tag })}>{tag} {count}</button>
        ))}
      </nav>

      <section className="skill-grid" aria-label="笔记列表">
        {shown.map(n => (
          <article className="skill-card" key={n.slug}>
            <span className="tag">{n.date}</span>
            <h3><Link to={`/notes/${n.slug}`}>{n.title}</Link></h3>
            <p>{n.summary}</p>
            <p className="skill-card__alias">{n.tags.join(' · ')}{n.report ? ' · 含完整报告' : ''}</p>
          </article>
        ))}
        {shown.length === 0 && <p>没有符合的笔记。</p>}
      </section>
    </main>
  )
}
