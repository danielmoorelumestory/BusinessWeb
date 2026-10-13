import React, { useEffect, useId, useMemo, useState } from 'react'
import { Card } from '../ui'
import { aggregateCandles, combineAmount, combineVolume, fetchHistory, periodKey, periods } from './chinaHistory'
import type { HistoryCandle, HistorySymbol, Period } from './chinaHistory'
import '../../styles/china-market.css'

const number = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const chinaDate = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })

function HistoryPlot({ rows, metric, title, period, previousClose }: { rows: HistoryCandle[]; metric: 'price' | 'volume' | 'amount'; title: string; period: Period; previousClose?: number }) {
  const bars = metric !== 'price'
  const unit = metric === 'amount' ? '亿元' : '亿股'
  const valueOf = (row: HistoryCandle) => metric === 'amount' ? row.amount! : row.volume
  const [index, setIndex] = useState(rows.length - 1)
  const selected = Math.min(index, rows.length - 1)
  const row = rows[selected]
  const changeAt = (i: number) => {
    const previous = i > 0 ? rows[i - 1].close : previousClose
    return previous && previous > 0 ? (rows[i].close - previous) / previous * 100 : null
  }
  const changeText = (change: number | null) => change === null ? '—' : `${change > 0 ? '+' : change < 0 ? '-' : ''}${number(Math.abs(change))}%`
  const change = changeAt(selected)
  const id = useId()
  const width = 720, height = 265, left = 68, right = 12, top = 12, bottom = 30
  const plotWidth = width - left - right, plotHeight = height - top - bottom
  const low = bars ? 0 : Math.min(...rows.map(r => r.low))
  const high = bars ? Math.max(...rows.map(valueOf)) : Math.max(...rows.map(r => r.high))
  const padding = bars ? Math.max(high * .08, .01) : Math.max((high - low) * .08, high * .001)
  const min = bars ? 0 : low - padding, max = high + padding
  const y = (v: number) => top + (max - v) / (max - min) * plotHeight
  const step = plotWidth / rows.length, x = (i: number) => left + (i + .5) * step
  const body = Math.max(.8, Math.min(12, step * .65))
  const today = chinaDate()
  const current = periodKey(row.date, period) === periodKey(today, period)
  const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false })
  const ongoing = current && (period !== 'day' || time < '15:30:00')
  return <>
    <div className="china-chart__readout" aria-live="polite" aria-atomic="true">
      <span>{period === 'day' ? row.date : `${periodKey(row.date, period)}${period === 'week' ? ' 当周' : ''}`}<small> 截至 {row.date}{ongoing ? ' · 进行中' : ''}</small></span>
      {bars ? <strong>{number(valueOf(row))} {unit}</strong> : <span className="china-chart__ohlc">开 {number(row.open)}　高 {number(row.high)}　低 {number(row.low)}　收 <b className={row.close >= row.open ? 'china-chart__up' : 'china-chart__down'}>{number(row.close)}</b>　<span title="本期收盘价相对上一期收盘价的变化；缺少上一期数据时显示 —" className={change === null || change === 0 ? undefined : change > 0 ? 'china-chart__up' : 'china-chart__down'}>涨跌幅 {changeText(change)}</span></span>}
    </div>
    <svg className="china-chart__plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}${bars ? `柱状图，单位${unit}` : 'K线图，单位点；红涨绿跌'}`}
      onPointerMove={e => {
        const rect = e.currentTarget.getBoundingClientRect()
        if (rect.width) setIndex(Math.max(0, Math.min(rows.length - 1, Math.floor(((e.clientX - rect.left) / rect.width * width - left) / step))))
      }}>
      {[0, 1, 2, 3, 4].map(i => {
        const value = min + (max - min) * i / 4
        return <g key={i}><line className="china-chart__gridline" x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text x={left - 8} y={y(value) + 4} textAnchor="end">{value.toLocaleString('zh-CN', { maximumFractionDigits: bars ? 1 : 0 })}</text></g>
      })}
      {rows.map((r, i) => <g key={r.date} className={bars ? 'china-chart__volume' : r.close >= r.open ? 'china-chart__up' : 'china-chart__down'}>
        <title>{r.date} {bars ? `${number(valueOf(r))} ${unit}` : `开 ${r.open} 高 ${r.high} 低 ${r.low} 收 ${r.close} 涨跌幅 ${changeText(changeAt(i))}`}</title>
        {!bars && <line x1={x(i)} x2={x(i)} y1={y(r.high)} y2={y(r.low)} stroke="currentColor" />}
        <rect x={x(i) - body / 2} y={bars ? y(valueOf(r)) : y(Math.max(r.open, r.close))} width={body}
          height={bars ? Math.max(.6, y(0) - y(valueOf(r))) : Math.max(1, Math.abs(y(r.open) - y(r.close)))} fill="currentColor" />
      </g>)}
      <line className="china-chart__crosshair" x1={x(selected)} x2={x(selected)} y1={top} y2={height - bottom} />
      {[0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}>{rows[i].date}</text>)}
    </svg>
    <div className="china-chart__scrub"><label htmlFor={id}>查看日期</label><input id={id} type="range" min={0} max={rows.length - 1} value={selected} onChange={e => setIndex(Number(e.target.value))} aria-valuetext={row.date} /><span>{row.date}</span></div>
  </>
}

