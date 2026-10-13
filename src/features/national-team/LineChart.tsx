import React, { useId, useState } from 'react'
import { shortPeriod } from './format'

export interface LineSeries {
  key: string
  label: string
  values: (number | null)[]
  color: string
}

const W = 720
const H = 280
const PAD = { l: 54, r: 14, t: 14, b: 28 }

/** 多折线图：悬停十字线 + 各序列当期取值；图例可点击显隐。无依赖，颜色取自站点变量。 */
export default function LineChart({ periods, series, format, label }: {
  periods: string[]
  series: LineSeries[]
  format: (v: number) => string
  label: string
}): JSX.Element {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId()
  const shown = series.filter(s => !hidden.has(s.key))
  const all = shown.flatMap(s => s.values).filter((v): v is number => v !== null)
  const lo = all.length ? Math.min(0, ...all) : 0
  const hi = all.length ? Math.max(...all) : 1
  const span = hi - lo || 1
  const last = Math.max(periods.length - 1, 1)
  const x = (i: number) => PAD.l + (i / last) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => lo + span * t)
  const labelEvery = Math.max(1, Math.ceil(periods.length / 8))

  const pathOf = (values: (number | null)[]): string => {
    let d = ''
    let pen = false
    values.forEach((v, i) => {
      if (v === null) { pen = false; return }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = ((e.clientX - box.left) / box.width) * W
    setHover(Math.max(0, Math.min(periods.length - 1, Math.round(((rel - PAD.l) / (W - PAD.l - PAD.r)) * last))))
  }
  const toggle = (key: string): void => setHidden(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  return (
    <figure className="nt-chart">
      <ul className="nt-legend" aria-label="图例，点击显示或隐藏">
        {series.map(s => (
          <li key={s.key}>
            <button type="button" aria-pressed={!hidden.has(s.key)} className={hidden.has(s.key) ? 'is-off' : ''} onClick={() => toggle(s.key)}>
              <i style={{ background: s.color }} aria-hidden="true" />{s.label}
            </button>
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${uid}-t`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <title id={`${uid}-t`}>{label}</title>
        {ticks.map(t => (
          <g key={t}>
            <line className="nt-chart__grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text className="nt-chart__tick" x={PAD.l - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {periods.map((p, i) => (i % labelEvery === 0 || i === periods.length - 1) && (
          <text key={p} className="nt-chart__tick" x={x(i)} y={H - 8} textAnchor="middle">{shortPeriod(p)}</text>
        ))}
        {shown.map(s => <path key={s.key} className="nt-chart__line" d={pathOf(s.values)} stroke={s.color} />)}
        {hover !== null && (
          <g>
            <line className="nt-chart__cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />
            {shown.map(s => s.values[hover] !== null && (
              <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] as number)} r={3.5} fill={s.color} stroke="var(--bg-card)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      <figcaption className="nt-chart__caption" aria-live="polite">
        {hover === null ? '把鼠标移到图上查看各期数值' : (
          <>
            <b>{periods[hover]}</b>
            {shown.map(s => (
              <span key={s.key}><i style={{ background: s.color }} aria-hidden="true" />{s.label} {s.values[hover] === null ? '—' : format(s.values[hover] as number)}</span>
            ))}
          </>
        )}
      </figcaption>
    </figure>
  )
}

/** 表格里的迷你走势 */
export function MiniSpark({ values, label }: { values: number[]; label: string }): JSX.Element | null {
  if (values.length < 2) return null
  const w = 96
  const h = 24
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join('')
  return (
    <svg className="nt-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <path d={d} />
    </svg>
  )
}

export const PALETTE = ['#5B7B65', '#C9794F', '#4A6FA5', '#B0555B', '#7A5C99', '#B8922E', '#3E8E8E', '#8C7B6B', '#6C8E3E', '#A0527C']
