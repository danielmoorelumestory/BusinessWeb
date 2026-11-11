import React, { useMemo, useState } from 'react'
import { buildChannel, maBacktest, movingAverage, sigmaOf, touchEvents, zoneOf, type SpreadSeries, type Zone, navStats, niceTicks, signed, yearlyReturns, type SpreadRow, type SpreadSnapshot, type TrendSeries } from './spread'

const W = 720
const PAD = { l: 40, r: 16, t: 12, b: 20 }
const H1 = 280
const H2 = 180
const H3 = 200
const ZONE_LABEL: Record<Zone, string> = { upper: '已触及上轨', lower: '已跌破下轨', above: '中轨与上轨之间', below: '下轨与中轨之间' }
const COST = 0.001
const RANGES = [{ id: '1y', label: '1 年', years: 1 }, { id: '3y', label: '3 年', years: 3 }, { id: 'all', label: '全部', years: 0 }] as const
type RangeId = (typeof RANGES)[number]['id']
const pct = (v: number): string => signed(v * 100, 2)
const times = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`

/** 只看价格的指数：10 日线规则的买卖点、净值和历史回测 */
export function TrendPanel({ item, data, spreads }: { item: TrendSeries; data: SpreadSnapshot; spreads: SpreadSeries[] }): JSX.Element {
  const [ref, setRef] = useState(spreads[0]?.id)
  const sp = spreads.find(x => x.id === ref) ?? spreads[0]
  const spLabel = sp ? sp.label ?? sp.name : ''
  const [range, setRange] = useState<RangeId>(() => {
    const q = new URLSearchParams(window.location.search).get('range')
    return RANGES.some(r => r.id === q) ? q as RangeId : '1y'
  })
  const [hover, setHover] = useState<number | null>(null)
  const { rows, name } = item
  const bt = useMemo(() => maBacktest(rows, item.start, 10, COST), [rows, item.start])
  const ma10 = useMemo(() => movingAverage(rows.map((r): SpreadRow => [r[0], 0, r[2]]), 10), [rows])
  // 息差按日期对到科创50 的交易日上；对不上的日子留空
  const spBands = useMemo(() => (sp ? buildChannel(sp.rows, data.window, data.k) : []), [sp, data.window, data.k])
  const spAt = useMemo(() => { const m = new Map((sp?.rows ?? []).map((r, i) => [r[0], i])); return rows.map(r => m.get(r[0])) }, [sp, rows])
  const spTouch = useMemo(() => {
    if (!sp) return { up: [] as number[], down: [] as number[] }
    const back = new Map(rows.map((r, i) => [r[0], i]))
    const map = (list: number[]): number[] => list.map(j => back.get(sp.rows[j][0])).filter((i): i is number => i !== undefined)
    return { up: map(touchEvents(sp.rows, spBands, 'upper')), down: map(touchEvents(sp.rows, spBands, 'lower')) }
  }, [sp, spBands, rows])
  const spVal = (i: number): number | undefined => { const j = spAt[i]; return j === undefined ? undefined : sp!.rows[j][1] }
  const spBand = (i: number) => { const j = spAt[i]; return j === undefined ? null : spBands[j] }
  const spLast = sp ? sp.rows.length - 1 : -1, spNowBand = sp ? spBands[spLast] : null
  const last = rows.length - 1, now = rows[last], first = bt.first
  const rule = navStats(rows, bt.nav, first), hold = navStats(rows, bt.hold, first)
  const done = bt.trades.filter(t => t.ret !== undefined)
  const wins = done.filter(t => t.ret! > 0).length
  const open = bt.trades[bt.trades.length - 1]
  const years = yearlyReturns(rows, bt.nav, first), holdYears = yearlyReturns(rows, bt.hold, first)

  const span = RANGES.find(r => r.id === range)!.years
  const cut = span ? `${Number(now[0].slice(0, 4)) - span}${now[0].slice(4)}` : ''
  const i0 = Math.max(first, span ? rows.findIndex(r => r[0] >= cut) : first)
  const n = last - i0
  const x = (i: number): number => PAD.l + ((i - i0) / Math.max(1, n)) * (W - PAD.l - PAD.r)
  const idx = Array.from({ length: n + 1 }, (_, k) => i0 + k)
  const scale = (vals: number[], H: number, padK: number) => {
    const lo0 = Math.min(...vals), hi0 = Math.max(...vals), pad = (hi0 - lo0 || 1) * padK, lo = lo0 - pad, hi = hi0 + pad
    return { lo, hi, y: (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b) }
  }
  const s1 = scale(idx.map(i => rows[i][2]), H1, 0.1)
  // 净值图从所选范围的第一天归一到 1，两条线才好比较
  const nb = bt.nav[i0] ?? 1, hb = bt.hold[i0] ?? 1
  const navAt = (i: number): number => (bt.nav[i] ?? nb) / nb, holdAt = (i: number): number => (bt.hold[i] ?? hb) / hb
  const s2 = scale(idx.flatMap(i => [navAt(i), holdAt(i)]), H2, 0.08)
  const spVals = idx.flatMap(i => { const v = spVal(i), b = spBand(i); return v === undefined ? [] : b ? [v, b.upper, b.lower] : [v] })
  const s3 = scale(spVals.length ? spVals : [0, 1], H3, 0.08)
  const withBand = idx.filter(i => spBand(i))
  const area = withBand.length
    ? `${withBand.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${s3.y(spBand(i)!.upper).toFixed(1)}`).join('')}${[...withBand].reverse().map(i => `L${x(i).toFixed(1)},${s3.y(spBand(i)!.lower).toFixed(1)}`).join('')}Z`
    : ''
  const line = (get: (i: number) => number | undefined, y: (v: number) => number): string => {
    let d = '', pen = false
    for (const i of idx) { const v = get(i); if (v === undefined) { pen = false; continue } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true }
    return d
  }
  const yearTicks: [number, string][] = []
  for (let i = i0 + 1; i <= last; i++) if (rows[i][0].slice(0, 4) !== rows[i - 1][0].slice(0, 4)) yearTicks.push([i, rows[i][0].slice(0, 4)])
  const axis = (H: number, ticks: number[], y: (v: number) => number, digits: number): JSX.Element => (
    <>
      {ticks.map(v => <g key={v}><line className="macro-spark__threshold" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} /><text className="macro-long__label" x={PAD.l - 5} y={y(v) + 3.5} textAnchor="end">{v.toFixed(digits)}</text></g>)}
      {yearTicks.map(([i, label]) => <text key={label} className="macro-long__label" x={x(i)} y={H - 5} textAnchor="middle">{label}</text>)}
    </>
  )
  const onMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = ((e.clientX - box.left) / box.width) * W
    setHover(Math.max(i0, Math.min(last, Math.round(i0 + ((rel - PAD.l) / (W - PAD.l - PAD.r)) * n))))
  }
  const cur = hover ?? last
  const size = span === 1 ? 5 : span === 3 ? 3.5 : 2.5
  const up = (cx: number, cy: number): string => `M${cx.toFixed(1)},${cy.toFixed(1)}l${size},${size * 1.7}h${-size * 2}Z`
  const down = (cx: number, cy: number): string => `M${cx.toFixed(1)},${cy.toFixed(1)}l${size},${-size * 1.7}h${-size * 2}Z`
  const buys = bt.trades.filter(t => t.buy >= i0), sells = bt.trades.filter(t => t.sell !== undefined && t.sell >= i0)

  const status = bt.want === bt.holding
    ? (bt.holding ? `按规则持有中，${rows[open.buy][0]} 开盘买入（${rows[open.buy][1].toFixed(0)}）。` : `按规则空仓中，${rows[open.sell!][0]} 开盘卖出（${rows[open.sell!][1].toFixed(0)}）。`)
    : (bt.want ? '收盘刚站上 10 日线，按规则下一个交易日开盘买入。' : '收盘刚跌破 10 日线，按规则下一个交易日开盘卖出。')
  const recent = [...bt.trades].reverse().slice(0, 12)

  return (
    <>
      <section className="macro-hero" aria-label="当前状态">
        <div className="macro-hero__head"><span className="macro-muted">{item.label ?? name} · 10 日线规则 · 截至 {now[0]}</span></div>
        <h2 className="macro-hero__name">{now[2].toFixed(0)}</h2>
        <p className="macro-hero__summary">收盘在 10 日均线{bt.want ? '上方' : '下方'}（均线 {ma10[last]?.toFixed(0)}）。{status}</p>
        {sp && spNowBand && <p className="macro-hero__summary">股债息差参考（{spLabel}，截至 {sp.rows[spLast][0]}）：{sp.rows[spLast][1].toFixed(2)} 个百分点，偏离中轨 {times(sigmaOf(sp.rows[spLast][1], spNowBand, data.k))} 倍，{ZONE_LABEL[zoneOf(sp.rows[spLast][1], spNowBand)]}。</p>}
      </section>

      <section className="macro-card" aria-label="走势与买卖点">
        <figure className="macro-long" style={{ margin: 0 }}>
          <div className="macro-long__bar" role="group" aria-label="科创50 时间范围">
            {RANGES.map(r => <button key={r.id} type="button" className={`macro-long__tab${range === r.id ? ' is-on' : ''}`} aria-pressed={range === r.id} onClick={() => { setRange(r.id); setHover(null) }}>{r.label}</button>)}
            <span className="macro-long__pct">{rows[cur][0]} · 开 {rows[cur][1].toFixed(0)} · 收 {rows[cur][2].toFixed(0)}{spVal(cur) !== undefined && ` · 息差 ${spVal(cur)!.toFixed(2)}`}{spBand(cur) && ` · 偏离 ${signed(sigmaOf(spVal(cur)!, spBand(cur)!, data.k) * 100 / 100, 2).replace('%', '')} 倍`}</span>
          </div>
          <h3 className="macro-h3">{name} 指数与买卖点</h3>
          <svg viewBox={`0 0 ${W} ${H1}`} role="img" onPointerMove={onMove} onPointerLeave={() => setHover(null)} aria-label={`${name} 走势，所选范围内买入 ${buys.length} 次，卖出 ${sells.length} 次`}>
            {axis(H1, niceTicks(s1.lo, s1.hi, 5), s1.y, 0)}
            <path className="macro-spread__ma10" d={line(i => ma10[i], s1.y)} />
            <path className="macro-spark__line" d={line(i => rows[i][2], s1.y)} />
            {buys.map(t => <path key={`b${t.buy}`} className="macro-spread__up" d={up(x(t.buy), s1.y(rows[t.buy][1]) + 3)}><title>{`${rows[t.buy][0]} 开盘买入 ${rows[t.buy][1].toFixed(0)}`}</title></path>)}
            {sells.map(t => <path key={`s${t.sell}`} className="macro-spread__down" d={down(x(t.sell!), s1.y(rows[t.sell!][1]) - 3)}><title>{`${rows[t.sell!][0]} 开盘卖出 ${rows[t.sell!][1].toFixed(0)}`}</title></path>)}
            {hover !== null && <line className="macro-spark__cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H1 - PAD.b} />}
          </svg>
          {sp && <>
            <div className="macro-long__bar" role="group" aria-label="息差参考" style={{ marginTop: 12 }}>
              <h3 className="macro-h3" style={{ margin: 0 }}>股债息差通道（百分点）</h3>
              {spreads.map(x => <button key={x.id} type="button" className={`macro-long__tab${x.id === sp.id ? ' is-on' : ''}`} aria-pressed={x.id === sp.id} onClick={() => setRef(x.id)}>{x.label ?? x.name}</button>)}
            </div>
            <svg viewBox={`0 0 ${W} ${H3}`} role="img" onPointerMove={onMove} onPointerLeave={() => setHover(null)} aria-label={`${spLabel} 股债息差同期走势`}>
              {axis(H3, niceTicks(s3.lo, s3.hi, 4), s3.y, 1)}
              {area && <path className="macro-spread__band" d={area} />}
              <path className="macro-spread__rail" d={line(i => spBand(i)?.upper, s3.y)} />
              <path className="macro-spread__rail" d={line(i => spBand(i)?.lower, s3.y)} />
              <path className="macro-spread__rail" d={line(i => spBand(i)?.mid, s3.y)} strokeDasharray="4 3" />
              <path className="macro-spread__line" d={line(spVal, s3.y)} />
              {spTouch.up.filter(i => i >= i0).map(i => <path key={`tu${i}`} className="macro-spread__up" d={`M${x(i).toFixed(1)},${(s3.y(spVal(i)!) - 15).toFixed(1)}l5.5,9h-11Z`}><title>{`${rows[i][0]} 息差触及上轨`}</title></path>)}
              {spTouch.down.filter(i => i >= i0).map(i => <path key={`td${i}`} className="macro-spread__down" d={`M${x(i).toFixed(1)},${(s3.y(spVal(i)!) + 15).toFixed(1)}l5.5,-9h-11Z`}><title>{`${rows[i][0]} 息差跌破下轨`}</title></path>)}
              {hover !== null && <line className="macro-spark__cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H3 - PAD.b} />}
            </svg>
          </>}
          <h3 className="macro-h3" style={{ marginTop: 12 }}>净值（所选范围第一天 = 1）</h3>
          <svg viewBox={`0 0 ${W} ${H2}`} role="img" onPointerMove={onMove} onPointerLeave={() => setHover(null)} aria-label={`所选范围内规则净值 ${navAt(last).toFixed(2)}，一直持有 ${holdAt(last).toFixed(2)}`}>
            {axis(H2, niceTicks(s2.lo, s2.hi, 4), s2.y, 2)}
            <path className="macro-spark__line" d={line(holdAt, s2.y)} />
            <path className="macro-spread__line" d={line(navAt, s2.y)} />
            {hover !== null && <line className="macro-spark__cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H2 - PAD.b} />}
          </svg>
          <figcaption className="macro-muted macro-spread__legend">
            <span><svg width="18" height="8" aria-hidden="true"><line className="macro-spread__ma10" x1="0" y1="4" x2="18" y2="4" /></svg>10 日均线</span>
            <span><svg width="12" height="12" aria-hidden="true"><path className="macro-spread__up" d="M6,1l5,9h-10Z" /></svg>上图买入（站上次日开盘）</span>
            <span><svg width="12" height="12" aria-hidden="true"><path className="macro-spread__down" d="M6,11l5,-9h-10Z" /></svg>上图卖出（跌破次日开盘）</span>
            {sp && <>
              <span><svg width="18" height="10" aria-hidden="true"><rect className="macro-spread__band" width="18" height="10" /></svg>息差上轨到下轨</span>
              <span><svg width="12" height="12" aria-hidden="true"><path className="macro-spread__up" d="M6,1l5,9h-10Z" /></svg>中图息差触及上轨</span>
              <span><svg width="12" height="12" aria-hidden="true"><path className="macro-spread__down" d="M6,11l5,-9h-10Z" /></svg>中图息差跌破下轨</span>
            </>}
            <span><svg width="18" height="8" aria-hidden="true"><line className="macro-spread__line" x1="0" y1="4" x2="18" y2="4" /></svg>息差 / 规则净值</span>
            <span><svg width="18" height="8" aria-hidden="true"><line className="macro-spark__line" x1="0" y1="4" x2="18" y2="4" /></svg>一直持有</span>
          </figcaption>
        </figure>
      </section>

      <div className="macro-spread__tables">
        <section className="macro-card" aria-label="回测结果">
          <h3>回测结果</h3>
          <p className="macro-muted">{rows[first][0]} 至 {now[0]}，每次买卖收 0.1%，空仓现金零收益，未计分红。</p>
          <div className="macro-table-wrap"><table className="macro-table macro-val">
            <thead><tr><th></th><th className="macro-val__n">10 日线规则</th><th className="macro-val__n">一直持有</th></tr></thead>
            <tbody>
              <tr><td>年化</td><td className="macro-val__n">{pct(rule.annual)}</td><td className="macro-val__n">{pct(hold.annual)}</td></tr>
              <tr><td>累计</td><td className="macro-val__n">{pct(rule.total)}</td><td className="macro-val__n">{pct(hold.total)}</td></tr>
              <tr><td>最大回撤</td><td className="macro-val__n">{pct(rule.drawdown)}</td><td className="macro-val__n">{pct(hold.drawdown)}</td></tr>
              <tr><td>完整交易</td><td className="macro-val__n">{done.length} 笔</td><td className="macro-val__n">—</td></tr>
              <tr><td>赚钱比例</td><td className="macro-val__n">{done.length ? (wins / done.length * 100).toFixed(1) : '0'}%</td><td className="macro-val__n">—</td></tr>
            </tbody>
          </table></div>
        </section>
        <section className="macro-card" aria-label="逐年收益">
          <h3>逐年收益</h3>
          <p className="macro-muted">首尾两年不是完整年度。</p>
          <div className="macro-table-wrap"><table className="macro-table macro-val">
            <thead><tr><th>年份</th><th className="macro-val__n">10 日线规则</th><th className="macro-val__n">一直持有</th></tr></thead>
            <tbody>{years.map(([y, v], k) => <tr key={y}><td>{y}</td><td className="macro-val__n">{signed(v * 100)}</td><td className="macro-val__n">{signed(holdYears[k][1] * 100)}</td></tr>)}</tbody>
          </table></div>
        </section>
      </div>

      <section className="macro-card" aria-label="最近的买卖">
        <h3>最近的买卖</h3>
        <div className="macro-table-wrap"><table className="macro-table macro-val">
          <thead><tr><th>买入日</th><th className="macro-val__n">买入价</th><th>卖出日</th><th className="macro-val__n">卖出价</th><th className="macro-val__n">扣费后收益</th></tr></thead>
          <tbody>{recent.map(t => <tr key={t.buy}><td>{rows[t.buy][0]}</td><td className="macro-val__n">{rows[t.buy][1].toFixed(0)}</td><td>{t.sell !== undefined ? rows[t.sell][0] : '持有中'}</td><td className="macro-val__n">{t.sell !== undefined ? rows[t.sell][1].toFixed(0) : '—'}</td><td className="macro-val__n">{signed(t.ret === undefined ? undefined : t.ret * 100, 2)}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section className="macro-card">
        <h3>怎么看这张图</h3>
        <ul>
          <li>规则：收盘价站上 10 日均线，下一个交易日开盘买入；收盘价跌破，下一个交易日开盘卖出。图上的三角画在实际成交那一天的开盘价位置，不是信号当天。</li>
          <li>过去几年它的回撤比一直持有小很多，但这不足以证明规则有效：超额收益几乎全部来自 2022 年和 2026 年，其余年份合计跑输一直持有；样本只有约 6 年，而且是在试过多个指数和规则之后挑出来的。</li>
          <li>同样的规则在沪深300 上（2012 年以来）明显跑输一直持有，每次买卖收 0.1% 时是亏的。</li>
          {sp && <li>息差通道借用的是{spLabel}的数据：科创50 没有足够长的估值历史，算不出自己的通道。两张图只是放在同一条时间轴上方便对照，「息差在便宜区时再看 10 日线」这种配合用法我们没有回测过。</li>}
          {item.note && <li>{item.note}</li>}
          <li>这里记录的是规则的历史表现和当前状态，不是投资建议。要验证它，只能固定规则不再修改，看以后新增的行情。</li>
          <li>数据：新浪指数行情（经 AkShare），更新于 {data.generatedAt}。</li>
        </ul>
      </section>
    </>
  )
}
