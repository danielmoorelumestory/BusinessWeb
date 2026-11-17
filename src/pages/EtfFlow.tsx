import React, { useEffect, useState } from 'react'
import { Page, PageTabs, Stat, StatGrid, EmptyState } from '../components/ui'
import { EtfFlowChart, type FlowPoint } from '../components/etf-flow/EtfFlowChart'
import '../components/etf-flow/etf-flow.css'

export interface EtfFlowData {
  series: FlowPoint[]
  kpi: { all: { yesterday: number; cum60: number }; broad: { yesterday: number; cum60: number } }
  note: string
  updated: string
  sample?: boolean
}

type Scope = 'all' | 'broad'
const fmt = (v: number): string => (v >= 0 ? '+' : '') + v.toFixed(2)

const EMPTY: EtfFlowData = {
  series: [], kpi: { all: { yesterday: 0, cum60: 0 }, broad: { yesterday: 0, cum60: 0 } }, note: '', updated: '',
}

/** 纯展示：由 data prop 驱动，便于测试。 */
export function EtfFlowView({ data }: { data: EtfFlowData }): JSX.Element {
  const [scope, setScope] = useState<Scope>('all')
  const k = data.kpi?.[scope] ?? { yesterday: 0, cum60: 0 }
  const empty = !data.series?.length
  const broadReady = (data.series ?? []).some(s => s.flow_broad != null)

  return (
    <Page
      title="ETF 资金净流入"
      description="全A / 宽基 ETF 日度申购净流入（同花顺原口径）+ 上证指数叠加，看资金进出的大周期趋势">
      <PageTabs<Scope>
        label="口径"
        items={[{ id: 'all', label: '全A' }, { id: 'broad', label: '宽基' }]}
        value={scope}
        onChange={setScope}
      />
      {empty ? (
        <EmptyState title="暂无数据">首次快照尚未产出，收盘后自动更新。</EmptyState>
      ) : scope === 'broad' && !broadReady ? (
        <EmptyState title="宽基口径待接入">宽基/行业等分口径的合成码仍在接入，先看全A。</EmptyState>
      ) : (
        <>
          <StatGrid>
            <Stat className={`etf-kpi etf-kpi--${k.yesterday >= 0 ? 'up' : 'down'}`} label="昨日净流入（亿元）" value={fmt(k.yesterday)} />
            <Stat className={`etf-kpi etf-kpi--${k.cum60 >= 0 ? 'up' : 'down'}`} label="近 60 日累计（亿元）" value={fmt(k.cum60)} />
          </StatGrid>
          <EtfFlowChart series={data.series} scope={scope} />
          {data.note && <p className="etf-flow__note">{data.note}</p>}
          {data.updated && <p className="etf-flow__foot">更新于 {data.updated.replace('T', ' ').replace(/\..*$/, '')}</p>}
        </>
      )}
    </Page>
  )
}

/** 路由容器：取 /data/etf-flow.json，交给纯展示组件。 */
export default function EtfFlow(): JSX.Element {
  const [data, setData] = useState<EtfFlowData | null>(null)
  useEffect(() => {
    let live = true
    fetch(`${import.meta.env.BASE_URL}data/etf-flow.json`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<EtfFlowData> })
      .then(d => { if (live) setData(d) })
      .catch(() => { if (live) setData(EMPTY) })
    return () => { live = false }
  }, [])
  return <EtfFlowView data={data ?? EMPTY} />
}
