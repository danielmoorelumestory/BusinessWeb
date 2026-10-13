import React, { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageTabs, PageTitle, type TabItem } from '../components/ui/PageTabs'
import EtfView from '../features/national-team/EtfView'
import GuideView from '../features/national-team/GuideView'
import IndustriesView from '../features/national-team/IndustriesView'
import OverviewView from '../features/national-team/OverviewView'
import StocksView, { type StockFilters } from '../features/national-team/StocksView'
import TrendView from '../features/national-team/TrendView'
import { useNt } from '../features/national-team/data'
import type { EtfData, IndustryRow, NtChanges, NtMeta, NtSeries, StockRow } from '../features/national-team/types'
import '../features/national-team/national-team.css'
import { Page } from '../components/ui'

type TabId = 'overview' | 'stocks' | 'industries' | 'trend' | 'etf' | 'guide'
const TABS: TabItem<TabId>[] = [
  { id: 'overview', label: '总览' },
  { id: 'stocks', label: '个股' },
  { id: 'industries', label: '行业' },
  { id: 'trend', label: '走势' },
  { id: 'etf', label: 'ETF' },
  { id: 'guide', label: '口径说明' },
]

export default function NationalTeam(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: TabId = TABS.some(t => t.id === tabParam) ? (tabParam as TabId) : 'overview'
  const meta = useNt<NtMeta>('meta.json')
  const stocks = useNt<StockRow[]>(tab === 'stocks' || tab === 'overview' ? 'stocks.json' : null)
  const industries = useNt<IndustryRow[]>(tab === 'overview' || tab === 'industries' || tab === 'stocks' ? 'industries.json' : null)
  const changes = useNt<NtChanges>(tab === 'overview' ? 'changes.json' : null)
  const etf = useNt<EtfData>(tab === 'etf' ? 'etf.json' : null)
  const series = useNt<NtSeries>(tab === 'trend' || tab === 'industries' ? 'series.json' : null)

  const filters: StockFilters = {
    q: params.get('q') ?? '', group: params.get('g') ?? '', industry: params.get('ind') ?? '', onlyNew: params.get('new') === '1',
  }
  const go = useCallback((patch: Record<string, string | null>): void => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
      return next
    }, { replace: true })
  }, [setParams])

  const onFilters = (patch: Partial<StockFilters>): void => go({
    ...('q' in patch ? { q: patch.q || null } : {}),
    ...('group' in patch ? { g: patch.group || null } : {}),
    ...('industry' in patch ? { ind: patch.industry || null } : {}),
    ...('onlyNew' in patch ? { new: patch.onlyNew ? '1' : null } : {}),
  })
  const toStock = (code: string): void => go({ tab: 'stocks', q: code, g: null, ind: null, new: null })
  const toIndustry = (name: string): void => go({ tab: 'stocks', ind: name, q: null, g: null, new: null })

  const m = meta.data
  const failed = meta.error
  return (
    <div className="nt-page">
      <PageTitle>国家队持仓</PageTitle>
      <PageTabs label="国家队持仓栏目" items={TABS} value={tab} onChange={id => go({ tab: id === 'overview' ? null : id })} />
      <Page className="nt-main">
        {failed && <p className="nt-alert" role="alert">数据加载失败，请刷新重试。</p>}
        {!m && !failed && <p className="nt-muted">加载中…</p>}
        {m && (
          <>
            <p className="nt-stamp">
              报告期 <b>{m.reportDate}</b>
              {m.prevReportDate ? <>（对比 {m.prevReportDate}）</> : null}
              ，数据更新于 {m.generatedAt.slice(0, 10)}。十大流通股东季度披露，有 3 周到 4 个月的滞后，仅供了解背景，不是买卖信号。
              {m.checkedAt && ` 本轮核验 ${m.checkedAt.slice(0, 10)}；报告期保持 ${m.reportDate}，核验不代表新一期已披露。`}
            </p>
            {tab === 'overview' && (industries.data ? (
              <OverviewView meta={m} industries={industries.data} changes={changes.data} onStock={toStock} onIndustry={toIndustry} />
            ) : <p className="nt-muted">加载中…</p>)}
            {tab === 'stocks' && (stocks.data ? (
              <StocksView stocks={stocks.data} meta={m} filters={filters} onFilters={onFilters} />
            ) : <p className="nt-muted">加载中…</p>)}
            {tab === 'industries' && (industries.data ? (
              <IndustriesView industries={industries.data} series={series.data} onIndustry={toIndustry} />
            ) : <p className="nt-muted">加载中…</p>)}
            {tab === 'trend' && (series.data ? <TrendView series={series.data} meta={m} /> : <p className="nt-muted">加载中…</p>)}
            {tab === 'etf' && (etf.data ? <EtfView data={etf.data} /> : etf.error ? <p className="nt-alert" role="alert">ETF 数据加载失败，请刷新重试。</p> : <p className="nt-muted">加载中…</p>)}
            {tab === 'guide' && <GuideView meta={m} />}
          </>
        )}
      </Page>
    </div>
  )
}
