import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { NOTES_ORIGIN, NOTES_PATH } from '../data/notesLinks'

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

  // 有 notes 的构建（Cloudflare）：Cloudflare 的 _redirects 通常已经在服务端跳转了，这里是前端兜底
  useEffect(() => {
    if (NOTES_PATH) window.location.replace(`${NOTES_PATH}${target}`)
  }, [target])

  if (NOTES_PATH) return <div role="status" className="container page-loading">正在跳转到{name}…</div>

  return (
    <main className="container animate-fade-in">
      <header className="page-head">
        <h1>{name}已迁移</h1>
        <p>主站自己的板块轮动与涨停分析已经由 notes 站点的股市分析取代，这个构建里没有它。</p>
      </header>
      <section className="report-card">
        <p>请在包含 notes 站点的部署上使用：</p>
        <p><a className="btn-primary" href={`${NOTES_ORIGIN}/note/${target}`}>打开{name}</a></p>
      </section>
    </main>
  )
}
