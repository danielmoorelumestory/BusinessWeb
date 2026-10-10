import React from 'react'
import SmartLink from '../components/SmartLink'
import { ArrowRight } from 'lucide-react'
import { INVEST_GROUPS, type HubGroup } from '../data/siteMap'

function GroupLinks({ group }: { group: HubGroup }): JSX.Element {
  return (
    <div className="hub-grid">
      {group.links.map(l => (
        <SmartLink key={l.path} to={l.path} className="hub-card">
          <span className="hub-card__title">{l.label}</span>
          <span className="hub-card__desc">{l.desc}</span>
          <ArrowRight size={16} className="hub-card__arrow" aria-hidden="true" />
        </SmartLink>
      ))}
    </div>
  )
}

export default function InvestHub(): JSX.Element {
  return (
    <main className="container animate-fade-in">
      <header className="page-head">
        <h1>投资</h1>
        <p>不盯盘、不预测的普通人投资方法。先读书定规则，再选标的、用工具执行，最后才看行情。</p>
      </header>

      {INVEST_GROUPS.map(group =>
        group.collapsed ? (
          <details key={group.id} className="hub-group hub-group--fold">
            <summary>{group.title}</summary>
            {group.hint && <p className="hub-group__hint">{group.hint}</p>}
            <GroupLinks group={group} />
          </details>
        ) : (
          <section key={group.id} className={`hub-group hub-group--${group.id}`}>
            <h2>{group.step && <span className="hub-group__step">{group.step}</span>}{group.title}</h2>
            {group.hint && <p className="hub-group__hint">{group.hint}</p>}
            <GroupLinks group={group} />
          </section>
        )
      )}
    </main>
  )
}
