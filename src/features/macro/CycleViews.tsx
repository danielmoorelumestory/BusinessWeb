import React from 'react'
import { Link } from 'react-router-dom'
import { CN_MID, KONDRATIEFF, US_SECULAR, inventoryPhase, type Band, type BandKind, type CycleView } from './cycles'
import { percentileOf, type MacroSnapshot } from './indicators'
import type { CnKey } from './china'
import './macro.css'

const W = 640
const H = 74
const PAD = 8
const KIND_LABEL: Record<BandKind, string> = { up: '上行', peak: '繁荣', flat: '横盘/过渡', down: '下行', turn: '新一轮' }

/** 时间轴：色带是各阶段，虚线框是"当前大致范围"，竖线是今天 */
function Timeline({ cycle, today }: { cycle: CycleView; today: number }): JSX.Element {
  const x = (t: number) => PAD + ((t - cycle.start) / (cycle.end - cycle.start)) * (W - PAD * 2)
  const ticks = Array.from({ length: Math.floor((cycle.end - cycle.start) / 10) + 1 }, (_, i) => Math.ceil(cycle.start / 10) * 10 + i * 10).filter(t => t >= cycle.start && t <= cycle.end)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="macro-cycle__svg" role="img"
      aria-label={`${cycle.title}时间轴：${cycle.bands.map(b => `${Math.floor(b.from)}–${Math.ceil(b.to)} 年${b.label}`).join('，')}；当前大致范围 ${cycle.now.from}–${cycle.now.to} 年，${cycle.now.verdict}`}>
      {cycle.bands.map((b: Band) => (
        <g key={b.label + b.from}>
          <rect className={`macro-cycle__band macro-cycle__band--${b.kind}`} x={x(b.from)} y={18} width={Math.max(1, x(b.to) - x(b.from) - 1)} height={28}><title>{`${b.label}（${Math.floor(b.from)}–${Math.ceil(b.to)}）：${b.note}`}</title></rect>
          {x(b.to) - x(b.from) > 46 && <text className="macro-cycle__text" x={(x(b.from) + x(b.to)) / 2} y={36} textAnchor="middle">{b.label}</text>}
        </g>
      ))}
      <rect className="macro-cycle__range" x={x(cycle.now.from)} y={13} width={x(cycle.now.to) - x(cycle.now.from)} height={38} rx={3} />
      <line className="macro-cycle__today" x1={x(today)} x2={x(today)} y1={6} y2={56} />
      <text className="macro-cycle__today-label" x={x(today)} y={H - 18} textAnchor="middle">现在</text>
      {ticks.map(t => <text key={t} className="macro-cycle__tick" x={x(t)} y={H - 4} textAnchor="middle">{t}</text>)}
    </svg>
  )
}

function CycleCard({ cycle, today, live }: { cycle: CycleView; today: number; live?: React.ReactNode }): JSX.Element {
  return (
    <article className="macro-card macro-cycle">
      <div className="macro-card__head"><h3>{cycle.title}</h3><span className="macro-badge macro-badge--gray">置信度：{cycle.now.confidence}</span></div>
      <p className="macro-muted">{cycle.length}</p>
      <Timeline cycle={cycle} today={today} />
      <ul className="macro-cycle__legend">
        {(Object.keys(KIND_LABEL) as BandKind[]).filter(k => cycle.bands.some(b => b.kind === k)).map(k => <li key={k}><i className={`macro-cycle__swatch macro-cycle__band--${k}`} />{KIND_LABEL[k]}</li>)}
        <li><i className="macro-cycle__swatch macro-cycle__swatch--range" />当前大致范围</li>
      </ul>
      <p className="macro-cycle__verdict"><b>{cycle.now.from}–{cycle.now.to} 年：</b>{cycle.now.verdict}</p>
      {live}
      <div className="macro-two">
        <div><h4>判断理由</h4><ul>{cycle.reasons.map(t => <li key={t}>{t}</li>)}</ul></div>
        <div><h4>反证与局限</h4><ul>{cycle.counter.map(t => <li key={t}>{t}</li>)}</ul></div>
      </div>
      <details className="macro-cycle__bands">
        <summary>各阶段说明</summary>
        <ul>{cycle.bands.map(b => <li key={b.label + b.from}><b>{Math.floor(b.from)}–{Math.ceil(b.to)} {b.label}</b>：{b.note}</li>)}</ul>
      </details>
    </article>
  )
}

const todayYear = (d = new Date()): number => d.getFullYear() + d.getMonth() / 12

