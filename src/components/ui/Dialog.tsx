import React, { useEffect, useId, useRef } from 'react'
import { cx } from './Page'

/** 模态对话框：遮罩点击或 Esc 关闭，打开时聚焦对话框、关闭后焦点归还，并锁定背景滚动 */
export function Dialog({ open, onClose, title, icon, children, actions, size = 'md', className }: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}): JSX.Element | null {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // 调用方常传内联箭头函数：放进 ref，避免每次父组件重渲染都重跑焦点逻辑把焦点拉回第一个控件
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button, [href]')
    ;(first ?? panelRef.current)?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="ui-dialog-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} className={cx('ui-dialog', `ui-dialog--${size}`, className)} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId} className="ui-dialog__title">
          {icon && <span className="ui-dialog__icon" aria-hidden="true">{icon}</span>}
          {title}
        </h2>
        <div className="ui-dialog__body">{children}</div>
        {actions && <div className="ui-dialog__actions">{actions}</div>}
      </div>
    </div>
  )
}

/** 表单字段：标签 + 控件 + 可选说明 */
export function Field({ label, hint, children, wide, className }: {
  label: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactElement
  wide?: boolean
  className?: string
}): JSX.Element {
  return (
    <label className={cx('ui-field', wide && 'ui-field--wide', className)}>
      <span className="ui-field__label">{label}</span>
      {children}
      {hint && <span className="ui-field__hint">{hint}</span>}
    </label>
  )
}
