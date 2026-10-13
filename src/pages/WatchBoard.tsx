import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { Page, PageToolbar } from '../components/ui'
import { PageTitle } from '../components/ui/PageTabs'
import { fetchMarketDataByType } from '../services/api'
import { signalValues, stageFromSnapshot, type MacroSnapshot } from '../features/macro/indicators'
import { SIGNALS, signalTone } from '../features/macro/stages'
import { useMacroSnapshot } from '../features/macro/useMacroSnapshot'
import { loadDailyAnalysis, loadDailySnapshots } from '../features/daily-analysis/data'
import type { DailySnapshot } from '../features/daily-analysis/types'
import { MARKET_GROUPS, moodOf, readQuoteCache, writeQuoteCache, type QuoteCache, type QuoteRow } from '../features/watch/sentiment'
import '../styles/watch.css'

const KEY_READINGS: Array<{ key: 'vix' | 'tenYear' | 'hy' | 'dxy' | 'gold' | 'wti'; name: string; digits: number; unit: string }> = [
  { key: 'vix', name: 'VIX', digits: 1, unit: '' },
  { key: 'tenYear', name: '10 年美债', digits: 2, unit: '%' },
  { key: 'hy', name: '高收益债利差', digits: 0, unit: 'bp' },
  { key: 'dxy', name: '美元指数', digits: 1, unit: '' },
  { key: 'gold', name: '黄金', digits: 0, unit: '' },
  { key: 'wti', name: 'WTI 原油', digits: 1, unit: '' },
]

const fmt = (n: number, digits = 2): string => n.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const signed = (n: number): string => `${n > 0 ? '+' : ''}${fmt(n)}%`
const toneClass = (change: number, redUp: boolean): string => change === 0 ? 'is-flat' : (change > 0) === redUp ? 'is-red' : 'is-green'

function BlockHead({ title, note, to, link }: { title: string; note?: string; to: string; link: string }): JSX.Element {
  return (
    <header className="watch-block__head">
      <div><h2>{title}</h2>{note && <p>{note}</p>}</div>
      <Link to={to} className="watch-more">{link}<ArrowRight size={14} aria-hidden="true" /></Link>
    </header>
  )
}

function MacroBlock({ snap, error, tick }: { snap: MacroSnapshot | null; error: boolean; tick: number }): JSX.Element {
  if (!snap) return <section className="watch-block" aria-label="宏观阶段"><BlockHead title="宏观阶段" to="/monitor" link="宏观温度" /><p className="watch-muted" role={error ? 'alert' : 'status'}>{error ? '宏观数据加载失败。' : '正在加载宏观数据…'}</p></section>
  const { stage, score, entered } = stageFromSnapshot(snap)
  return (
    <section className={`watch-block watch-macro is-${stage.tone}`} aria-label="宏观阶段">
      <BlockHead title="宏观阶段" note={`美国六项风险信号 · 快照 ${snap.generatedAt}`} to="/monitor" link="宏观温度" />
      <div className="watch-stage">
        <strong className="watch-stage__name">{stage.name}</strong>
        <span className="watch-stage__score">{score} 分 · {entered}/{SIGNALS.length} 项</span>
      </div>
      <p className="watch-stage__summary">{stage.summary}</p>
      <p className="watch-stage__rule"><span>做</span>{stage.does[0]}</p>
      <p className="watch-stage__rule is-dont"><span>不做</span>{stage.doesNot[0]}</p>
      <ul className="watch-signals" aria-label="六项风险信号">
        {SIGNALS.map(sig => {
          const v = signalValues(snap)[sig.id]
          const tone = v === undefined ? 'gray' : signalTone(sig, v)
          const date = snap.series[sig.id as keyof typeof snap.series]?.latest.date
          return (
            <li key={sig.id} className={`tone-${tone}`}>
              <span className="watch-signals__name">{sig.name}</span>
              <b>{v === undefined ? '暂缺' : `${fmt(v, v < 10 ? 2 : 0)}${sig.unit && sig.unit !== 'pp' ? ` ${sig.unit}` : ''}`}</b>
              <small>{tone === 'gray' ? '未接入' : tone === 'green' ? '正常' : tone === 'yellow' ? '预警' : '危险'}{date ? ` · ${date.slice(5)}` : ''}</small>
            </li>
          )
        })}
      </ul>
      <dl className="watch-readings">
        {KEY_READINGS.filter(r => snap.series[r.key]).map(r => {
          const d = snap.series[r.key]
          return <div key={r.key}><dt>{r.name}</dt><dd>{fmt(d.latest.value, r.digits)}{r.unit && <small>{r.unit}</small>}</dd><dd className="watch-date">{d.latest.date.slice(5)}</dd></div>
        })}
      </dl>
      <OptionSentiment tick={tick} />
    </section>
  )
}

