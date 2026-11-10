import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Callout, Page } from '../components/ui'
import { BLOGGER_VIEWS } from '../data/bloggerViews'

export const BLOGGER_VIEWS_NOTICE = '这里整理的是别人公开视频里的说法，不是本站的方法。他们讲的多是短线和盘口，需要盯盘，和书里「不盯盘、不预测」的做法不同；其中的身份、数字和战绩都没有核实。仅作了解，不构成投资建议。'

export default function BloggerViews(): JSX.Element {
  return (
    <Page className="blogger-views-page">
      <header className="page-head">
        <h1>博主观点整理</h1>
        <p>把财经博主的公开视频逐条转成文字，再按主题整理成一页：他讲了什么、给了哪些具体规则、哪些地方前后不一致或无法核实。</p>
      </header>
      <Callout tone="muted">{BLOGGER_VIEWS_NOTICE}</Callout>
      <div className="hub-grid" style={{ marginTop: 24 }}>
        {BLOGGER_VIEWS.map(view => (
          <Link key={view.slug} to={`/invest/blogger-views/${view.slug}`} className="hub-card">
            <span className="hub-card__title">{view.name}</span>
            <span className="hub-card__desc">{view.summary}</span>
            <span className="hub-card__desc">{view.platform}号 {view.account} · 覆盖 {view.coverage}</span>
            <ArrowRight size={16} className="hub-card__arrow" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </Page>
  )
}
