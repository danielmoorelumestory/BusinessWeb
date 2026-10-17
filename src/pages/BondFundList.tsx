import React from 'react'
import { Link } from 'react-router-dom'
import metricsData from '../data/bondFundMetrics.json'
import { latestInvestmentNote } from '../utils/etfJudgment'
import EtfDocumentRemark from './EtfDocumentRemark'
import EtfIdentityCell from './EtfIdentityCell'
import type { SelectedEtfItem } from './BroadEtfList'

type BondFundMetric = {
  asOf: string
  bondType?: string
  bondFeature?: string
  inceptionDate?: string
  returnSinceInceptionPct?: number | null
  return3yPct: number | null
  returnPct?: number
  returnStart?: string
  returnPeriodLabel?: string
  return5yPct?: number | null
  return5yPeriodLabel?: string
  maxDrawdownPct: number
  drawdownStart?: string
  drawdownEnd?: string
  drawdownPeriodLabel?: string
  manager: string
  managementFeePct: number
  custodyFeePct: number
  annualFeePct: number
  redemptionRule: string
  redemptionTiers?: string
  feeFormatted: string
  highlight?: string
  feeSourceUrl: string
  feeSourceDate: string
  feeVerifiedOn: string
}

const metrics: Record<string, BondFundMetric> = metricsData as Record<string, BondFundMetric>

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

const BOND_TYPE_ORDER: Record<string, number> = {
  '纯债': 1,
  '普通纯债': 1,
  '一级债基': 2,
  '二级债基': 3,
  '混合偏债': 4,
}

export default function BondFundList({ id, title, items }: {
  id: string; title: string; description?: string; items: SelectedEtfItem[]
}): JSX.Element {
  const sortedItems = [...items].sort((a, b) => {
    const typeA = metrics[a.code]?.bondType ?? ''
    const typeB = metrics[b.code]?.bondType ?? ''
    const rankA = BOND_TYPE_ORDER[typeA] ?? 99
    const rankB = BOND_TYPE_ORDER[typeB] ?? 99
    if (rankA !== rankB) {
      return rankA - rankB
    }
    const ddA = Math.abs(metrics[a.code]?.maxDrawdownPct ?? 0)
    const ddB = Math.abs(metrics[b.code]?.maxDrawdownPct ?? 0)
    return ddA - ddB || a.code.localeCompare(b.code)
  })
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
        <p className="industry-etf-group-description">
          普通纯债2只、一级债基2只、二级债基3只；010011每笔份额最短持有6个月。<Link to="/notes/bond-fund-candidate-comparison-2026-10-14">查看同类筛选报告</Link>
        </p>
        <div className="industry-table-wrapper">
          <table className="report-table industry-etf-table broad-etf-table bond-fund-table">
            <colgroup>
              <col style={{ width: '240px' }} />
              <col style={{ width: '135px' }} /><col style={{ width: '135px' }} />
              <col style={{ width: '155px' }} />
              <col style={{ width: '300px' }} /><col /><col style={{ width: '100px' }} />
            </colgroup>
            <thead><tr><th className="etf-identity-heading">名称 / 代码</th><th>三年收益</th><th>五年收益</th><th title="分类内按历史回撤绝对值从小到大排序">历史最大回撤</th><th title="运作管理与托管费及持有期赎回费阶梯">费用</th><th>备注</th><th className="etf-reference-heading">参考</th></tr></thead>
            <tbody>{sortedItems.map(item => {
              const slug = latestInvestmentNote(item.code)?.slug
              const data = metrics[item.code]
              const return3yVal = data?.returnPct ?? data?.return3yPct
              const inceptionVal = data?.returnSinceInceptionPct ?? data?.returnPct
              return <tr key={item.code}>
                <EtfIdentityCell code={item.code} name={item.name} to={slug ? `/notes/${slug}` : undefined}>
                  {data?.bondType && (
                    <div className="bond-type-tags">
                      <span className={`bond-type-badge bond-type-badge--${data.bondType === '普通纯债' ? 'pure' : 'enhanced'}`}>
                        {data.bondType}
                      </span>
                      {data.bondFeature && <span className="bond-feature-badge">{data.bondFeature}</span>}
                    </div>
                  )}
                </EtfIdentityCell>
                <td className="bond-fund-metric">
                  {return3yVal != null ? (
                    <>
                      {`${return3yVal >= 0 ? '+' : ''}${return3yVal.toFixed(2)}%`}
                      {data?.returnPeriodLabel && <small title={`${data.returnStart}至${data.asOf}`}>{data.returnPeriodLabel}</small>}
                    </>
                  ) : <span className="etf-empty-cell">—</span>}
                </td>
                <td className="bond-fund-metric">
                  {data?.return5yPct != null ? (
                    <>
                      {`${data.return5yPct >= 0 ? '+' : ''}${data.return5yPct.toFixed(2)}%`}
                      {data.return5yPeriodLabel && <small>{data.return5yPeriodLabel}</small>}
                    </>
                  ) : inceptionVal != null && data?.inceptionDate ? (
                    <>
                      {`${inceptionVal >= 0 ? '+' : ''}${inceptionVal.toFixed(2)}%`}
                      <small title={`${data.inceptionDate}成立`}>{data.inceptionDate}</small>
                    </>
                  ) : (
                    <>
                      <span className="etf-empty-cell">—</span>
                      {data?.return5yPeriodLabel && <small>{data.return5yPeriodLabel}</small>}
                    </>
                  )}
                </td>
                <td className="bond-fund-metric">
                  {data?.maxDrawdownPct != null ? `${data.maxDrawdownPct.toFixed(2)}%` : '—'}
                  {data && <small title={`${data.drawdownStart}至${data.drawdownEnd ?? data.asOf}`}>{data.drawdownPeriodLabel}</small>}
                </td>
                <td className="etf-fee-cell">
                  {data ? (
                    <>
                      <div className="etf-fee-main">
                        <span className="etf-fee-total">{data.annualFeePct.toFixed(2)}%<small>/年</small></span>
                        <span className="etf-fee-breakdown">{`管${data.managementFeePct.toFixed(2)}+托${data.custodyFeePct.toFixed(2)}`}</span>
                      </div>
                      {(data.redemptionTiers || data.redemptionRule) && (
                        <div className="etf-fee-tiers" title={`赎回费率阶梯：${data.redemptionTiers ?? data.redemptionRule}`}>
                          <span className="etf-fee-tiers-label">赎回费：</span>
                          {data.redemptionTiers ?? data.redemptionRule}
                        </div>
                      )}
                    </>
                  ) : <span className="etf-empty-cell">—</span>}
                </td>
                <td className="etf-remark-cell"><EtfDocumentRemark code={item.code} /></td>
                <td className="etf-reference-cell">
                  {slug && <div><Link className="etf-ref-link" to={`/notes/${slug}`}>分析报告</Link></div>}
                  <a className="etf-ref-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">基金档案</a>
                </td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