/** 把本站已有的读数接进来，让周期判断有数据佐证 */
function usLive(us: MacroSnapshot): React.ReactNode {
  const d = us.series.marginGdp
  const p = d?.long ? percentileOf(d.long, d.latest.value) : undefined
  return p === undefined ? null : <p className="macro-cycle__live">本站读数：美国保证金债务 ÷ GDP 当前 {d.latest.value.toFixed(2)}%，处于 1997 年以来的 {p}% 分位。</p>
}
function cnLive(cn: MacroSnapshot<CnKey> | null): React.ReactNode {
  const d = cn?.series.marginGdp
  const p = d?.long ? percentileOf(d.long, d.latest.value) : undefined
  return d && p !== undefined ? <p className="macro-cycle__live">本站读数：A 股融资余额 ÷ GDP 当前 {d.latest.value.toFixed(2)}%，处于 2010 年以来的 {p}% 分位。</p> : null
}

export function InventoryCard({ cn }: { cn: MacroSnapshot<CnKey> | null }): JSX.Element | null {
  const pmi = cn?.series.pmi?.latest, ppi = cn?.series.ppi?.latest
  if (!pmi || !ppi) return null
  const r = inventoryPhase(pmi.value, ppi.value)
  return (
    <article className="macro-card macro-cycle">
      <div className="macro-card__head"><h3>库存周期（基钦周期，约 3–4 年）</h3><span className="macro-badge macro-badge--blue">按规则计算，非预测</span></div>
      <p className="macro-cycle__verdict"><b>当前：{r.phase}</b>。{r.text}</p>
      <p className="macro-muted">规则：制造业 PMI 是否高于 50（需求），PPI 同比是否大于 0（价格），两者组合成四个阶段。读数：PMI {pmi.value}（{pmi.date.slice(0, 7)}），PPI 同比 {ppi.value}%（{ppi.date.slice(0, 7)}）。</p>
      <p className="macro-muted">局限：这是最粗的近似，真实的库存数据（工业企业产成品库存）更准确；PMI 在春节前后有季节性，单月读数会跳变。</p>
    </article>
  )
}

export function CyclesView({ us, cn }: { us: MacroSnapshot; cn: MacroSnapshot<CnKey> | null }): JSX.Element {
  const today = todayYear()
  return (
    <div className="macro-stack">
      <section className="macro-card macro-card--note" role="note">
        <h3>怎么读这一页</h3>
        <p>周期没有精确日期，也没有可靠的预测能力。下面画的是<b>大致范围</b>，每项都写了理由和反证。用法只有一个：帮你判断<b>长期回报预期和风险预算</b>，不是买卖信号，也不要拿它判断下个月的涨跌。</p>
      </section>
      <CycleCard cycle={KONDRATIEFF} today={today} />
      <CycleCard cycle={US_SECULAR} today={today} live={usLive(us)} />
      <CycleCard cycle={CN_MID} today={today} live={cnLive(cn)} />
      <InventoryCard cn={cn} />
    </div>
  )
}

/** 总览页的一句话摘要，点击进入周期页 */
export function CycleSummary({ cn }: { cn: MacroSnapshot<CnKey> | null }): JSX.Element {
  const pmi = cn?.series.pmi?.latest.value, ppi = cn?.series.ppi?.latest.value
  const inv = pmi !== undefined && ppi !== undefined ? inventoryPhase(pmi, ppi).phase : null
  return (
    <section className="macro-card" aria-label="周期位置">
      <div className="macro-card__head"><h3>周期位置（大致范围）</h3><Link to="/monitor?tab=cycles">看理由与时间轴 →</Link></div>
      <ul className="macro-mini">
        <li><span className="macro-mini__row" style={{ cursor: 'default' }}><span>康波</span><b>{KONDRATIEFF.now.verdict}</b></span></li>
        <li><span className="macro-mini__row" style={{ cursor: 'default' }}><span>美股长周期</span><b>{US_SECULAR.now.verdict.split('：')[0]}</b></span></li>
        <li><span className="macro-mini__row" style={{ cursor: 'default' }}><span>A 股牛熊</span><b>{CN_MID.now.verdict.split('，')[0]}</b></span></li>
        {inv && <li><span className="macro-mini__row" style={{ cursor: 'default' }}><span>库存周期</span><b>{inv}</b></span></li>}
      </ul>
      <p className="macro-muted">经验框架，置信度低，不用于择时。</p>
    </section>
  )
}
