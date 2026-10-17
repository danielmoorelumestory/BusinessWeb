import React from 'react'
import { Link } from 'react-router-dom'
import BroadEtfList, { SelectedEtfList } from './BroadEtfList'
import BondFundList from './BondFundList'
import EtfDocumentRemark from './EtfDocumentRemark'
import EtfIdentityCell from './EtfIdentityCell'
import EtfTechnicalCells, { EtfTechnicalColumns, EtfTechnicalHeaders } from './EtfTechnicalCells'
import { latestEtfNote } from '../utils/etfJudgment'
import { BROAD_ETFS } from '../data/broadEtf'
import { STRATEGY_ASSET_ETF_GROUPS } from '../data/strategyAssetEtf'
import marketRefresh from '../data/investmentMarketRefresh.json'
import technicalSnapshot from '../data/etfTechnical.json'
import { INDUSTRY_GROUPS, TOTAL_ETF_COUNT, internalNoteSlug, type EtfItem } from '../data/industryEtf'

// 该 ETF 自己的研究笔记：笔记 slug 以「代码-」开头（如 159928-consumer-etf-analysis）。
const etfNoteOf = (item: EtfItem) => latestEtfNote(item.code)

function Reference({ item }: { item: EtfItem }): JSX.Element {
  const own = etfNoteOf(item)
  if (!item.referenceUrl) {
    return own ? (
      <Link to={`/notes/${own.slug}`} className="etf-ref-link" title={own.title}>
        分析报告
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
        分析报告
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
  return <EtfIdentityCell code={item.code} name={item.name} to={slug ? `/notes/${slug}` : undefined} />
}

// 网格详情页入口：已添加网格的 ETF 打开它的回测详情，没有添加的只显示行情曲线、支撑压力与斐波那契（不显示网格数据）。
// /note/ 是 notes 站点的静态页面，必须整页加载，所以用普通 <a>。
const gridDetailHref = (item: EtfItem) => `/note/lab/grid-trading/detail/?code=${item.code}&name=${encodeURIComponent(item.name)}`

function splitSubTheme(subTheme: string): string[] {
  if (subTheme.includes('%')) {
    const list = subTheme.split(/(?<=%)[、\s]*/).map(s => s.trim()).filter(Boolean)
    if (list.length > 0) return list
  }
  return subTheme.includes('、') ? subTheme.split('、').map(s => s.trim()).filter(Boolean) : [subTheme]
}

function SubThemeCell({ subTheme, note }: { subTheme: string; note?: string }): JSX.Element {
  const items = splitSubTheme(subTheme)
  if (items.length <= 1) {
    return (
      <td className="etf-subtheme-cell">
        <span className="subtheme-tag">{subTheme}</span>
        {note && <small>{note}</small>}
      </td>
    )
  }
  return (
    <td className="etf-subtheme-cell">
      <div className="subtheme-list">
        {items.map((text, idx) => (
          <span key={idx} className="subtheme-tag subtheme-tag--block">
            {text}
          </span>
        ))}
      </div>
      {note && <small>{note}</small>}
    </td>
  )
}

export default function IndustryEtf(): JSX.Element {
  return (
    <main className="container animate-fade-in industry-etf-page">
      <header className="page-head">
        <h1>ETF 与债券基金清单</h1>
        <p>
          {BROAD_ETFS.length} 类宽基；{STRATEGY_ASSET_ETF_GROUPS.map(group => `${group.items.length} 只${group.title}`).join('、')}；{INDUSTRY_GROUPS.length} 个行业组，共 {TOTAL_ETF_COUNT} 只行业 ETF。备注展示各自最新报告的综合判断。
        </p>
        <p>
          行情更新：{marketRefresh.etfAsOf} 收盘；场外基金按实际披露净值（{marketRefresh.fundNavDates.join('、')}）更新。估值与持仓保留各自披露日期。
          <a href={`${import.meta.env.BASE_URL}${marketRefresh.archivePath.replace(/^\//, '')}`}>查看行情复算数据</a>
        </p>
        <p className="etf-technical-note">日 / 周 / 月各看 MA、MACD、RSI；月线为本月暂态，月末确认。每格描述均线位置、动能变化与相对强弱，详细数值可悬停查看。<a href={`${import.meta.env.BASE_URL}${technicalSnapshot.archivePath.replace(/^\//, '')}`}>指标依据</a></p>
        <nav className="industry-etf-nav" aria-label="行业目录">
          <div className="industry-etf-nav__group">
            <span className="industry-etf-nav__group-label">一级分类：</span>
            <a href="#broad-etf" className="industry-etf-nav__pill industry-etf-nav__pill--primary"><span>宽基 ETF</span><span className="industry-etf-nav__count">{BROAD_ETFS.length}</span></a>
            {STRATEGY_ASSET_ETF_GROUPS.map(group => <a key={group.id} href={`#${group.id}`} className="industry-etf-nav__pill industry-etf-nav__pill--primary"><span>{group.title}</span><span className="industry-etf-nav__count">{group.items.length}</span></a>)}
            <a href="#industry-etf" className="industry-etf-nav__pill industry-etf-nav__pill--primary"><span>行业 ETF</span><span className="industry-etf-nav__count">{TOTAL_ETF_COUNT}</span></a>
          </div>
          <div className="industry-etf-nav__subgroup" aria-label="行业 ETF 二级分类">
            <span className="industry-etf-nav__group-label">行业 ETF 二级分类：</span>
            {INDUSTRY_GROUPS.map(g => (
              <a key={g.id} href={`#${g.id}`} className="industry-etf-nav__pill">
                <span>{g.name}</span>
                <span className="industry-etf-nav__count">{g.items.length}</span>
              </a>
            ))}
          </div>
        </nav>
      </header>

      <BroadEtfList />

      {STRATEGY_ASSET_ETF_GROUPS.map(group => group.id === 'bond-funds'
        ? <BondFundList key={group.id} {...group} />
        : <SelectedEtfList key={group.id} {...group} />)}

      <section id="industry-etf" className="industry-etf-main-section" aria-labelledby="industry-etf-main-title">
        <div className="industry-etf-main-header">
          <h2 id="industry-etf-main-title" className="industry-etf-main-title">
            行业 ETF
          </h2>
          <span className="industry-etf-main-count">{INDUSTRY_GROUPS.length} 个二级行业组 · 共 {TOTAL_ETF_COUNT} 只 ETF</span>
        </div>

        {INDUSTRY_GROUPS.map(group => (
          <section key={group.id} id={group.id} className="industry-group-section" aria-labelledby={`${group.id}-title`}>
            <div className="industry-group-card">
              <div className="industry-group-header">
                <h3 id={`${group.id}-title`} className="industry-group-title">
                  {group.name}
                </h3>
                <span className="industry-group-count">{group.items.length} 只 ETF</span>
              </div>
            <div className="industry-table-wrapper">
              <table className="report-table industry-etf-table etf-signals-table">
                <colgroup>
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '200px' }} />
                  <EtfTechnicalColumns />
                  <col />
                  <col style={{ width: '120px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="etf-identity-heading">名称 / 代码</th>
                    <th>行业分布</th>
                    <EtfTechnicalHeaders />
                    <th>备注</th>
                    <th className="etf-reference-heading">参考 / 网格</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(item => (
                    <tr key={`${item.code}-${item.name}`}>
                      <NoteCells item={item} />
                      <SubThemeCell subTheme={item.subTheme} note={item.subThemeNote} />
                      <EtfTechnicalCells code={item.code} />
                      <td className="etf-remark-cell"><EtfDocumentRemark code={item.code} /></td>
                      <td className="etf-reference-cell">
                        <Reference item={item} />
                        <a href={gridDetailHref(item)} className="etf-ref-link" title="行情曲线、支撑压力、斐波那契；已添加网格的显示网格回测">
                          行情网格
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
      </section>
    </main>
  )
}
