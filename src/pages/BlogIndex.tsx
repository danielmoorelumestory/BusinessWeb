import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { Page } from '../components/ui'
import { publishedPosts, type BlogEntry } from '../features/blog/catalog'
import '../styles/blog.css'

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export default function BlogIndex({ entries = publishedPosts() }: { entries?: BlogEntry[] }): JSX.Element {
  const [search, setSearch] = useSearchParams()
  const posts = publishedPosts(entries)
  const categories = [...new Set(posts.map(post => post.category))]
  const category = search.get('category') || ''
  const query = search.get('q') || ''
  const filtered = posts.filter(post => (!category || post.category === category) && (!query || [post.title, post.summary, post.category, ...post.tags].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))

  function update(key: 'category' | 'q', value: string) {
    const next = new URLSearchParams(search)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearch(next, { replace: true })
  }

  return <Page className="blog-index">
    <header className="blog-hero">
      <p className="blog-eyebrow">LIVE / JOURNAL</p>
      <div className="blog-hero__layout">
        <div>
          <h1>把思考写下来，<br /><em>把日子过明白。</em></h1>
          <p className="blog-hero__intro">关于投资的耐心、AI 的实践，和通往自由生活的每一步。</p>
        </div>
        <div className="blog-hero__aside"><span>慢一点，走得更远。</span><span className="blog-hero__rule" /></div>
      </div>
    </header>

    {posts.length === 0 ? <section className="blog-empty" aria-label="博客文章">
      <p className="blog-eyebrow">COMING SOON</p>
      <h2>新的文章正在整理中</h2>
      <p>在下一篇文章发布前，可以先读完整的投资方法，或看看正在实践的 AI 项目。</p>
      <div className="blog-empty__links"><Link to="/first-book">读我的书 <ArrowRight size={18} /></Link><Link to="/ai">探索 AI 实验室 <ArrowRight size={18} /></Link></div>
    </section> : <>
      <div className="blog-filterbar">
        <div className="blog-categories" role="group" aria-label="按栏目筛选">
          <button type="button" className={!category ? 'is-active' : ''} aria-pressed={!category} onClick={() => update('category', '')}>全部文章</button>
          {categories.map(item => <button key={item} type="button" className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => update('category', item)}>{item}</button>)}
        </div>
        <label className="blog-search"><Search size={18} aria-hidden="true" /><span className="sr-only">搜索文章</span><input type="search" value={query} onChange={event => update('q', event.target.value)} placeholder="搜索文章" /></label>
      </div>

      {filtered.length === 0 ? <div className="blog-no-match" role="status"><h2>没有找到相关文章</h2><p>换个关键词或栏目再看看。</p><button type="button" onClick={() => setSearch(new URLSearchParams(), { replace: true })}>清空筛选</button></div> : <section className="blog-results" aria-label="文章列表">
        <div className="blog-results__heading"><span>文章 / {String(filtered.length).padStart(2, '0')}</span><span>按发布日期排序</span></div>
        <div className="blog-articles">
          {filtered.map((post, index) => <article key={post.slug} className={`blog-card${index === 0 ? ' blog-card--lead' : ''}`}>
            <div className="blog-card__meta"><span>{post.category}</span><time dateTime={post.publishedAt}>{dateLabel(post.publishedAt)}</time></div>
            <Link to={`/blog/${post.slug}`} className="blog-card__link"><h2>{post.title}</h2><ArrowRight aria-hidden="true" size={24} /></Link>
            <p>{post.summary}</p>
            {post.tags.length > 0 && <div className="blog-card__tags">{post.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>}
          </article>)}
        </div>
      </section>}
    </>}

    <aside className="blog-endnote"><span>继续阅读</span><p>一套慢下来也能向前的投资方法。</p><Link to="/first-book">走进《正念投资》 <ArrowRight size={18} aria-hidden="true" /></Link></aside>
  </Page>
}