function HistoryCard({ title, symbol, metric = symbol ? 'price' : 'volume' }: { title: string; symbol?: HistorySymbol; metric?: 'price' | 'volume' | 'amount' }) {
  const bars = metric !== 'price'
  const unit = metric === 'amount' ? '亿元' : '亿股'
  const activityLabel = metric === 'amount' ? '成交额' : '成交量'
  const [period, setPeriod] = useState<Period>('day')
  const [limit, setLimit] = useState(60)
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<{ rows: HistoryCandle[]; fetchedAt: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timer = setTimeout(() => controller.abort(), 12_000)
    setLoading(true); setError(''); setResult(null)
    const load = async () => {
      try {
        if (symbol) {
          const data = await fetchHistory(symbol, period, controller.signal, refresh > 0)
          if (active) setResult({ ...data, rows: aggregateCandles(data.rows, period) })
        } else {
          const [sh, sz] = await Promise.all([
            fetchHistory('sh000001', period, controller.signal, refresh > 0, metric === 'amount' ? 'amount' : 'volume'),
            fetchHistory('sz399106', period, controller.signal, refresh > 0, metric === 'amount' ? 'amount' : 'volume'),
          ])
          if (active) setResult({ rows: (metric === 'amount' ? combineAmount : combineVolume)(sh.rows, sz.rows, period), fetchedAt: sh.fetchedAt < sz.fetchedAt ? sh.fetchedAt : sz.fetchedAt })
        }
      } catch (e) {
        if (active) setError(controller.signal.aborted ? '行情请求超时，请重试' : e instanceof Error ? e.message : '行情暂时无法获取')
      } finally {
        clearTimeout(timer)
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [symbol, metric, period, refresh])
  const visible = useMemo(() => result ? limit === 0 ? result.rows : result.rows.slice(-limit) : [], [result, limit])
  return <Card as="section" title={title} label={title} className="china-chart"
    actions={<button className="tool-btn" onClick={() => setRefresh(n => n + 1)} disabled={loading}>刷新</button>}>
    <div className="china-chart__toolbar">
      <div className="china-chart__periods" role="group" aria-label={`${title}周期`}>
        {periods.map(p => <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}{bars ? '' : '线'}</button>)}
      </div>
      <label className="china-chart__range">显示 <select aria-label={`${title}显示范围`} value={limit} onChange={e => setLimit(Number(e.target.value))}>
        <option value={60}>最近60期</option><option value={120}>最近120期</option><option value={0}>可用历史</option>
      </select></label>
      <span className="china-chart__unit">{bars ? `${unit} · 期间累计` : '点 · 红涨绿跌'}</span>
    </div>
    {loading ? <div className="china-chart__status" role="status">正在加载{title}历史行情…</div>
      : error ? <div className="china-chart__status" role="alert"><p>{error}</p><button className="tool-btn" onClick={() => setRefresh(n => n + 1)}>重试</button></div>
        : visible.length > 0 && <HistoryPlot key={`${period}:${limit}:${refresh}`} rows={visible} metric={metric} title={title} period={period} previousClose={result?.rows[result.rows.length - visible.length - 1]?.close} />}
    <div className="china-chart__foot">
      <span>{bars ? `腾讯行情 · 上证综指 + 深证综指${activityLabel}；不含北交所、基金、债券` : `腾讯行情 · ${symbol} 指数原始价格`}</span>
      {result && <span>数据截至 {result.rows[result.rows.length - 1].date} · 获取于 {new Date(result.fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</span>}
      {period !== 'day' && <span>当前周期随交易更新；历史首期可能不足完整周期。</span>}
      {bars && ['month', 'year'].includes(period) && <span>长周期采用自 1997 年起的连续记录。</span>}
      {result && <span>可用历史：{result.rows[0].date} 至 {result.rows[result.rows.length - 1].date}（{result.rows.length}期）</span>}
    </div>
  </Card>
}

export default function ChinaMarketCharts() {
  return <div className="china-market-charts"><HistoryCard title="沪深300" symbol="sh000300" /><HistoryCard title="中证1000" symbol="sh000852" /><HistoryCard title="沪深两市成交量" /><HistoryCard title="沪深两市成交额" metric="amount" /></div>
}