interface SentimentData { equityPC: number | null; spxPC: number | null; pcDate?: string; vix: number | null; vix3m: number | null; vixDate?: string; gexBn: number | null; goldSilver: number | null }
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

/** 期权情绪摘要：与投资计划「情绪」页签同一个 /api/sentiment；取不到就整块不显示 */
function OptionSentiment({ tick }: { tick: number }): JSX.Element | null {
  const [d, setD] = useState<SentimentData | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`${API_BASE}/api/sentiment`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then((x: SentimentData) => { if (alive) setD(x) })
      .catch(() => { if (alive) setD(null) })
    return () => { alive = false }
  }, [tick])
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  if (!d) return null
  const items: Array<[string, string]> = []
  if (num(d.equityPC)) items.push(['个股 P/C', fmt(d.equityPC)])
  if (num(d.spxPC)) items.push(['SPX P/C', fmt(d.spxPC)])
  if (num(d.vix) && num(d.vix3m)) items.push(['VIX 期限', d.vix > d.vix3m ? '倒挂' : d.vix >= d.vix3m * 0.9 ? '接近倒挂' : '正常'])
  if (num(d.gexBn)) items.push(['Net GEX', `${fmt(d.gexBn, 1)} 十亿`])
  if (num(d.goldSilver)) items.push(['金银比', fmt(d.goldSilver, 1)])
  if (!items.length) return null
  return (
    <div className="watch-optsent">
      <h3>期权情绪{d.pcDate ? <small>P/C {d.pcDate.slice(5)}</small> : null}</h3>
      <dl className="watch-readings">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <p className="watch-muted"><Link to="/investment-plan-2026?tab=sentiment">情绪解读 →</Link></p>
    </div>
  )
}

type GroupState = { rows: QuoteRow[]; source: 'live' | 'cache' | 'daily'; at?: string }

