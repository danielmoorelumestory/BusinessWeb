import React from 'react'
import { cx } from './Page'

/** 表格外壳：窄屏横向滚动（可用键盘聚焦滚动），stickyFirst 时首列吸附 */
export function TableWrap({ label, stickyFirst, children, className }: {
  label: string
  stickyFirst?: boolean
  children: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <div
      className={cx('ui-table-wrap', stickyFirst && 'ui-table-wrap--sticky', className)}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  )
}
