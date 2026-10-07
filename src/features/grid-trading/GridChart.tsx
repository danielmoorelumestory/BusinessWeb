import React, { useState } from 'react'
import { buildChartSeries } from './chart'
import type { GridResult, SavedRecord } from './types'

export default function GridChart({ record, result }: { record: SavedRecord; result: GridResult }): JSX.Element {
  const [index, setIndex] = useState<number | null>(null)
  const [hidden, setHidden] = useState<string[]>([])
  const all = buildChartSeries(record, result)
  const visible = all.filter(s => !hidden.includes(s.key))
  if (!result.series.length) return <p>暂无可绘制行情。</p>
  const bounds = (price: boolean) => {
    const values = visible.filter(s => s.priceAxis === price).flatMap(s => s.points.map(p => p.value))
    const min = Math.min(0, ...values), max = Math.max(1, ...values)
    return { min, span: max - min }
  }
  const financial = bounds(false), prices = bounds(true)
  const x = (i: number) => 65 + i / Math.max(1, result.series.length - 1) * 790
  const y = (v: number, price: boolean) => { const b = price ? prices : financial; return 300 - (v - b.min) / b.span * 270 }
  const active = index === null ? null : result.series[index]
  const inspect = (svg: SVGSVGElement, clientX: number) => {
    const rect = svg.getBoundingClientRect()
    if (!rect.width) return
    const coordinate = (clientX - rect.left) / rect.width * 920
    setIndex(Math.max(0, Math.min(result.series.length - 1, Math.round((coordinate - 65) / 790 * (result.series.length - 1)))))
  }
  return <section className="grid-card"><h2>资金与价格走势</h2>
    <div className="grid-chart-legend">{all.map(s => <button type="button" key={s.key} aria-pressed={!hidden.includes(s.key)} style={{ color: s.color, opacity: hidden.includes(s.key) ? 0.4 : 1 }} onClick={() => setHidden(hidden.includes(s.key) ? hidden.filter(k => k !== s.key) : [...hidden, s.key])}>{s.label}</button>)}</div>
    <svg className="grid-chart" viewBox="0 0 920 350" role="img" aria-label="网格资金和价格走势图" onMouseLeave={() => setIndex(null)} onMouseMove={e => inspect(e.currentTarget, e.clientX)} onTouchStart={e => inspect(e.currentTarget, e.touches[0].clientX)} onTouchMove={e => inspect(e.currentTarget, e.touches[0].clientX)}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => <g key={f}><line x1="65" x2="855" y1={300 - f * 270} y2={300 - f * 270} stroke="#cbd5e1" strokeOpacity=".4" /><text x="3" y={304 - f * 270} fontSize="11" fill="currentColor">{Math.round(financial.min + f * financial.span)}</text><text x="864" y={304 - f * 270} fontSize="11" fill="currentColor">{(prices.min + f * prices.span).toFixed(3)}</text></g>)}
      {visible.map(s => <path key={s.key} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.key === 'nextBuy' || s.key === 'nextSell' ? '5 4' : undefined} d={s.points.map((p, i) => `${i ? s.key === 'capitalUsed' ? `H${x(i)} V` : 'L' : 'M'}${s.key === 'capitalUsed' && i ? '' : `${x(i)} `}${y(p.value, s.priceAxis)}`).join(' ')} />)}
      {result.trades.map((t, i) => { const day = result.series.findIndex(p => p.date >= t.date); return day < 0 ? null : <circle key={t.id ?? `${t.date}-${i}`} cx={x(day)} cy={y(t.price, true)} r="4" fill={t.side === '卖出' ? '#1d4ed8' : '#dc2626'}><title>{t.date} {t.side} {t.price.toFixed(3)} · {t.quantity?.toFixed(2)} 份</title></circle> })}
      {index !== null && <line x1={x(index)} x2={x(index)} y1="30" y2="300" stroke="currentColor" strokeDasharray="3 3" />}
      <text x="65" y="330" fontSize="12" fill="currentColor">{result.series[0].date}</text><text x="855" y="330" textAnchor="end" fontSize="12" fill="currentColor">{result.series[result.series.length - 1].date}</text>
    </svg>
    <p className="grid-chart-tooltip" role="status">{active ? `${active.date} · 价格 ${active.current.toFixed(3)} · 持仓市值 ¥${active.positionValue.toFixed(2)} · 占用本金 ¥${active.capitalUsed.toFixed(2)} · 盈亏 ¥${active.pnl.toFixed(2)}` : '移动鼠标或触摸图表查看每日数据；点击图例显示或隐藏曲线。左轴为金额，右轴为价格。'}</p>
  </section>
}
