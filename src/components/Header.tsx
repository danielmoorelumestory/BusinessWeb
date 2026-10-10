import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { NAV_ITEMS, isNavActive } from '../data/siteMap'

function Leaf(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 19c3-4 6-7 10-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function Header(): JSX.Element {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  // 路由变化时关闭抽屉
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // 抽屉打开时锁定背景滚动，Esc 关闭
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = ''
      return
    }
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    // 旋转屏幕或拉宽窗口越过桌面断点时，抽屉已被 CSS 隐藏，要同步关闭并解除滚动锁
    const mql = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 768px)') : null
    const onWide = (e: { matches: boolean }) => {
      if (e.matches) setOpen(false)
    }
    mql?.addEventListener('change', onWide)
    return () => {
      document.removeEventListener('keydown', onKey)
      mql?.removeEventListener('change', onWide)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className="site-header">
      <div className="site-header__bar">
        <Link to="/" className="site-brand" onClick={() => setOpen(false)}>
          <Leaf />
          <span className="site-brand__name">Live</span>
        </Link>

        <nav className="site-nav" aria-label="主导航">
          {NAV_ITEMS.map(item => {
            const active = isNavActive(item.path, pathname)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={active ? 'site-nav__link is-active' : 'site-nav__link'}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <button
          type="button"
          className="site-menu-btn"
          aria-label={open ? '关闭菜单' : '打开菜单'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <nav className="site-drawer" aria-label="移动导航">
          {NAV_ITEMS.map(item => {
            const active = isNavActive(item.path, pathname)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={active ? 'site-drawer__link is-active' : 'site-drawer__link'}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