function MarketsBlock({ groups, loading }: { groups: Record<string, GroupState>; loading: boolean }): JSX.Element {
  return (
    <section className="watch-block watch-markets" aria-label="全球市场">
      <BlockHead title="全球市场" note="A股、港股红涨绿跌；美股绿涨红跌" to="/pulse" link="热力图与走势" />
      <div className="watch-groups">
        {MARKET_GROUPS.map(g => {
          const state = groups[g.id]
          const rows = state?.rows ?? []
          return (
            <div key={g.id} className="watch-group">
              <h3>{g.title}{state && state.source !== 'live' && <small>{state.source === 'daily' ? '复盘快照' : '缓存'}{state.at ? ` ${state.at}` : ''}</small>}</h3>
              {rows.length ? (
                <ul>
                  {rows.map(q => (
                    <li key={q.symbol || q.name}>
                      <span className="watch-q__name">{q.name}</span>
                      <span className="watch-q__price">{fmt(q.price)}</span>
                      <span className={`watch-q__chg ${toneClass(q.changePercent, g.redUp)}`}>{signed(q.changePercent)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="watch-muted">{loading ? '加载中…' : <>暂未取得，<Link to="/pulse">去全球行情看</Link></>}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function AShareBlock({ data, loading, error }: { data: DailySnapshot | undefined; loading: boolean; error: string | null }): JSX.Element {
  if (!data) return <section className="watch-block" aria-label="A股情绪"><BlockHead title="A股情绪" to="/daily-analysis" link="每日复盘" /><p className="watch-muted" role={error ? 'alert' : 'status'}>{loading ? '正在获取 A 股复盘…' : error ?? '暂未取得复盘数据'}</p></section>
  const m = data.metrics
  const { mood, reason } = moodOf(m)
  const up = m.upCount ?? 0, down = m.downCount ?? 0
  const stats: Array<[string, string]> = [
    ['涨停', m.ztCount === null ? '—' : `${m.ztCount}`],
    ['跌停', m.dtCount === null ? '—' : `${m.dtCount}`],
    ['封板率', m.ztSealRate === null ? '—' : `${fmt(m.ztSealRate, 0)}%`],
    ['连板', m.lbCount === null ? '—' : `${m.lbCount} 家`],
    ['最高板', m.maxBoard === null ? '—' : `${m.maxBoard} 板`],
    ['成交额', m.volume === null ? '—' : `${fmt(m.volume / 10000, 2)} 万亿`],
  ]
  return (
    <section className="watch-block watch-ashare" aria-label="A股情绪">
      <BlockHead title="A股情绪" note={`交易日 ${data.dataDate}${data.session === 'intraday' ? ' · 盘中' : ''}`} to="/daily-analysis" link="每日复盘" />
      <p className={`watch-mood is-${mood === '偏热' ? 'hot' : mood === '偏冷' ? 'cold' : 'mid'}`}><strong>{mood}</strong><span>{reason}。只描述当天情绪，不是买卖信号。</span></p>
      {up + down > 0 && (
        <div className="watch-breadth" aria-label={`上涨 ${up} 家，下跌 ${down} 家`}>
          <svg className="watch-breadth__bar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
            <rect className="watch-breadth__down" x="0" y="0" width="100" height="8" />
            <rect className="watch-breadth__up" x="0" y="0" width={(up / (up + down)) * 100} height="8" />
          </svg>
          <div className="watch-breadth__text"><span className="is-red">上涨 {up}</span><span className="is-green">下跌 {down}</span></div>
        </div>
      )}
      <dl className="watch-stats">{stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <div className="watch-flows">
        <div>
          <h3>资金流入板块</h3>
          <ol>{data.flows.inflow.slice(0, 5).map(f => <li key={f.name}><span>{f.name}</span><b className="is-red">+{fmt(f.amount, 1)} 亿</b></li>)}</ol>
        </div>
        <div>
          <h3>资金流出板块</h3>
          <ol>{data.flows.outflow.slice(0, 5).map(f => <li key={f.name}><span>{f.name}</span><b className="is-green">{fmt(f.amount, 1)} 亿</b></li>)}</ol>
        </div>
      </div>
      <p className="watch-links">
        <Link to="/sector-rotation">板块轮动 →</Link>
        <Link to="/limit-up-analysis">涨停板块 →</Link>
      </p>
    </section>
  )
}

/** 观察盘：宏观、全球、A 股三块一页看完；细节去各自的详情页 */
export default function WatchBoard(): JSX.Element {
  const { snap: macro, error: macroError } = useMacroSnapshot()
  const [live, setLive] = useState<Record<string, QuoteRow[]>>({})
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [daily, setDaily] = useState<DailySnapshot[]>(loadDailySnapshots)
  const [dailyLoading, setDailyLoading] = useState(true)
  const [dailyError, setDailyError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState('')
  const [tick, setTick] = useState(0)

  const load = useCallback((signal: AbortSignal) => {
    setQuotesLoading(true); setDailyLoading(true)
    Promise.all(MARKET_GROUPS.map(g => fetchMarketDataByType(g.id)
      .then(list => [g.id, g.names.flatMap(n => { const q = list.find(x => x.name === n); return q ? [{ symbol: q.symbol, name: q.name, price: q.price, changePercent: q.changePercent }] : [] })] as const)
      .catch(() => [g.id, [] as QuoteRow[]] as const)))
      .then(entries => {
        if (signal.aborted) return
        const at = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        const fresh = Object.fromEntries(entries)
        const cache = readQuoteCache()
        for (const [id, rows] of entries) if (rows.length) cache[id] = { at, rows }
        writeQuoteCache(cache)
        setLive(fresh)
        if (entries.some(([, rows]) => rows.length)) setUpdatedAt(at)
      })
      .finally(() => { if (!signal.aborted) setQuotesLoading(false) })
    loadDailyAnalysis(signal)
      .then(r => { if (!signal.aborted) { setDaily(r.snapshots); setDailyError(r.liveError) } })
      .catch(() => { if (!signal.aborted) setDailyError('最新复盘获取失败，显示已有快照。') })
      .finally(() => { if (!signal.aborted) setDailyLoading(false) })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, tick])

  // 实时行情优先；没取到的组用上次缓存；A股再退回到复盘快照里的指数
  const groups: Record<string, GroupState> = {}
  const cache: Record<string, QuoteCache> = readQuoteCache()
  for (const g of MARKET_GROUPS) {
    if (live[g.id]?.length) groups[g.id] = { rows: live[g.id], source: 'live' }
    else if (g.id === 'cn' && daily[0]?.indices.length) groups[g.id] = { rows: daily[0].indices.map(i => ({ symbol: i.code, name: i.name, price: i.price, changePercent: i.change })), source: 'daily', at: daily[0].dataDate.slice(5) }
    else if (cache[g.id]?.rows.length) groups[g.id] = { rows: cache[g.id].rows, source: 'cache', at: cache[g.id].at }
  }
  const busy = quotesLoading || dailyLoading
  return (
    <Page className="watch-page">
      <PageTitle>观察盘</PageTitle>
      <PageToolbar note={`一页看完宏观、全球和 A 股。看环境，不据此下单：只有宏观阶段变化才调整计划。${updatedAt ? ` 行情更新于 ${updatedAt}` : ''}`}>
        <button type="button" className="tool-btn tool-btn--primary" disabled={busy} onClick={() => setTick(n => n + 1)}>
          <RefreshCw size={15} aria-hidden="true" className={busy ? 'animate-spin' : undefined} />{busy ? '正在更新…' : '刷新'}
        </button>
      </PageToolbar>
      <div className="watch-grid">
        <MacroBlock snap={macro} error={macroError} tick={tick} />
        <MarketsBlock groups={groups} loading={quotesLoading} />
        <AShareBlock data={daily[0]} loading={dailyLoading} error={dailyError} />
      </div>
    </Page>
  )
}
