import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 主站自己的网格交易已经被 notes 的网格交易计算器取代。旧路径对应的 notes 页面：
//   /grid-trading                → lab/grid-trading/
//   /grid-trading/records        → lab/grid-trading/saved/
//   /grid-trading/records/:id    → lab/grid-trading/detail/?id=:id

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

  // Cloudflare 的 _redirects 通常已经在服务端跳转了，这里是前端兜底（本地开发、站内前端导航）
  useEffect(() => {
    window.location.replace(`/note/${target}`)
  }, [target])

  return <div role="status" className="container page-loading">正在跳转到网格交易计算器…</div>
}
