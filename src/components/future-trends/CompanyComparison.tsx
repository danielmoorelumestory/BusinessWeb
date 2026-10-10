import React from 'react'
import FutureCompanyLink from '../FutureCompanyLink'
import { ResearchSummary } from '../../data/futureTrendsResearch'
import { presentation, priorityNames, priceLabel, percentLabel, dateLabel, displayText, winLabel, CAUTION } from '../../data/futureTrendsPresentation'

export default function CompanyComparison({ rows }: { rows: ResearchSummary[] }): JSX.Element {
  return <table className="ft-table"><caption className="visually-hidden">公司比较：推荐理由、价格条件、情景盈亏比与隐忧</caption>
    <thead><tr>{['公司 / 业务', '为什么看 · 等什么', '价格条件', '情景盈亏比', '主要隐忧'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead>
    <tbody>{rows.map(r => { const p = presentation(r); return <tr key={r.key}>
      <th scope="row"><span className={`ft-badge ft-badge--${p.priority}`}>{priorityNames[p.priority]}</span><strong className="ft-company"><FutureCompanyLink name={r.name} code={r.code} /></strong><small>{r.code}</small><small>{p.industry}</small>{CAUTION[r.key] && <small className="ft-wait"><span>注意</span>{CAUTION[r.key]}</small>}</th>
      <td data-label="为什么看 · 等什么"><p>{displayText(p.reason)}</p><p className="ft-wait"><span>等什么</span>{p.watch}</p></td>
      <td data-label="价格条件" className="ft-number"><strong>{priceLabel(r.price, r.currency)}</strong><small>{dateLabel(r.priceDate)} · 延迟报价</small><div className="ft-target">2:1 条件价<small>{priceLabel(r.threshold, r.currency)}</small></div></td>
      <td data-label="情景盈亏比" className="ft-number"><strong>{r.ratio === null ? '暂不适用' : `${r.ratio.toFixed(2)} : 1`}</strong><small>基准 {percentLabel(r.up)}</small><small>悲观 {percentLabel(r.down === null ? null : -r.down)}</small></td>
      <td data-label="主要隐忧"><p className="ft-concern">{displayText(r.concern)}</p><small>{winLabel(r)}</small><small>主观概率，非回测胜率</small></td>
    </tr> })}</tbody>
  </table>
}
