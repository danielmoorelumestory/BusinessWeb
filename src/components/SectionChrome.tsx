import React, { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { findInvestEntry } from '../data/siteMap'
import SmartLink from './SmartLink'

export default function SectionChrome(): JSX.Element | null {
  const { pathname } = useLocation()
  const entry = findInvestEntry(pathname)
  const currentRef = useRef<HTMLAnchorElement | null>(null)

  // 手机上切换条横向滚动，让当前项自动进入可视区
  useEffect(() => {
    currentRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [pathname])

  if (!entry) return null
  const { group, link } = entry

  return (
    <div className="section-chrome">
      <nav className="breadcrumb" aria-label="面包屑">
        <Link to="/">Live</Link>
        <span aria-hidden="true">›</span>
        <Link to="/invest">投资</Link>
        <span aria-hidden="true">›</span>
        <span className="breadcrumb__current">{link.label}</span>
      </nav>
      {link.archived && <p className="section-archived" role="note">{link.archived}</p>}
      {group.links.length > 1 && (
        <nav className="section-tabs" aria-label="同组页面">
          {group.links.map(l => {
            const active = l.path === link.path
            return (
              <SmartLink
                key={l.path}
                to={l.path}
                ref={active ? currentRef : undefined}
                className={active ? 'section-tabs__link is-active' : 'section-tabs__link'}
                aria-current={active ? 'page' : undefined}
              >
                {l.label}
              </SmartLink>
            )
          })}
        </nav>
      )}
    </div>
  )
}
