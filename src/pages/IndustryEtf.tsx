import React from 'react'
import { Link } from 'react-router-dom'
import { NOTES } from '../data/notes'
import { INDUSTRY_GROUPS, TOTAL_ETF_COUNT, internalNoteSlug, type EtfItem } from '../data/industryEtf'

// 该 ETF 自己的研究笔记：笔记 slug 以「代码-」开头（如 159928-consumer-etf-analysis）。
const etfNoteOf = (item: EtfItem) => NOTES.find(note => note.slug.startsWith(`${item.code}-`))

function Reference({ item }: { item: EtfItem }): JSX.Element {
  const own = etfNoteOf(item)
  if (!item.referenceUrl) {
    return own ? (
      <Link to={`/notes/${own.slug}`} className="etf-ref-link" title={own.title}>
        {own.title}
      </Link>
    ) : (
      <span className="etf-empty-cell">—</span>
    )
  }
  const slug = internalNoteSlug(item.referenceUrl)
  const label = item.referenceTitle || '参考'
  if (slug) {
    return (
      <Link to={`/notes/${slug}`} className="etf-ref-link" title={label}>
        {label}
      </Link>
    )
  }
  return (
    <a href={item.referenceUrl} target="_blank" rel="noopener noreferrer" className="etf-ref-link">
      {label} ↗
    </a>
  )
}

function NoteCells({ item }: { item: EtfItem }): JSX.Element {
  // 有研究笔记就点代码/名称直接跳转；优先该 ETF 自己的分析笔记，其次是清单里登记的站内参考。
  const slug = etfNoteOf(item)?.slug ?? internalNoteSlug(item.referenceUrl)
  if (!slug) {
    return (
      <>
        <td className="etf-code-cell">{item.code}</td>
        <td className="etf-name-cell">{item.name}</td>
      </>
    )
  }
  const to = `/notes/${slug}`
  return (
    <>
      <td className="etf-code-cell">
        <Link to={to} className="etf-code-link" title="查看分析笔记">
          {item.code}
        </Link>
      </td>
      <td className="etf-name-cell">
        <Link to={to} className="etf-name-link" title="查看分析笔记">
          {item.name}
        </Link>
      </td>
    </>
  )
}

// 网格详情页入口：已添加网格的 ETF 打开它的回测详情，没有添加的只显示行情曲线、支撑压力与斐波那契（不显示网格数据）。
// /note/ 是 notes 站点的静态页面，必须整页加载，所以用普通 <a>。
const gridDetailHref = (item: EtfItem) => `/note/lab/grid-trading/detail/?code=${item.code}&name=${encodeURIComponent(item.name)}`

export default function IndustryEtf(): JSX.Element {
  return (
    <main className="container animate-fade-in industry-etf-page">
      <header className="page-head">
        <h1>行业 ETF 清单</h1>
        <p>
          {INDUSTRY_GROUPS.length} 个行业组，共 {TOTAL_ETF_COUNT} 只 ETF。宽基、因子与主题的流派说明请看「ETF 流派地图」。
        </p>
        <nav className="industry-etf-nav" aria-label="行业目录">
          {INDUSTRY_GROUPS.map(g => (
            <a key={g.id} href={`#${g.id}`} className="industry-etf-nav__pill">
              <span>{g.name}</span>
              <span className="industry-etf-nav__count">{g.items.length}</span>
            </a>
          ))}
        </nav>
      </header>

      {INDUSTRY_GROUPS.map(group => (
        <section key={group.id} id={group.id} className="industry-group-section" aria-labelledby={`${group.id}-title`}>
          <div className="industry-group-card">
            <div className="industry-group-header">
              <h2 id={`${group.id}-title`} className="industry-group-title">
                {group.name}
              </h2>
              <span className="industry-group-count">{group.items.length} 只 ETF</span>
            </div>
            <div className="industry-table-wrapper">
              <table className="report-table industry-etf-table">
                <colgroup>
                  <col style={{ width: '92px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '150px' }} />
                  <col />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '92px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>代码</th>
                    <th>名称</th>
                    <th>行业分布</th>
                    <th>备注</th>
                    <th>参考</th>
                    <th>网格</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(item => (
                    <tr key={`${item.code}-${item.name}`}>
                      <NoteCells item={item} />
                      <td className="etf-subtheme-cell">
                        <span className="subtheme-tag">{item.subTheme}</span>
                      </td>
                      <td className="etf-remark-cell">{item.remark}</td>
                      <td className="etf-ref-cell">
                        <Reference item={item} />
                      </td>
                      <td className="etf-grid-cell">
                        <a href={gridDetailHref(item)} className="etf-ref-link" title="行情曲线、支撑压力、斐波那契；已添加网格的显示网格回测">
                          行情·网格
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </main>
  )
}
