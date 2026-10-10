import React, { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { OverviewTab } from '../components/monitor/OverviewTab'
import { IndicatorsTab } from '../components/monitor/IndicatorsTab'
import { TemperatureTab } from '../components/monitor/TemperatureTab'
import { ChinaTemperatureTab } from '../components/monitor/ChinaTemperatureTab'
import { StagesTab } from '../components/monitor/StagesTab'
import { ExecutionTab } from '../components/monitor/ExecutionTab'
import { USMonitorTab } from '../components/monitor/USMonitorTab'
import { ChinaStockTab } from '../components/monitor/ChinaStockTab'
import { PageTabs, PageTitle, Segmented, type TabItem } from '../components/ui/PageTabs'
import { CyclesView } from '../features/macro/CycleViews'
import { ValuationView } from '../features/macro/ValuationView'
import type { IndexSnapshot } from '../features/macro/valuation'
import { ChinaView, GuideView, HkView, OverviewView, StagesView, UsView } from '../features/macro/MacroViews'
import type { MacroSnapshot } from '../features/macro/indicators'
import type { CnKey } from '../features/macro/china'
import type { HkKey } from '../features/macro/hk'

type TabId = 'overview' | 'us' | 'cn' | 'hk' | 'cycles' | 'valuation' | 'stages' | 'guide' | 'archive'
const TABS: TabItem<TabId>[] = [
  { id: 'overview', label: '温度总览' },
  { id: 'us', label: '美国宏观' },
  { id: 'cn', label: '中国宏观' },
  { id: 'hk', label: '港股宏观' },
  { id: 'cycles', label: '周期位置' },
  { id: 'valuation', label: '估值位置' },
  { id: 'stages', label: '阶段与动作' },
  { id: 'guide', label: '指标说明' },
  { id: 'archive', label: '旧版存档' },
]

// 旧版内容以期权情绪、做空与个股仓位为主，和书中方法不一致；保留原样，仅供查阅
type ArchiveId = 'execution' | 'stages' | 'us-monitor' | 'overview' | 'china-stock' | 'indicators' | 'temperature' | 'china-temperature'
const ARCHIVE: (TabItem<ArchiveId> & { el: () => JSX.Element })[] = [
  { id: 'execution', label: '日常执行', el: () => <ExecutionTab /> },
  { id: 'stages', label: '阶段划分', el: () => <StagesTab /> },
  { id: 'us-monitor', label: '美经监控', el: () => <USMonitorTab /> },
  { id: 'overview', label: '投资总纲', el: () => <OverviewTab /> },
  { id: 'china-stock', label: '中股投资', el: () => <ChinaStockTab /> },
  { id: 'indicators', label: '指标体系', el: () => <IndicatorsTab /> },
  { id: 'temperature', label: '美经温度', el: () => <TemperatureTab /> },
  { id: 'china-temperature', label: '中经温度', el: () => <ChinaTemperatureTab /> },
]

// 快照只请求一次，切走再回来直接用
type Snapshots = { us: MacroSnapshot; cn: MacroSnapshot<CnKey> | null; hk: MacroSnapshot<HkKey> | null }
let snapshotCache: Snapshots | null = null
const load = (file: string, init?: RequestInit) => fetch(`${import.meta.env.BASE_URL}data/${file}`, init).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
// 本地开发由 Vite 中间件在本机拉取；Vercel 走同源函数；GitHub Pages 通过 VITE_API_BASE 调 Vercel
const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

/** 实时结果覆盖快照；某项没拉到时沿用快照里的旧值 */
export function mergeSnapshot<T extends MacroSnapshot<string>>(old: T | null, fresh: T | undefined): T | null {
  if (!fresh || !Object.keys(fresh.series).length) return old
  return { ...fresh, series: { ...(old?.series ?? {}), ...fresh.series } } as T
}
const timeText = (iso: string) => new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

let indexCache: IndexSnapshot | null = null

export default function Monitor(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const [indexes, setIndexes] = useState<IndexSnapshot | null>(indexCache)
  const [indexError, setIndexError] = useState(false)
  const tabParam = params.get('tab')
  const tab: TabId = TABS.some(t => t.id === tabParam) ? (tabParam as TabId) : 'overview'
  const archiveParam = params.get('old')
  const archive: ArchiveId = ARCHIVE.some(a => a.id === archiveParam) ? (archiveParam as ArchiveId) : 'execution'
  const [data, setData] = useState<Snapshots | null>(snapshotCache)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState('')

  /** 拉取实时数据；成功返回新快照（AI 解读会先调用它，保证解读的是最新数据） */
  const refresh = async (): Promise<Snapshots | null> => {
    setRefreshing(true); setNotice('')
    try {
      const res = await fetch(`${apiBase}/api/macro`, { cache: 'no-store' })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.us) throw new Error(body?.error || '数据源暂时不可用')
      const us = mergeSnapshot(data?.us ?? null, body.us)!
      snapshotCache = { us, cn: mergeSnapshot(data?.cn ?? null, body.cn), hk: mergeSnapshot(data?.hk ?? null, body.hk) }
      setData(snapshotCache)
      const missing = (body.warnings as string[] | undefined)?.length ?? 0
      setNotice(`已刷新：实时数据拉取于 ${timeText(body.us.fetchedAt)}${missing ? `；${missing} 项没拉到，沿用快照` : ''}`)
      return snapshotCache
    } catch (e) {
      setNotice(`刷新失败：${e instanceof Error ? e.message : '数据源暂时不可用'}，仍显示快照数据`)
      return null
    } finally { setRefreshing(false) }
  }

  useEffect(() => {
    if (snapshotCache) return
    // 中国数据失败不影响美国部分
    Promise.all([load('macro-us.json'), load('macro-cn.json').catch(() => null), load('macro-hk.json').catch(() => null)])
      .then(([us, cn, hk]: [MacroSnapshot, MacroSnapshot<CnKey> | null, MacroSnapshot<HkKey> | null]) => { snapshotCache = { us, cn, hk }; setData(snapshotCache) })
      .catch(() => setError('宏观数据加载失败，请刷新重试。'))
  }, [])

  useEffect(() => {
    if (params.get('tab') !== 'valuation') return
    // 每次进页签都向服务器校验一次：数据文件会随更新变化，不能沿用浏览器或模块里的旧副本
    load('index-history.json', { cache: 'no-cache' }).then((d: IndexSnapshot) => { indexCache = d; setIndexes(d) }).catch(() => setIndexError(true))
  }, [params])

  const go = (patch: Record<string, string | null>): void => setParams(prev => {
    const next = new URLSearchParams(prev)
    Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)))
    return next
  }, { replace: true })

  const needsData = tab !== 'archive' && tab !== 'valuation'
  const snap = data?.us
  return (
    <div style={{ minHeight: '100vh' }}>
      <PageTitle>宏观温度</PageTitle>
      <PageTabs label="宏观温度栏目" items={TABS} value={tab} onChange={id => go({ tab: id === 'overview' ? null : id, old: null })} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 40px' }}>
        {needsData && !snap && <p role={error ? 'alert' : 'status'} className="macro-muted">{error || '正在加载宏观数据…'}</p>}
        {snap && needsData && (
          <div className="page-toolbar">
            <span className="page-toolbar__note" role="status">{notice || (snap.fetchedAt ? `实时数据 · 拉取于 ${timeText(snap.fetchedAt)}` : `当前为 ${snap.generatedAt} 的快照，可刷新获取最新读数`)}</span>
            <button type="button" className="tool-btn tool-btn--primary" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? '正在拉取…' : '刷新最新数据'}
            </button>
          </div>
        )}
        {snap && tab === 'overview' && <OverviewView snap={snap} cn={data.cn} hk={data.hk} onRefresh={refresh} />}
        {snap && tab === 'us' && <UsView snap={snap} />}
        {snap && tab === 'cn' && (data.cn ? <ChinaView snap={data.cn} /> : <p role="alert" className="macro-muted">中国数据加载失败，请刷新重试。</p>)}
        {snap && tab === 'hk' && (data.hk ? <HkView snap={data.hk} /> : <p role="alert" className="macro-muted">港股数据加载失败，请刷新重试。</p>)}
        {snap && tab === 'cycles' && <CyclesView us={snap} cn={data.cn} />}
        {tab === 'valuation' && (indexes ? <ValuationView data={indexes} onData={d => { indexCache = d }} /> : <p role={indexError ? 'alert' : 'status'} className="macro-muted">{indexError ? '指数数据加载失败，请刷新重试。' : '正在加载指数数据…'}</p>)}
        {snap && tab === 'stages' && <StagesView snap={snap} />}
        {snap && tab === 'guide' && <GuideView snap={snap} cn={data.cn} hk={data.hk} />}
        {tab === 'archive' && (
          <>
            <p className="macro-archive-note" role="note">
              已停用：旧版以期权情绪（Put/Call、Gamma）、做空工具和具体个股仓位为主，数据停在 2025 年底，和书中「不预测、不做空、不加杠杆」的方法不一致。保留原样，仅供回看，不再更新。
            </p>
            <Segmented label="旧版栏目" items={ARCHIVE} value={archive} onChange={id => go({ old: id })} />
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
              {ARCHIVE.find(a => a.id === archive)!.el()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
