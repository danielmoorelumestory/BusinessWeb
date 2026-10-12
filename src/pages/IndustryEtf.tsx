import React from 'react'
import { Link } from 'react-router-dom'
import { NOTES } from '../data/notes'
import { INDUSTRY_ETF_DISCLAIMER, INDUSTRY_GROUPS, TOTAL_ETF_COUNT, internalNoteSlug, type EtfItem } from '../data/industryEtf'

// 该 ETF 自己的研究笔记：笔记 slug 以「代码-」开头（如 159928-consumer-etf-analysis）。
const etfNoteOf = (item: EtfItem) => NOTES.find(note => note.slug.startsWith(`${item.code}-`))

function Reference({ item }: { item: EtfItem }): JSX.Element | null {
  const own = etfNoteOf(item)
  if (!item.referenceUrl) return own ? <Link to={`/notes/${own.slug}`}>{own.title}</Link> : null
  const slug = internalNoteSlug(item.referenceUrl)
  const label = item.referenceTitle || '参考'
  if (slug) return <Link to={`/notes/${slug}`}>{label}</Link>
  return <a href={item.referenceUrl} target="_blank" rel="noopener noreferrer">{label}</a>
}

function NoteCells({ item }: { item: EtfItem }): JSX.Element {
  // 有研究笔记就点代码/名称直接跳转；优先该 ETF 自己的分析笔记，其次是清单里登记的站内参考。
  const slug = etfNoteOf(item)?.slug ?? internalNoteSlug(item.referenceUrl)
  if (!slug) return <><td>{item.code}</td><td>{item.name}</td></>
  const to = `/notes/${slug}`
  return <><td><Link to={to}>{item.code}</Link></td><td><Link to={to}>{item.name}</Link></td></>
}

export default function IndustryEtf(): JSX.Element {
  return (
    <main className="container animate-fade-in">
      <header className="page-head">
        <h1>行业 ETF 清单</h1>
        <p>{INDUSTRY_GROUPS.length} 个行业组，共 {TOTAL_ETF_COUNT} 只 ETF。宽基、因子与主题的流派说明请看「ETF 流派地图」。</p>
        <p className="etf-guide__disclaimer">{INDUSTRY_ETF_DISCLAIMER}</p>
        <nav className="etf-guide__nav" aria-label="行业目录">
          {INDUSTRY_GROUPS.map(g => <a key={g.id} href={`#${g.id}`} className="tag">{g.name} {g.items.length}</a>)}
        </nav>
      </header>

      {INDUSTRY_GROUPS.map(group => (
        <section key={group.id} id={group.id} className="hub-group" aria-labelledby={`${group.id}-title`}>
          <h2 id={`${group.id}-title`}>{group.index} {group.name}（{group.items.length}）</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="report-table">
              <thead>
                <tr><th>代码</th><th>名称</th><th>市场</th><th>子主题</th><th>备注</th><th>参考</th></tr>
              </thead>
              <tbody>
                {group.items.map(item => (
                  <tr key={`${item.code}-${item.market}`}>
                    <NoteCells item={item} />
                    <td>{item.market}</td>
                    <td>{item.subTheme}</td>
                    <td>{item.remark}</td>
                    <td><Reference item={item} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  )
}
