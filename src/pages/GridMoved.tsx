import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { NOTES_PATH } from '../data/notesLinks'

// 主站自己的网格交易已经被 notes 的网格交易计算器取代。旧路径对应的 notes 页面：
//   /grid-trading                → lab/grid-trading/
//   /grid-trading/records        → lab/grid-trading/saved/
//   /grid-trading/records/:id    → lab/grid-trading/detail/?id=:id
const OTHER_BUILDS_ORIGIN = 'https://businessweb-c0u.pages.dev'

/** 旧路径对应的 notes 页面（相对于 /note/，不含前导斜杠） */
export function notesTargetFor(pathname: string): string {
  const path = pathname.replace(/\/+$/, '')
  const detail = path.match(/^\/grid-trading\/records\/([^/]+)$/)
  if (detail) return `lab/grid-trading/detail/?id=${encodeURIComponent(decodeURIComponent(detail[1]))}`
  if (path === '/grid-trading/records') return 'lab/grid-trading/saved/'
  return 'lab/grid-trading/'
}

export default function GridMoved(): JSX.Element {
  const { pathname } = useLocation()
  const target = notesTargetFor(pathname)

  // 有 notes 的构建（Cloudflare）：Cloudflare 的 _redirects 通常已经在服务端跳转了，这里是前端兜底
  useEffect(() => {
    if (NOTES_PATH) window.location.replace(`${NOTES_PATH}${target}`)
  }, [target])

  if (NOTES_PATH) return <div role="status" className="container page-loading">正在跳转到网格交易计算器…</div>

  return (
    <main className="container animate-fade-in">
      <header className="page-head">
        <h1>网格交易已迁移</h1>
        <p>主站自己的网格交易已经由 notes 站点的网格交易计算器取代，这个构建里没有它。</p>
      </header>
      <section className="report-card">
        <p>请在包含 notes 站点的部署上使用网格交易：</p>
        <p><a className="btn-primary" href={`${OTHER_BUILDS_ORIGIN}/note/${target}`}>打开网格交易计算器</a></p>
      </section>
    </main>
  )
}
