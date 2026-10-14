import React from 'react'
import { Link } from 'react-router-dom'
import EtfDocumentRemark from './EtfDocumentRemark'
import { latestInvestmentNote } from '../utils/etfJudgment'
import { BROAD_ETFS } from '../data/broadEtf'

export default function BroadEtfList(): JSX.Element {
  return <SelectedEtfList id="broad-etf" title="宽基 ETF 清单" items={BROAD_ETFS} countLabel={`${BROAD_ETFS.length} 类 · 每类 1 只`} />
}

export type SelectedEtfItem = Pick<(typeof BROAD_ETFS)[number], 'code' | 'name' | 'family' | 'category' | 'coverage' | 'sourceUrl'> & { gridApplicable?: boolean }

export function SelectedEtfList({ id, title, items, description, countLabel = `${items.length} 只` }: {
  id: string; title: string; items: SelectedEtfItem[]; description?: string; countLabel?: string
}): JSX.Element {
  return (
    <section id={id} className="industry-group-section" aria-labelledby={`${id}-title`}>
      <div className="industry-group-card">
        <div className="industry-group-header">
          <h2 id={`${id}-title`} className="industry-group-title">{title}</h2>
          <span className="industry-group-count">{countLabel}</span>
        </div>
        {description && <p className="industry-etf-group-description">{description}</p>}
        <div className="industry-table-wrapper">
          <table className="report-table industry-etf-table broad-etf-table">
            <colgroup>
              <col style={{ width: '92px' }} /><col style={{ width: '160px' }} />
              <col style={{ width: '230px' }} />
              <col /><col style={{ width: '92px' }} /><col style={{ width: '92px' }} />
            </colgroup>
            <thead><tr><th>代码</th><th>名称</th><th>标的与定位</th><th>备注</th><th>参考</th><th>网格</th></tr></thead>
            <tbody>{items.map(item => {
              const analysisSlug = latestInvestmentNote(item.code)?.slug
              return (
              <tr key={item.code}>
                <td className="etf-code-cell">{analysisSlug ? <Link className="etf-code-link" to={`/notes/${analysisSlug}`}>{item.code}</Link> : item.code}</td>
                <td className="etf-name-cell">{analysisSlug ? <Link className="etf-name-link" to={`/notes/${analysisSlug}`}>{item.name}</Link> : item.name}</td>
                <td className="etf-subtheme-cell"><strong>{item.family}</strong><div>{item.category}</div><p>{item.coverage}</p></td>
                <td className="etf-remark-cell"><EtfDocumentRemark code={item.code} /></td>
                <td className="etf-ref-cell">
                  {analysisSlug && <div><Link className="etf-ref-link" to={`/notes/${analysisSlug}`}>分析报告</Link></div>}
                  <a className="etf-ref-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">基金档案 ↗</a>
                </td>
                <td className="etf-grid-cell">{item.gridApplicable === false ? <span className="etf-empty-cell">不适用</span> : <a className="etf-ref-link" href={`/note/lab/grid-trading/detail/?code=${item.code}&name=${encodeURIComponent(item.name)}`}>行情·网格</a>}</td>
              </tr>
            )})}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
