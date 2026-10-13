import React from 'react'
import { PageTitle } from './PageTabs'

const cx = (...names: Array<string | false | undefined>): string => names.filter(Boolean).join(' ')

/** 页面根节点：统一 1100 宽（与顶栏、面包屑对齐）并提供唯一的 main；阅读型页面用 reading（760 宽） */
export function Page({ children, variant = 'default', className, title, description }: {
  children: React.ReactNode
  variant?: 'default' | 'reading'
  className?: string
  /** 页面标题（大标题 + 说明） */
  title?: string
  description?: string
}): JSX.Element {
  return (
    <main id="main-content" className={cx('container page', variant === 'reading' && 'page--reading', className)}>
      {title && <PageTitle desc={description}>{title}</PageTitle>}
      {children}
    </main>
  )
}

/** 页顶工具栏：左侧一句说明或数据日期，右侧操作按钮 */
export function PageToolbar({ note, children }: { note?: React.ReactNode; children?: React.ReactNode }): JSX.Element {
  return (
    <div className="page-toolbar">
      {note && <div className="page-toolbar__note">{note}</div>}
      {children}
    </div>
  )
}

export { cx }
