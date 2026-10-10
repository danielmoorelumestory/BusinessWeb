import React, { useState } from 'react'
import { percentileOf } from './indicators'

const W = 640
const H = 150
const PAD = { l: 8, r: 8, t: 14, b: 8 }
const RANGES = [{ id: '5y', label: '5 年', months: 60 }, { id: '10y', label: '10 年', months: 120 }, { id: 'all', label: '全部', months: Infinity }] as const
type RangeId = (typeof RANGES)[number]['id']

/** 长历史图：切换 5 年 / 10 年 / 全部；标出区间内最高点和最低点，并给出当前值的历史分位 */
export default function LongHistoryChart({ points, digits = 1, unit = '', label }: {
  points: [string, number][]
  digits?: number
  unit?: string
  label: string
}): JSX.Element | null {
  const [range, setRange] = useState<RangeId>('10y')
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 24) return null
  const months = RANGES.find(r => r.id === range)!.months
  const shown = Number.isFinite(months) ? points.slice(-months) : points
  const values = shown.map(p => p[1])
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1
  const x = (i: number) => PAD.l + (i / (shown.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b)
  const path = shown.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')
  const last = shown.length - 1
  const maxI = values.indexOf(hi), minI = values.indexOf(lo)
  const cur = hover ?? last
  const fmt = (v: number) => `${v.toFixed(digits)}${unit}`
  const pct = percentileOf(points, shown[cur][1])

  const onMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = ((e.clientX - box.left) / box.width) * W
    setHover(Math.max(0, Math.min(last, Math.round(((rel - PAD.l) / (W - PAD.l - PAD.r)) * last))))
  }
  const anchor = (i: number) => (i < 6 ? 'start' : i > last - 6 ? 'end' : 'middle')

  return (
    <figure className="macro-long">
      <div className="macro-long__bar" role="group" aria-label={`${label}时间范围`}>
        {RANGES.map(r => (
          <button key={r.id} type="button" className={`macro-long__tab${range === r.id ? ' is-on' : ''}`} aria-pressed={range === r.id} onClick={() => { setRange(r.id); setHover(null) }}>{r.label}</button>
        ))}
        <span className="macro-long__pct">{shown[cur][0].slice(0, 7)} · {fmt(shown[cur][1])}{pct !== undefined && ` · 历史分位 ${pct}%`}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}${shown[0][0].slice(0, 4)}年至今走势，区间最高 ${fmt(hi)}（${shown[maxI][0].slice(0, 7)}），最低 ${fmt(lo)}（${shown[minI][0].slice(0, 7)}）`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <path className="macro-spark__line" d={path} />
        {hover !== null && <line className="macro-spark__cross" x1={x(hover)} x2={x(hover)} y1={0} y2={H} />}
        {[maxI, minI].filter((i, n, a) => a.indexOf(i) === n && i !== cur).map(i => (
          <g key={i}>
            <circle className="macro-long__mark" cx={x(i)} cy={y(values[i])} r={3} />
            <text className="macro-long__label" x={x(i)} y={i === maxI ? y(values[i]) - 6 : y(values[i]) + 14} textAnchor={anchor(i)}>{shown[i][0].slice(0, 7)} {fmt(values[i])}</text>
          </g>
        ))}
        <circle className="macro-spark__dot" cx={x(cur)} cy={y(shown[cur][1])} r={4} />
      </svg>
    </figure>
  )
}
