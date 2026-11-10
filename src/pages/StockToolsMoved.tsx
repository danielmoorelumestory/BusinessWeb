import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 主站自己的板块轮动与涨停分析已经被 notes 的股市分析 lab 取代。旧路径对应的 lab 工具：
//   /sector-rotation        → lab/stock/#sector-rotation（板块轮动）
//   /limit-up-analysis[/*]  → lab/stock/#stock-analysis（大涨股解读）

/** 旧路径对应的 notes 页面（相对于 /note/，不含前导斜杠），以及它的名称 */
export function stockToolTarget(pathname: string): { target: string; name: string } {
  const path = pathname.replace(/\/+$/, '')
  if (path === '/sector-rotation') return { target: 'lab/stock/#sector-rotation', name: '板块轮动' }
  return { target: 'lab/stock/#stock-analysis', name: '大涨股解读' }
}

export default function StockToolsMoved(): JSX.Element {
  const { pathname } = useLocation()
  const { target, name } = stockToolTarget(pathname)

  // Cloudflare 的 _redirects 通常已经在服务端跳转了，这里是前端兜底（本地开发、站内前端导航）
  useEffect(() => {
    window.location.replace(`/note/${target}`)
  }, [target])

  return <div role="status" className="container page-loading">正在跳转到{name}…</div>
}
