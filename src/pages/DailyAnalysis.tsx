import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, RefreshCw } from 'lucide-react'
import { Badge, EmptyState, Page, PageToolbar } from '../components/ui'
import { loadDailyAnalysis, loadDailySnapshots } from '../features/daily-analysis/data'
import { BoardLadder, DataNotes, MarketOverview, MarketStats, Rankings, SectorFlows, timeText } from '../features/daily-analysis/Panels'
import { TrendSection } from '../features/daily-analysis/TrendSection'
import '../styles/daily-analysis.css'

export default function DailyAnalysis(): JSX.Element {
  const [snapshots, setSnapshots] = useState(loadDailySnapshots)
  const [selected, setSelected] = useState('latest')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const data = selected === 'latest' ? snapshots[0] : snapshots.find(snapshot => snapshot.dataDate === selected)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    setLoading(true)
    loadDailyAnalysis(controller.signal).then(result => {
      if (!active) return
      setSnapshots(result.snapshots); setError(result.liveError)
    }).catch(() => {
      if (active) setError(controller.signal.aborted ? '获取超时，继续显示已有快照；请稍后刷新。' : '最新数据获取失败，请稍后刷新。')
    }).finally(() => {
      clearTimeout(timer)
      if (active) setLoading(false)
    })
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [refresh])

  useEffect(() => {
    const timer = setInterval(() => {
      const beijing = new Date(Date.now() + 8 * 60 * 60 * 1000)
      const minutes = beijing.getUTCHours() * 60 + beijing.getUTCMinutes()
      const marketHours = ![0, 6].includes(beijing.getUTCDay()) && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 20
      if (selected === 'latest' && !loading && document.visibilityState === 'visible' && (marketHours || data?.session === 'intraday')) setRefresh(value => value + 1)
    }, 60000)
    return () => clearInterval(timer)
  }, [selected, loading, data?.session])

  return <Page title="每日分析" description="自动获取 A 股行情、涨跌停与连板复盘，保留交易日快照" className="daily-analysis">
    <PageToolbar note="A 股自动复盘 · 进入页面自动获取，盘中每分钟更新">
      <button className="tool-btn tool-btn--primary" type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} aria-hidden="true" />{loading ? '正在获取…' : '刷新数据'}</button>
    </PageToolbar>
    <div className="daily-dateline">
      <div><span className="daily-date-label">交易日</span><strong>{data ? <time dateTime={data.dataDate}>{data.dataDate}</time> : '等待数据'}</strong>{data && <Badge tone={data.session === 'intraday' ? 'warm' : 'accent'}>{selected !== 'latest' ? '历史快照' : data.session === 'intraday' ? '盘中数据' : data.session === 'previous' ? '最近交易日' : '收盘后采集'}</Badge>}</div>
      <label className="daily-date-picker">查看交易日<select aria-label="查看交易日" value={selected} onChange={event => setSelected(event.target.value)}><option value="latest">最新数据</option>{snapshots.map(snapshot => <option key={snapshot.dataDate} value={snapshot.dataDate}>{snapshot.dataDate} · 已存快照</option>)}</select></label>
    </div>
    {data && <p className="daily-note" role="status">采集时间：{timeText(data.fetchedAt)}（北京时间）{loading ? '。正在更新，继续显示已有快照…' : '。'}</p>}
    {error && <div className="ui-callout ui-callout--warn" role="alert">{error}</div>}
    {data ? <>
      <MarketOverview data={data} />
      <TrendSection snapshots={snapshots} selected={data.dataDate} onSelect={date => { setSelected(date); window.scrollTo?.({ top: 0 }) }} />
      <MarketStats data={data} />
      <BoardLadder data={data} />
      <Rankings data={data} />
      <SectorFlows data={data} />
      <DataNotes data={data} />
    </> : <EmptyState title={loading ? '正在获取自动复盘…' : '暂未取得复盘数据'}>{loading ? '正在核验行情日期和各项统计。' : '请刷新重试。'}</EmptyState>}
  </Page>
}
