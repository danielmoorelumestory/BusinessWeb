import React, { useState } from 'react'

const W = 640
const H = 190
const PAD = { l: 38, r: 12, t: 16, b: 24 }
const t = (d: string): number => new Date(d).getTime()

/** Forward PE 折线图：横轴按真实时间；虚线是历史中位，浅色带是最低–最高；
 * ref 是外部参考序列（线），own 是本站成分股汇总的月度记录（空心点，口径不同，不与 ref 连线） */
export default function FpeChart({ own, refPoints: ref, est, refSource, label }: {
  own: [string, number][]
  refPoints?: [string, number][]
  /** 估算的月度序列（锚点间插值） */
  est?: [string, number][]
  refSource?: string
  label: string
}): JSX.Element | null {
  const [hover, setHover] = useState<string | null>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const base = est && est.length >= 2 ? est : ref && ref.length >= 2 ? ref : own
  const all = [...own, ...(ref ?? []), ...(est ?? [])]
  if (!all.length) return null
  const times = all.map(p => t(p[0])), t0 = Math.min(...times), t1 = Math.max(...times, t0 + 86_400_000 * 30)
  const vals = all.map(p => p[1])
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo || 2) * 0.15
  const yLo = Math.max(0, lo - pad), yHi = hi + pad
  const x = (d: string) => PAD.l + ((t(d) - t0) / (t1 - t0)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - yLo) / (yHi - yLo)) * (H - PAD.t - PAD.b)
  const sorted = base.map(p => p[1]).sort((a, b) => a - b)
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  // 位置只和同口径的序列比：用基础序列自己的最新点，不拿口径不同的本站汇总值去比
  const cur = base[base.length - 1]
  const mine = own[own.length - 1]
  const rank = base.length >= 2 ? Math.round((base.filter(p => p[1] <= cur[1]).length / base.length) * 100) : undefined
  const ticks = [yLo, (yLo + yHi) / 2, yHi].map(v => Math.round(v * 10) / 10)
  const years = Array.from(new Set(all.map(p => p[0].slice(0, 4)))).sort()
  const line = (pts: [string, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')
  const tip = hover ?? null
  // 鼠标横向移动：取离光标时间最近的一个点，显示日期、数值和它在整条序列里的位置
  const onMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const box = e.currentTarget.getBoundingClientRect()
    const time = t0 + (((e.clientX - box.left) / box.width) * W - PAD.l) / (W - PAD.l - PAD.r) * (t1 - t0)
    let lo = 0, hi = base.length - 1
    while (lo < hi) { const mid = (lo + hi) >> 1; if (t(base[mid][0]) < time) lo = mid + 1; else hi = mid }
    const i = lo > 0 && Math.abs(t(base[lo - 1][0]) - time) < Math.abs(t(base[lo][0]) - time) ? lo - 1 : lo
    setCursor(i)
  }
  const pick = cursor !== null && cursor < base.length ? base[cursor] : null
  const pickRank = pick ? Math.round((sorted.filter(v => v <= pick[1]).length / sorted.length) * 100) : undefined
  const pickX = pick ? x(pick[0]) : 0
  const pickText = pick ? `${pick[0]}  ${pick[1].toFixed(1)}x` : ''
  const flip = pickX > W * 0.6

  return (
    <figure className="macro-long" style={{ maxWidth: 760 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" onPointerMove={onMove} onPointerLeave={() => setCursor(null)} style={{ touchAction: 'pan-y' }} aria-label={`${label}：最新 ${cur[1].toFixed(1)}x，参考序列区间 ${Math.min(...base.map(p => p[1])).toFixed(1)}–${Math.max(...base.map(p => p[1])).toFixed(1)}x，中位 ${median.toFixed(1)}x`}>
        {ticks.map(v => <g key={v}><line className="macro-spark__threshold" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} /><text className="macro-long__label" x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{v.toFixed(0)}x</text></g>)}
        <line className="macro-spark__threshold" x1={PAD.l} x2={W - PAD.r} y1={y(median)} y2={y(median)} strokeDasharray="4 3" />
        <text className="macro-long__label" x={W - PAD.r} y={y(median) - 4} textAnchor="end">中位 {median.toFixed(1)}x</text>
        {est && est.length >= 2 && <path className="macro-spark__line" d={line(est)} />}
        {!est?.length && ref && ref.length >= 2 && <path className="macro-spark__line" d={line(ref)} />}
        {ref && ref.length <= 24 && ref.map(p => <circle key={p[0]} className="macro-spark__dot" cx={x(p[0])} cy={y(p[1])} r={3} onPointerEnter={() => setHover(`${p[0]} · ${p[1].toFixed(1)}x`)} onPointerLeave={() => setHover(null)}><title>{`${p[0]} ${p[1].toFixed(1)}x`}</title></circle>)}
        {own.length >= 2 && <path className="macro-spark__line" d={line(own)} strokeDasharray="2 3" />}
        {own.map(p => <circle key={p[0]} className="macro-long__mark" cx={x(p[0])} cy={y(p[1])} r={4.5} fill="none" strokeWidth={2} onPointerEnter={() => setHover(`${p[0].slice(0, 7)} · ${p[1].toFixed(1)}x（本站汇总）`)} onPointerLeave={() => setHover(null)}><title>{`${p[0].slice(0, 7)} 本站汇总 ${p[1].toFixed(1)}x`}</title></circle>)}
        {pick && (
          <g pointerEvents="none">
            <line className="macro-spark__cross" x1={pickX} x2={pickX} y1={PAD.t - 6} y2={H - PAD.b} />
            <circle className="macro-spark__dot" cx={pickX} cy={y(pick[1])} r={4.5} />
            <text className="macro-long__label" x={pickX + (flip ? -8 : 8)} y={PAD.t + 4} textAnchor={flip ? 'end' : 'start'} fontWeight={600}>{pickText}{pickRank !== undefined && ` · 位置 ${pickRank}%`}</text>
          </g>
        )}
        {years.map(yr => <text key={yr} className="macro-spark__caption" x={x(`${yr}-01-01`) < PAD.l ? PAD.l : x(`${yr}-01-01`)} y={H - 6} textAnchor="middle" fontSize={10}>{yr}</text>)}
      </svg>
      <figcaption className="macro-muted">
        {tip ?? (pick ? <>{pick[0]} · <b>{pick[1].toFixed(1)}x</b> · 在整条序列 {sorted.length} 个点中的位置 <b>{pickRank}%</b></> : <>{base === own ? '最新' : `序列最新（${cur[0].slice(0, 7)}）`} <b>{cur[1].toFixed(1)}x</b>{rank !== undefined && <>，在 {base.length} 个历史点中的位置 <b>{rank}%</b>{base.length < 60 && '（样本偏少，仅供参考）'}</>}{mine && base !== own && <>；本站今日汇总 {mine[1].toFixed(1)}x（口径不同）</>}</>)}
        {ref && <><br />{ref.length <= 24 ? '实心点' : '实线'}：{refSource ?? '外部参考'}的真实读数；{est?.length ? '连线是按月估算值（锚点间按预期盈利插值、用每月真实价格计算，非公布值）；' : ''}空心点：本站按成分股汇总，口径不同，不与外部序列比较绝对值。</>}
        {!ref && own.length < 2 && <><br />目前只有 {own.length} 个月的记录，折线要等积累或补录历史数据后才画得出来。</>}
      </figcaption>
    </figure>
  )
}
