import React from 'react'
import { changeRate, changeTone, formatChange } from './format'

/** 变化率徽标：A 股习惯，增加为红、减少为绿 */
export function Delta({ cur, prev, label }: { cur: number; prev: number | null | undefined; label?: string }): JSX.Element {
  const rate = changeRate(cur, prev)
  const tone = changeTone(rate)
  return <span className={`nt-delta nt-delta--${tone}`} title={label}>{formatChange(rate)}</span>
}

export function GroupTag({ id, core }: { id: string; core?: boolean }): JSX.Element {
  return <span className={core === false ? 'nt-tag nt-tag--ext' : 'nt-tag'}>{id}</span>
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }): JSX.Element {
  return (
    <div className="nt-stat">
      <span className="nt-stat__label">{label}</span>
      <b className="nt-stat__value">{value}</b>
      {sub !== undefined && <span className="nt-stat__sub">{sub}</span>}
    </div>
  )
}
