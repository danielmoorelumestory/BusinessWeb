import React, { useId } from 'react'
import { cx } from './Page'

type Tone = 'info' | 'warn' | 'danger' | 'muted'

/** 统一卡片：可选标题行（图标 + 标题 + 操作）与一句说明 */
export function Card({ title, icon, actions, description, children, as = 'div', flush, className, id, label }: {
  title?: React.ReactNode
  icon?: React.ReactNode
  actions?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  as?: 'div' | 'section' | 'article'
  flush?: boolean
  className?: string
  id?: string
  /** 区域的可访问名称；不传时用标题 */
  label?: string
}): JSX.Element {
  const titleId = useId()
  const Tag = as
  const hasHead = title || actions
  return (
    <Tag
      id={id}
      className={cx('ui-card', flush && 'ui-card--flush', className)}
      aria-label={as !== 'div' ? label : undefined}
      aria-labelledby={as !== 'div' && !label && title ? titleId : undefined}
    >
      {hasHead && (
        <div className="ui-card__head">
          {icon && <span className="ui-card__icon" aria-hidden="true">{icon}</span>}
          {title && <h2 id={titleId} className="ui-card__title">{title}</h2>}
          {actions && <div className="ui-card__actions">{actions}</div>}
        </div>
      )}
      {description && <p className="ui-card__desc">{description}</p>}
      {children}
    </Tag>
  )
}

/** 提示框：info 绿底、warn 暖橙、danger 红、muted 灰（免责声明等） */
export function Callout({ tone = 'info', title, icon, children, className }: {
  tone?: Tone
  title?: React.ReactNode
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <div role="note" className={cx('ui-callout', `ui-callout--${tone}`, className)}>
      {icon && <span className="ui-callout__icon" aria-hidden="true">{icon}</span>}
      <div className="ui-callout__body">
        {title && <div className="ui-callout__title">{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function Stat({ label, value, sub, className }: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={cx('ui-stat', className)}>
      <div className="ui-stat__label">{label}</div>
      <div className="ui-stat__value">{value}</div>
      {sub && <div className="ui-stat__sub">{sub}</div>}
    </div>
  )
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }): JSX.Element {
  return <div className={cx('ui-stat-grid', className)}>{children}</div>
}

export function Badge({ tone = 'neutral', children, className, title }: {
  tone?: 'neutral' | 'accent' | 'warm' | 'up' | 'down' | 'muted'
  children: React.ReactNode
  className?: string
  title?: string
}): JSX.Element {
  return <span className={cx('ui-badge', `ui-badge--${tone}`, className)} title={title}>{children}</span>
}

export function EmptyState({ icon, title, children, action }: {
  icon?: React.ReactNode
  title: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
}): JSX.Element {
  return (
    <div className="ui-empty">
      {icon && <div className="ui-empty__icon" aria-hidden="true">{icon}</div>}
      <p className="ui-empty__title">{title}</p>
      {children && <div className="ui-empty__body">{children}</div>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  )
}
