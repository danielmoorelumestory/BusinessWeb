import React, { useEffect, useRef, useState } from 'react'
import { clampWindow, extent, pointerToIndex } from './chart-geometry'

export interface FlowPoint {
  date: string
  flow_all: number
  flow_broad: number | null
  index: number | null
}

const W = 760, H = 300, padL = 54, padR = 58, padT = 14, padB = 24
const plotW = W - padL - padR, plotH = H - padT - padB
const OVH = 50, oPadT = 8, oPadB = 14, oPlotH = OVH - oPadT - oPadB
const fmt1 = (v: number): string => (v >= 0 ? '+' : '') + v.toFixed(2)

type Drag = 'lo' | 'hi' | 'pan'

/** 净流入红绿柱 + 上证指数折线，带十字光标 tooltip 与底部范围滑块。纯内联 SVG，无图表库。 */
export function EtfFlowChart({ series, scope }: { series: FlowPoint[]; scope: 'all' | 'broad' }): JSX.Element | null {
  const key = scope === 'all' ? 'flow_all' : 'flow_broad'
  const label = scope === 'all' ? '全A' : '宽基'
  const n = series.length

  const [win, setWin] = useState<[number, number]>([0, Math.max(0, n - 1)])
  const [hover, setHover] = useState<number | null>(null)
  const [hoverY, setHoverY] = useState<number | null>(null)
  const mainRef = useRef<SVGSVGElement>(null)
  const ovRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const panRef = useRef<{ x: number; win: [number, number] }>({ x: 0, win: [0, 0] })

  // 序列（口径/数据）变化时重置窗口
  useEffect(() => { setWin([0, Math.max(0, n - 1)]); setHover(null) }, [n])

  if (!n) return null
  const [s, e] = clampWindow(win[0], win[1], n)
  const view = series.slice(s, e + 1)
  const m = view.length

  // —— 主图几何（可见窗口） ——
  const flows = view.map(p => p[key] ?? 0)
  const maxAbs = Math.max(1, ...flows.map(Math.abs))
  const zeroY = padT + plotH / 2
  const barH = (v: number): number => (v / maxAbs) * (plotH / 2)
  const bw = Math.max(0.6, Math.min(10, (plotW / m) * 0.68))
  const xAt = (i: number): number => padL + (m <= 1 ? plotW / 2 : (i / (m - 1)) * plotW)

  const idxVals = view.map(p => p.index).filter((v): v is number => v != null)
  const [iMin, iMax] = idxVals.length ? extent(idxVals) : [0, 1]
  const iy = (v: number): number => (iMax === iMin ? zeroY : padT + plotH - ((v - iMin) / (iMax - iMin)) * plotH)
  const idxLine = view
    .map((p, i) => (p.index == null ? null : `${xAt(i).toFixed(1)},${iy(p.index).toFixed(1)}`))
    .filter(Boolean)
    .join(' ')

  // —— 十字光标（竖线定位到最近柱，横线跟随指针 y）——
  const onMainMove = (ev: React.PointerEvent<SVGSVGElement>): void => {
    if (drag.current || !mainRef.current) return
    const rect = mainRef.current.getBoundingClientRect()
    setHover(pointerToIndex(ev.clientX, rect, W, padL, plotW, m))
    const vy = ((ev.clientY - rect.top) / rect.height) * H
    setHoverY(Math.max(padT, Math.min(padT + plotH, vy)))   // 限制在绘图区内
  }
  const clearHover = (): void => { setHover(null); setHoverY(null) }
  const hp = hover != null && hover >= 0 && hover < m ? view[hover] : null
  const hx = hover != null ? xAt(hover) : 0
  // tooltip 贴着十字星：光标在左半屏→弹窗在光标右侧，反之在左侧（不压在正上方）
  const tipSide = hover != null && hover < m / 2 ? 'right' : 'left'
  const GAP = 12
  const tipStyle: React.CSSProperties = {
    left: `${(hx / W) * 100}%`,
    transform: tipSide === 'right' ? `translateX(${GAP}px)` : `translateX(calc(-100% - ${GAP}px))`,
  }

  // —— 底部概览 + 范围滑块（全序列） ——
  const oFlows = series.map(p => p[key] ?? 0)
  const oMaxAbs = Math.max(1, ...oFlows.map(Math.abs))
  const oZero = oPadT + oPlotH / 2
  const oX = (i: number): number => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW)
  const selX0 = oX(s), selX1 = oX(e)

  function beginDrag(mode: Drag, ev: React.PointerEvent): void {
    ev.preventDefault()
    drag.current = mode
    panRef.current = { x: ev.clientX, win: [s, e] }
    setHover(null)
    const move = (me: PointerEvent): void => {
      if (!ovRef.current) return
      const rect = ovRef.current.getBoundingClientRect()
      if (mode === 'pan') {
        const from = panRef.current
        const perIdx = plotW / Math.max(1, n - 1)
        const d = Math.round(((me.clientX - from.x) / rect.width * W) / perIdx)
        const spanW = from.win[1] - from.win[0]
        let a = from.win[0] + d
        a = Math.max(0, Math.min(a, n - 1 - spanW))
        setWin([a, a + spanW])
      } else {
        const i = pointerToIndex(me.clientX, rect, W, padL, plotW, n)
        setWin(mode === 'lo' ? [i, Math.max(i, e)] : [Math.min(i, s), i])
      }
    }
    const up = (): void => {
      drag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const HANDLE = 9

  return (
    <div className="etf-flow__wrap">
      <div className="etf-flow__legend">
        <span className="etf-flow__lg"><i className="etf-flow__lg-bar" />{label} ETF申购净流入</span>
        <span className="etf-flow__lg"><i className="etf-flow__lg-line" />上证指数</span>
      </div>
      <svg
        ref={mainRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="ETF 净流入柱状图，红为净流入、绿为净流出，叠加上证指数折线，可十字光标查看与拖动范围"
        className="etf-flow__chart"
        onPointerMove={onMainMove}
        onPointerLeave={clearHover}
      >
        {/* 水平虚线刻度网格 + 每条线的数值（左=净流入亿元，右=上证指数） */}
        {[0, 0.25, 0.75, 1].map(f => {
          const y = padT + f * plotH
          const dy = f === 0 ? 9 : f === 1 ? 0 : 4   // 顶/底行贴边、半档行居中
          return (
            <g key={f}>
              <line className="etf-flow__grid" x1={padL} y1={y} x2={W - padR} y2={y} strokeDasharray="3 4" />
              <text x={padL - 6} y={y + dy} textAnchor="end" className="etf-flow__ax">{fmt1(maxAbs * (1 - 2 * f))}</text>
              {idxVals.length > 0 && (
                <text x={W - padR + 6} y={y + dy} className="etf-flow__ax">{(iMax - f * (iMax - iMin)).toFixed(0)}</text>
              )}
            </g>
          )
        })}
        {/* 零轴 */}
        <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="var(--line, #dfe3ea)" />
        {/* 红绿柱 */}
        {view.map((p, i) => {
          const v = p[key] ?? 0
          const h = barH(v)
          return (
            <rect key={p.date} x={xAt(i) - bw / 2} y={v >= 0 ? zeroY - h : zeroY}
              width={bw} height={Math.abs(h)} fill={v >= 0 ? 'var(--up)' : 'var(--down)'} />
          )
        })}
        {/* 上证指数折线 */}
        {idxLine && <polyline points={idxLine} fill="none" stroke="var(--idx, #8893a7)" strokeWidth={1.3} />}
        {/* 日期轴 */}
        <text x={padL} y={H - 6} className="etf-flow__ax">{view[0]?.date}</text>
        {m > 2 && <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" className="etf-flow__ax">{view[Math.floor(m / 2)]?.date}</text>}
        <text x={W - padR} y={H - 6} textAnchor="end" className="etf-flow__ax">{view.at(-1)?.date}</text>
        {/* 十字光标 */}
        {hp && (
          <g pointerEvents="none">
            <line x1={hx} y1={padT} x2={hx} y2={padT + plotH} stroke="var(--muted, #8893a7)" strokeWidth={1} strokeDasharray="3 3" />
            {hoverY != null && <line x1={padL} y1={hoverY} x2={W - padR} y2={hoverY} stroke="var(--muted, #8893a7)" strokeWidth={1} strokeDasharray="3 3" />}
            <rect x={hx - bw / 2} y={(hp[key] ?? 0) >= 0 ? zeroY - barH(hp[key] ?? 0) : zeroY}
              width={bw} height={Math.abs(barH(hp[key] ?? 0))} fill={(hp[key] ?? 0) >= 0 ? 'var(--up)' : 'var(--down)'} opacity={0.5} />
            {hp.index != null && <circle cx={hx} cy={iy(hp.index)} r={3} fill="var(--idx, #8893a7)" />}
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hp && (
        <div className={`etf-flow__tip etf-flow__tip--${tipSide}`} style={tipStyle} aria-hidden>
          <div className="etf-flow__tip-date">{hp.date}</div>
          <div className="etf-flow__tip-row">
            <span className="etf-flow__tip-k"><i style={{ background: (hp[key] ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }} />{label} ETF申购净流入</span>
            <span style={{ color: (hp[key] ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
              {hp[key] == null ? '—' : `${fmt1(hp[key] as number)}亿`}
            </span>
          </div>
          <div className="etf-flow__tip-row">
            <span className="etf-flow__tip-k"><i style={{ background: 'var(--idx, #8893a7)' }} />上证指数</span>
            <span>{hp.index == null ? '—' : hp.index.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* 底部范围滑块 */}
      <svg ref={ovRef} viewBox={`0 0 ${W} ${OVH}`} className="etf-flow__ov" role="presentation">
        <line x1={padL} y1={oZero} x2={W - padR} y2={oZero} stroke="var(--line, #e9edf3)" />
        {series.map((p, i) => {
          const v = p[key] ?? 0
          const h = (v / oMaxAbs) * (oPlotH / 2)
          return <rect key={p.date} x={oX(i)} y={v >= 0 ? oZero - h : oZero} width={Math.max(0.4, plotW / n)}
            height={Math.abs(h)} fill={v >= 0 ? 'var(--up)' : 'var(--down)'} opacity={0.5} />
        })}
        {/* 未选区域遮罩 */}
        <rect x={padL} y={0} width={Math.max(0, selX0 - padL)} height={OVH} className="etf-flow__ov-mask" />
        <rect x={selX1} y={0} width={Math.max(0, W - padR - selX1)} height={OVH} className="etf-flow__ov-mask" />
        {/* 选区（可拖动平移） */}
        <rect x={selX0} y={2} width={Math.max(1, selX1 - selX0)} height={OVH - 4} className="etf-flow__ov-sel"
          onPointerDown={ev => beginDrag('pan', ev)} style={{ cursor: 'grab' }} />
        {/* 两个手柄 */}
        {([['lo', selX0], ['hi', selX1]] as const).map(([mode, x]) => (
          <g key={mode} onPointerDown={ev => beginDrag(mode, ev)} style={{ cursor: 'ew-resize' }}>
            <rect x={x - HANDLE / 2} y={2} width={HANDLE} height={OVH - 4} rx={3} className="etf-flow__ov-handle" />
            <line x1={x} y1={OVH / 2 - 5} x2={x} y2={OVH / 2 + 5} stroke="#fff" strokeWidth={1} />
          </g>
        ))}
      </svg>
    </div>
  )
}
