import React from 'react'

export interface FlowPoint {
  date: string
  flow_all: number
  flow_broad: number
  index: number | null
}

/** 净流入红绿柱 + 上证指数折线（次坐标），纯内联 SVG，无图表库依赖。 */
export function EtfFlowChart({ series, scope }: { series: FlowPoint[]; scope: 'all' | 'broad' }): JSX.Element | null {
  if (!series.length) return null
  const key = scope === 'all' ? 'flow_all' : 'flow_broad'
  const W = 760, H = 320, padL = 48, padR = 48, padT = 16, padB = 28
  const plotW = W - padL - padR, plotH = H - padT - padB
  const n = series.length

  const flows = series.map(s => s[key])
  const maxAbs = Math.max(1, ...flows.map(v => Math.abs(v)))
  const zeroY = padT + plotH / 2
  const barH = (v: number): number => (v / maxAbs) * (plotH / 2)
  const bw = Math.max(1, Math.min(14, (plotW / n) * 0.6))
  const x = (i: number): number => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)

  const idxVals = series.map(s => s.index).filter((v): v is number => v != null)
  const iMin = idxVals.length ? Math.min(...idxVals) : 0
  const iMax = idxVals.length ? Math.max(...idxVals) : 1
  const iy = (v: number): number => (iMax === iMin ? padT + plotH / 2 : padT + plotH - ((v - iMin) / (iMax - iMin)) * plotH)
  const line = series
    .map((s, i) => (s.index == null ? null : `${x(i).toFixed(1)},${iy(s.index).toFixed(1)}`))
    .filter(Boolean)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="ETF 净流入柱状图，红为净流入、绿为净流出，叠加上证指数折线"
      className="etf-flow__chart">
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="var(--line, #dfe3ea)" />
      {series.map((s, i) => {
        const v = s[key]
        const h = barH(v)
        return (
          <rect key={s.date} x={x(i) - bw / 2} y={v >= 0 ? zeroY - h : zeroY}
            width={bw} height={Math.abs(h)} fill={v >= 0 ? 'var(--up)' : 'var(--down)'}>
            <title>{`${s.date}  ${v >= 0 ? '+' : ''}${v.toFixed(2)} 亿元`}</title>
          </rect>
        )
      })}
      {line && <polyline points={line} fill="none" stroke="var(--idx, #8893a7)" strokeWidth={1.4} />}
    </svg>
  )
}
