import React, { useMemo, useState } from 'react'
import { ToneBadge } from './MacroViews'
import type { Tone } from './stages'
import { HORIZONS, average, baselineReturn, buildChannel, forwardReturn, movingAverage, sigmaOf, touchEvents, zoneOf, type SpreadSeries, type SpreadSnapshot, type Zone } from './spread'
import './macro.css'

const W = 720
const PAD = { l: 34, r: 40, t: 12, b: 20 }
const H1 = 260
const H2 = 150
const RANGES = [{ id: '3y', label: '3 年', years: 3 }, { id: '5y', label: '5 年', years: 5 }, { id: '10y', label: '10 年', years: 10 }, { id: 'all', label: '全部', years: 0 }] as const
type RangeId = (typeof RANGES)[number]['id']

const ZONE: Record<Zone, { tone: Tone; label: string; text: string }> = {
  upper: { tone: 'green', label: '已触及上轨', text: '和最近三年相比，股票相对债券处在很便宜的位置。' },
  lower: { tone: 'red', label: '已跌破下轨', text: '和最近三年相比，股票相对债券处在很贵的位置。' },
  above: { tone: 'gray', label: '中轨与上轨之间', text: '' },
  below: { tone: 'gray', label: '下轨与中轨之间', text: '' },
}
const signed = (v: number | undefined, d = 1): string => (v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`)
const niceTicks = (lo: number, hi: number, n: number): number[] => {
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)))
  return out
}

function EventTable({ title, hint, events, data, base }: { title: string; hint: string; events: number[]; data: SpreadSnapshot; base: (number | undefined)[] }): JSX.Element {
  const rets = events.map(i => HORIZONS.map(h => forwardReturn(data.rows, i, h)))
  return (
    <section className="macro-card" aria-label={title}>
      <h3>{title}</h3>
      <p className="macro-muted">{hint}</p>
      <div className="macro-table-wrap">
        <table className="macro-table macro-val">
          <thead><tr><th>触轨首日</th>{HORIZONS.map(h => <th key={h} className="macro-val__n">{h} 日后</th>)}</tr></thead>
          <tbody>
            {events.map((i, n) => <tr key={i}><td>{data.rows[i][0]}</td>{rets[n].map((v, c) => <td key={c} className="macro-val__n">{signed(v)}</td>)}</tr>)}
            {events.length === 0 && <tr><td colSpan={HORIZONS.length + 1} className="macro-muted">有数据以来没有出现过</td></tr>}
            <tr><td><b>平均</b></td>{HORIZONS.map((h, c) => <td key={h} className="macro-val__n"><b>{signed(average(rets.map(r => r[c])))}</b></td>)}</tr>
            <tr><td className="macro-muted">平时任意一天</td>{base.map((v, c) => <td key={c} className="macro-val__n macro-muted">{signed(v)}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** 股债息差通道：可在沪深300 与其他指数之间切换 */
export function SpreadView({ data }: { data: SpreadSnapshot }): JSX.Element {
  const list: SpreadSeries[] = [{ id: 'csi300', name: '沪深300', label: data.extra?.some(x => x.name === '沪深300') ? '沪深300（市值加权）' : '沪深300', note: '', rows: data.rows }, ...(data.extra ?? [])]
  // 网址里带 index=sse50 这样的参数时，直接打开对应指数
  const [which, setWhich] = useState(() => new URLSearchParams(window.location.search).get('index') ?? 'csi300')
  const item = list.find(x => x.id === which) ?? list[0]
  return (
    <div className="macro-stack">
      {list.length > 1 && (
        <div className="macro-long__bar" role="group" aria-label="选择指数">
          {list.map(x => <button key={x.id} type="button" className={`macro-long__tab${x.id === item.id ? ' is-on' : ''}`} aria-pressed={x.id === item.id} onClick={() => setWhich(x.id)}>{x.label ?? x.name}</button>)}
        </div>
      )}
      <CompareCard data={data} items={list.filter(x => x.name === item.name)} current={item.id} />
      <SpreadPanel key={item.id} data={{ ...data, rows: item.rows }} name={item.name} label={item.label ?? item.name} note={item.note} />
    </div>
  )
}

/** 同一个指数有多种口径时，把各口径的当前读数并排列出来 */
function CompareCard({ data, items, current }: { data: SpreadSnapshot; items: SpreadSeries[]; current: string }): JSX.Element | null {
  const rows = useMemo(() => items.map(x => {
    const bands = buildChannel(x.rows, data.window, data.k), last = x.rows.length - 1, band = bands[last]
    return band ? { id: x.id, label: x.label ?? x.name, value: x.rows[last][1], band, zone: ZONE[zoneOf(x.rows[last][1], band)] } : null
  }), [items, data.window, data.k])
  if (items.length < 2 || rows.some(r => !r)) return null
  return (
    <section className="macro-card" aria-label="两种口径并排">
      <h3>{items[0].name}：两种口径的当前读数</h3>
      <div className="macro-table-wrap">
        <table className="macro-table macro-val">
          <thead><tr><th>口径</th><th className="macro-val__n">息差</th><th className="macro-val__n">下轨</th><th className="macro-val__n">中轨</th><th className="macro-val__n">上轨</th><th className="macro-val__n">偏离中轨</th><th>位置</th></tr></thead>
          <tbody>
            {rows.map(r => r && (
              <tr key={r.id}>
                <td>{r.id === current ? <b>{r.label}</b> : r.label}</td>
                <td className="macro-val__n">{r.value.toFixed(2)}</td>
                <td className="macro-val__n">{r.band.lower.toFixed(2)}</td>
                <td className="macro-val__n">{r.band.mid.toFixed(2)}</td>
                <td className="macro-val__n">{r.band.upper.toFixed(2)}</td>
                <td className="macro-val__n">{sigmaOf(r.value, r.band, data.k) >= 0 ? '+' : ''}{sigmaOf(r.value, r.band, data.k).toFixed(2)} 倍</td>
                <td><ToneBadge tone={r.zone.tone} label={r.zone.label} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="macro-muted">市值加权主要反映银行、能源等大公司；中位数反映一只普通成分股。两者读数不同是正常的，分歧本身就是信息。</p>
    </section>
  )
}

/** 单个指数：当前位置、走势图（与指数共用时间轴）、历次触轨之后的指数表现 */
function SpreadPanel({ data, name, label, note }: { data: SpreadSnapshot; name: string; label: string; note: string }): JSX.Element {
  const [range, setRange] = useState<RangeId>('5y')
  const [hover, setHover] = useState<number | null>(null)
  const { rows } = data
  const bands = useMemo(() => buildChannel(rows, data.window, data.k), [rows, data.window, data.k])
  const ups = useMemo(() => touchEvents(rows, bands, 'upper'), [rows, bands])
  const downs = useMemo(() => touchEvents(rows, bands, 'lower'), [rows, bands])
  const firstBand = bands.findIndex(b => b !== null)
  const ma = useMemo(() => movingAverage(rows, 200), [rows])
  const base = useMemo(() => HORIZONS.map(h => baselineReturn(rows, Math.max(0, firstBand), h)), [rows, firstBand])

  const last = rows.length - 1
  const nowBand = bands[last]
  if (!nowBand) return <p role="alert" className="macro-muted">股债息差数据不足，暂时画不出通道。</p>
  const now = rows[last], zone = zoneOf(now[1], nowBand), z = ZONE[zone]
  const maNow = ma[last]
  const gapText = z.text || `离上轨还差 ${(nowBand.upper - now[1]).toFixed(2)} 个百分点，离下轨还有 ${(now[1] - nowBand.lower).toFixed(2)} 个百分点。`

  // 显示范围：按年份往回截
  const years = RANGES.find(r => r.id === range)!.years
  const cut = years ? `${Number(now[0].slice(0, 4)) - years}${now[0].slice(4)}` : ''
  const i0 = years ? Math.max(0, rows.findIndex(r => r[0] >= cut)) : 0
  const n = last - i0
  const x = (i: number): number => PAD.l + ((i - i0) / Math.max(1, n)) * (W - PAD.l - PAD.r)
  const step = Math.max(1, Math.floor(n / 1000))
  const idx: number[] = []
  for (let i = i0; i < last; i += step) idx.push(i)
  idx.push(last)

  const scale = (lo: number, hi: number, H: number, padK: number) => {
    const pad = (hi - lo || 1) * padK, a = lo - pad, b = hi + pad
    return { lo: a, hi: b, y: (v: number) => PAD.t + ((b - v) / (b - a)) * (H - PAD.t - PAD.b) }
  }
  let sLo = Infinity, sHi = -Infinity, pLo = Infinity, pHi = -Infinity
  for (let i = i0; i <= last; i++) {
    const b = bands[i], [, s, p] = rows[i]
    sLo = Math.min(sLo, s, b?.lower ?? s); sHi = Math.max(sHi, s, b?.upper ?? s)
    pLo = Math.min(pLo, p, ma[i] ?? p); pHi = Math.max(pHi, p, ma[i] ?? p)
  }
  const s1 = scale(sLo, sHi, H1, 0.08), s2 = scale(pLo, pHi, H2, 0.2)
  const line = (get: (i: number) => number | undefined, y: (v: number) => number): string => {
    let d = '', pen = false
    for (const i of idx) { const v = get(i); if (v === undefined) { pen = false; continue } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true }
    return d
  }
  const withBand = idx.filter(i => bands[i])
  const area = withBand.length
    ? `${withBand.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${s1.y(bands[i]!.upper).toFixed(1)}`).join('')}${[...withBand].reverse().map(i => `L${x(i).toFixed(1)},${s1.y(bands[i]!.lower).toFixed(1)}`).join('')}Z`
    : ''
  const yearTicks: [number, string][] = []
  for (let i = i0 + 1; i <= last; i++) {
    const y = rows[i][0].slice(0, 4)
    if (y !== rows[i - 1][0].slice(0, 4) && (n / 245 <= 12 || Number(y) % 2 === 0)) yearTicks.push([i, y])
  }

  const cur = hover ?? last, cb = bands[cur]
  const onMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = ((e.clientX - box.left) / box.width) * W
    setHover(Math.max(i0, Math.min(last, Math.round(i0 + ((rel - PAD.l) / (W - PAD.l - PAD.r)) * n))))
  }
  const tri = (cx: number, cy: number, up: boolean): string => (up ? `M${cx},${cy - 12}l5.5,9h-11Z` : `M${cx},${cy + 12}l5.5,-9h-11Z`)
  const shown = (list: number[]): number[] => list.filter(i => i >= i0)
  const axis = (H: number, ticks: number[], y: (v: number) => number, digits: number): JSX.Element => (
    <>
      {ticks.map(v => <g key={v}><line className="macro-spark__threshold" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} /><text className="macro-long__label" x={PAD.l - 5} y={y(v) + 3.5} textAnchor="end">{v.toFixed(digits)}</text></g>)}
      {yearTicks.map(([i, label]) => <text key={label} className="macro-long__label" x={x(i)} y={H - 5} textAnchor="middle">{label}</text>)}
    </>
  )

  return (
    <>
      <section className={`macro-hero${z.tone === 'gray' ? '' : ` macro-hero--${z.tone}`}`} aria-label="当前位置">
        <div className="macro-hero__head">
          <span className="macro-muted">{label} 盈利收益率 − 10 年期国债收益率 · 截至 {now[0]}</span>
          <ToneBadge tone={z.tone} label={z.label} />
        </div>
        <h2 className="macro-hero__name">{now[1].toFixed(2)}<small className="macro-spread__unit"> 个百分点</small></h2>
        <p className="macro-hero__summary">偏离中轨 {sigmaOf(now[1], nowBand, data.k) >= 0 ? '+' : ''}{sigmaOf(now[1], nowBand, data.k).toFixed(2)} 倍标准差。{gapText}</p>
        {maNow !== undefined && <p className="macro-hero__summary">趋势：{name} 在 200 日均线{now[2] > maNow ? '上方' : '下方'}（{now[2] > maNow ? '高出' : '低于'}均线 {Math.abs((now[2] / maNow - 1) * 100).toFixed(1)}%）。</p>}
        <dl className="macro-spread__stats">
          <div><dt>上轨</dt><dd>{nowBand.upper.toFixed(2)}</dd></div>
          <div><dt>中轨</dt><dd>{nowBand.mid.toFixed(2)}</dd></div>
          <div><dt>下轨</dt><dd>{nowBand.lower.toFixed(2)}</dd></div>
          <div><dt>{name}</dt><dd>{now[2].toFixed(0)}</dd></div>
          {maNow !== undefined && <div><dt>200 日均线</dt><dd>{maNow.toFixed(0)}</dd></div>}
        </dl>
      </section>

      <section className="macro-card" aria-label="走势">
        <figure className="macro-long" style={{ margin: 0 }}>
          <div className="macro-long__bar" role="group" aria-label="股债息差时间范围">
            {RANGES.map(r => <button key={r.id} type="button" className={`macro-long__tab${range === r.id ? ' is-on' : ''}`} aria-pressed={range === r.id} onClick={() => { setRange(r.id); setHover(null) }}>{r.label}</button>)}
            <span className="macro-long__pct">{rows[cur][0]} · 息差 {rows[cur][1].toFixed(2)}{cb && ` · 偏离 ${sigmaOf(rows[cur][1], cb, data.k) >= 0 ? '+' : ''}${sigmaOf(rows[cur][1], cb, data.k).toFixed(2)} 倍`} · {name} {rows[cur][2].toFixed(0)}</span>
          </div>
          <h3 className="macro-h3">息差与通道（百分点）</h3>
          <svg viewBox={`0 0 ${W} ${H1}`} role="img" onPointerMove={onMove} onPointerLeave={() => setHover(null)}
            aria-label={`股债息差 ${rows[i0][0].slice(0, 4)} 年至今走势：最新 ${now[1].toFixed(2)}，上轨 ${nowBand.upper.toFixed(2)}，下轨 ${nowBand.lower.toFixed(2)}`}>
            {axis(H1, niceTicks(s1.lo, s1.hi, 5), s1.y, 1)}
            {area && <path className="macro-spread__band" d={area} />}
            <path className="macro-spread__rail" d={line(i => bands[i]?.upper, s1.y)} />
            <path className="macro-spread__rail" d={line(i => bands[i]?.lower, s1.y)} />
            <path className="macro-spread__rail" d={line(i => bands[i]?.mid, s1.y)} strokeDasharray="4 3" />
            <path className="macro-spread__line" d={line(i => rows[i][1], s1.y)} />
            {(['upper', 'mid', 'lower'] as const).map((key, k) => <text key={key} className="macro-long__label" x={W - PAD.r + 5} y={s1.y(nowBand[key]) + 3.5}>{['上轨', '中轨', '下轨'][k]}</text>)}
            {shown(ups).map(i => <path key={`u${i}`} className="macro-spread__up" d={tri(x(i), s1.y(rows[i][1]) - 3, true)}><title>{`${rows[i][0]} 触及上轨`}</title></path>)}
            {shown(downs).map(i => <path key={`d${i}`} className="macro-spread__down" d={tri(x(i), s1.y(rows[i][1]) + 3, false)}><title>{`${rows[i][0]} 跌破下轨`}</title></path>)}
            {hover !== null && <line className="macro-spark__cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H1 - PAD.b} />}
            <circle className="macro-spark__dot" cx={x(cur)} cy={s1.y(rows[cur][1])} r={4} />
          </svg>
          <h3 className="macro-h3" style={{ marginTop: 12 }}>{name} 指数</h3>
          <svg viewBox={`0 0 ${W} ${H2}`} role="img" onPointerMove={onMove} onPointerLeave={() => setHover(null)} aria-label={`${name} 指数同期走势，最新 ${now[2].toFixed(0)}`}>
            {axis(H2, niceTicks(s2.lo, s2.hi, 4), s2.y, 0)}
            <path className="macro-spread__ma" d={line(i => ma[i], s2.y)} />
            <path className="macro-spark__line" d={line(i => rows[i][2], s2.y)} />
            {shown(ups).map(i => <path key={`u${i}`} className="macro-spread__up" d={tri(x(i), s2.y(rows[i][2]) + 20, true)} />)}
            {shown(downs).map(i => <path key={`d${i}`} className="macro-spread__down" d={tri(x(i), s2.y(rows[i][2]) - 20, false)} />)}
            {hover !== null && <line className="macro-spark__cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H2 - PAD.b} />}
            <circle className="macro-long__mark" cx={x(cur)} cy={s2.y(rows[cur][2])} r={4} />
          </svg>
          <figcaption className="macro-muted macro-spread__legend">
            <span><svg width="18" height="8" aria-hidden="true"><line className="macro-spread__line" x1="0" y1="4" x2="18" y2="4" /></svg>息差</span>
            <span><svg width="18" height="10" aria-hidden="true"><rect className="macro-spread__band" width="18" height="10" /></svg>上轨到下轨</span>
            <span><svg width="12" height="12" aria-hidden="true"><path className="macro-spread__up" d="M6,1l5,9h-10Z" /></svg>触及上轨</span>
            <span><svg width="12" height="12" aria-hidden="true"><path className="macro-spread__down" d="M6,11l5,-9h-10Z" /></svg>跌破下轨</span>
            <span><svg width="18" height="8" aria-hidden="true"><line className="macro-spread__ma" x1="0" y1="4" x2="18" y2="4" /></svg>200 日均线</span>
          </figcaption>
        </figure>
      </section>

      <div className="macro-spread__tables">
        <EventTable title="历次触及上轨" hint={`之后${name} 的涨跌。连续多天触轨算一次，取第一天。`} events={ups} data={data} base={base} />
        <EventTable title="历次跌破下轨" hint={name === '沪深300' ? '同样的算法。这一侧在 2006 年和 2014 年之后指数还大涨过。' : '同样的算法。'} events={downs} data={data} base={base} />
      </div>

      <section className="macro-card">
        <h3>怎么看这张图</h3>
        <ul>
          <li>息差 = {name} 的盈利收益率（市盈率的倒数）减 10 年期国债收益率。息差高，说明买股票比买国债多拿的回报多；息差低则相反。</li>
          <li>通道 = 最近 {data.window} 个交易日的均值加减 {data.k} 倍标准差，只用当天及之前的数据，没有用到未来的数值。</li>
          {name === '沪深300'
            ? <>
              <li>历史上触及上轨之后半年，沪深300 上涨的次数多于平时；跌破下轨之后并没有更容易下跌。下轨一侧不适合当作卖出依据。</li>
              <li>更严格的检验（只用当时已知的数据逐年往后预测）没有证明它比「跌多了会反弹」知道得更多；同样的算法放到中证500、中证1000 上不成立。把它当位置参考，不要当买卖信号。</li>
            </>
            : <li>在{name} 上按同样的算法，结果和沪深300 接近。它的成分股大多也在沪深300 里，触轨的时间也大多相同，不算另一份独立的证据。</li>}
          {note && <li>{note}</li>}
          <li>200 日均线只描述趋势状态：指数在线上还是线下。我们回测过「线上持有股票、线下换成国债」的做法（2007 年至 2026 年，用含分红的指数、每月末判断一次）：年化约 8.2%，高于对照组合，但好处几乎全来自 2008 年那一次，最大回撤（−49%）也比股债各半（−40%）更深，没有被证明是可靠的择时方法。</li>
          <li>局限：样本只有十几次，每次间隔一两年；窗口和倍数是事先选定的，换一组参数结果会有出入；历史表现不代表以后。这里只给位置，不做预测。</li>
          <li>数据：{data.source}，更新于 {data.generatedAt}。更新命令：<code>npm run spread:update</code>。</li>
        </ul>
      </section>
    </>
  )
}
