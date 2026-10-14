import React from 'react'
import { Link } from 'react-router-dom'
import metricsData from '../data/bondFundMetrics.json'
import { latestInvestmentNote } from '../utils/etfJudgment'
import EtfDocumentRemark from './EtfDocumentRemark'
import type { SelectedEtfItem } from './BroadEtfList'

const metrics: Record<string, Omit<(typeof metricsData)['000015'], 'return3yPct'> & { return3yPct: number | null }> = metricsData

const BOND_RISK_LADDER = [
  {
    type: '纯债',
    levelClass: 'pure',
    scope: '不投股票',
    feature: '只买债券',
    drawdown: '回撤约 -1%~-2%',
  },
  {
    type: '一级债基',
    levelClass: 'tier1',
    scope: '不直接买股票',
    feature: '可投可转债',
    drawdown: '回撤约 -2%~-3%',
  },
  {
    type: '二级债基',
    levelClass: 'tier2',
    scope: '可主动买股票',
    feature: '股票 ≤20%',
    drawdown: '回撤约 -5%~-10%',
  },
  {
    type: '混合偏债',
    levelClass: 'hybrid',
    scope: '股票比例更高',
    feature: '债券+股票均衡',
    drawdown: '回撤可 >10%',
  },
] as const

export default function BondFundList({ id, title, items }: {
  id: string; title: string; description?: string; items: SelectedEtfItem[]
}): JSX.Element {
  const sortedItems = [...items].sort((a, b) =>
    Math.abs(metrics[a.code].maxDrawdownPct) - Math.abs(metrics[b.code].maxDrawdownPct)
    || a.code.localeCompare(b.code))
  return (
    <section id={id} className="industry-group-section" aria-labelledby={`${id}-title`}>
      <div className="industry-group-card">
        <div className="industry-group-header">
          <h2 id={`${id}-title`} className="industry-group-title">{title}</h2>
          <span className="industry-group-count">{items.length} 只</span>
        </div>
        <div className="bond-ladder-container">
          <div className="bond-ladder-header">
            <span className="bond-ladder-title">风险 / 收益 由低到高</span>
            <span className="bond-ladder-arrow" aria-hidden="true">低波稳健 ──▶ 股债弹性</span>
          </div>
          <div className="bond-ladder-grid">
            {BOND_RISK_LADDER.map(item => (
              <div key={item.type} className={`bond-ladder-card bond-ladder-card--${item.levelClass}`}>
                <div className="bond-ladder-type-row">
                  <span className={`bond-ladder-type-badge bond-ladder-type-badge--${item.levelClass}`}>{item.type}</span>
                  <span className="bond-ladder-drawdown">{item.drawdown}</span>
                </div>
                <div className="bond-ladder-body">
                  <div className="bond-ladder-text">{item.scope}</div>
                  <div className="bond-ladder-text-sub">{item.feature}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="industry-table-wrapper">
          <table className="report-table industry-etf-table broad-etf-table bond-fund-table">
            <colgroup>
              <col style={{ width: '70px' }} /><col style={{ width: '130px' }} />
              <col style={{ width: '95px' }} /><col style={{ width: '85px' }} />
              <col style={{ width: '85px' }} />
              <col style={{ width: '160px' }} /><col /><col style={{ width: '82px' }} />
            </colgroup>
            <thead><tr><th>代码</th><th>名称</th><th>收益</th><th aria-sort="ascending" title="按回撤绝对值从小到大排序">最大回撤</th><th>基金经理</th><th>费用</th><th>备注</th><th>参考</th></tr></thead>
            <tbody>{sortedItems.map(item => {
              const slug = latestInvestmentNote(item.code)?.slug
              const data = metrics[item.code]
              const returnVal = data?.returnPct ?? data?.return3yPct
              return <tr key={item.code}>
                <td className="etf-code-cell">{slug ? <Link className="etf-code-link" to={`/notes/${slug}`}>{item.code}</Link> : item.code}</td>
                <td className="etf-name-cell">
                  <div>{slug ? <Link className="etf-name-link" to={`/notes/${slug}`}>{item.name}</Link> : item.name}</div>
                  {data?.bondType && (
                    <div className="bond-type-tags">
                      <span className={`bond-type-badge bond-type-badge--${data.bondType === '普通纯债' ? 'pure' : 'enhanced'}`}>
                        {data.bondType}
                      </span>
                      {data.bondFeature && <span className="bond-feature-badge">{data.bondFeature}</span>}
                    </div>
                  )}
                </td>
                <td className="bond-fund-metric">
                  {returnVal != null ? (
                    <>
                      {`${returnVal >= 0 ? '+' : ''}${returnVal.toFixed(2)}%`}
                      {data?.returnPeriodLabel && <small title={`${data.returnStart}至${data.asOf}`}>{data.returnPeriodLabel}</small>}
                    </>
                  ) : <span className="etf-empty-cell">—</span>}
                </td>
                <td className="bond-fund-metric">
                  {data?.maxDrawdownPct != null ? `${data.maxDrawdownPct.toFixed(2)}%` : '—'}
                  {data && <small title={`${data.drawdownStart}至${data.asOf}`}>{data.drawdownPeriodLabel}</small>}
                </td>
                <td>{data?.manager ?? '—'}</td>
                <td className="etf-fee-cell">
                  {data ? (
                    <>
                      <div className="etf-fee-main">
                        <span className="etf-fee-total">{data.annualFeePct.toFixed(2)}%<small>/年</small></span>
                        <span className="etf-fee-breakdown">{`管${data.managementFeePct.toFixed(2)}+托${data.custodyFeePct.toFixed(2)}`}</span>
                      </div>
                      <div className="etf-fee-rule">{data.redemptionRule}</div>
                    </>
                  ) : <span className="etf-empty-cell">—</span>}
                </td>
                <td className="etf-remark-cell"><EtfDocumentRemark code={item.code} /></td>
                <td className="etf-ref-cell">
                  {slug && <div><Link className="etf-ref-link" to={`/notes/${slug}`}>分析报告</Link></div>}
                  <a className="etf-ref-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">基金档案 ↗</a>
                </td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
