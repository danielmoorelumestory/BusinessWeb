import { Link } from 'react-router-dom'
import { SOLID_REVIEW, SOLID_REVIEW_MANIFEST } from '../../data/solidState/review'
import { amount, mcpCompany, primaryListing, rawUrl } from '../../data/solidState/mcpResearch'

export default function SolidStateReview(): JSX.Element {
  const focus = SOLID_REVIEW.companies.filter(c => c.forecast)
  return <section id="solid-review" className="solid-section" aria-labelledby="solid-review-title">
    <h2 id="solid-review-title">候选与核心分层 · {SOLID_REVIEW.asOf} MCP 复核</h2>
    <p>核心研究池：宁德时代。候选池／核心预备：先导智能、璞泰来。候选池：新宙邦、赢合科技、当升科技、厦钨新能。天奈科技暂缓候选，保留观察。</p>
    <p>核心和候选表示持续研究优先级，当前买入资格未认证。{SOLID_REVIEW.scope}。{SOLID_REVIEW.priceDate}。行情核验于 {SOLID_REVIEW.marketCheckedAt.slice(0, 19)} UTC；下表财务保留已核 2026H1 原件口径，人民币亿元。</p>
    <div className="solid-table"><table><caption>重点公司：分层、现金与供应商预测</caption><thead><tr>{['公司／分层', '价格 · CNY', '归母／经营现金／简化 FCF', '供应商 +1y EPS／PE／覆盖人数', '依据与下一步'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{focus.map(r => {
      const c = mcpCompany(r.name); const f = c?.financials; const l = primaryListing(c); const e = r.forecast!
      return <tr key={r.id}><th scope="row"><Link to={`/future-trends/solid-state/${r.id}`}>{r.name}</Link><small>{r.tier}</small></th><td>{l?.price ?? '[MISSING]'}<small>{l?.marketTime?.slice(0, 10)}</small></td><td>{amount(f?.netIncome)}／{amount(f?.cfo)}／{amount(f?.fcf)}</td><td>{e.eps?.toFixed(3)}／{e.priceToEps?.toFixed(2)}倍／{e.analysts}人<small>预测核验 {e.estimateAsOf}；{e.refreshStatus}</small><br /><a href={rawUrl(e.source)} target="_blank" rel="noreferrer">预测原始返回</a></td><td><p>{r.reason}</p><p>{r.watch}</p></td></tr>
    })}</tbody></table></div>
    <p>新闻复核：当升已披露客户验证及小批量应用，仍须验证规模利润与回款；先导 AIDC 和赢合韩国客户订单支持主营需求，不能自动计为固态订单；上海洗霸公告明确固态相关业务未形成长期稳定规模化收入。</p>
    <details><summary>查看全部 {SOLID_REVIEW.companies.length} 个主体的处理与验证条件</summary><div className="solid-table"><table><thead><tr><th scope="col">公司</th><th scope="col">分层</th><th scope="col">判断与验证条件</th></tr></thead><tbody>{SOLID_REVIEW.companies.map(r => <tr key={r.id}><th scope="row"><Link to={`/future-trends/solid-state/${r.id}`}>{r.name}</Link></th><td>{r.tier}</td><td>{r.reason} {r.watch}</td></tr>)}</tbody></table></div></details>
    <details><summary>本次取数范围与口径限制</summary><p>请求 {SOLID_REVIEW.stats.quoteRequests} 个标的公司行情，取得 {SOLID_REVIEW.stats.validQuotes} 个有效报价；补取 {SOLID_REVIEW.stats.newsCompanies} 家新闻、{SOLID_REVIEW.stats.financialAbstractCompanies} 家财务摘要及 {SOLID_REVIEW.stats.estimateCompanies} 家盈利预测。</p><ul>{SOLID_REVIEW.notes.map(n => <li key={n}>{n}</li>)}</ul></details>
    <p><a href={rawUrl(SOLID_REVIEW_MANIFEST)} target="_blank" rel="noreferrer">下载 10 月 10 日复核的调用及原始文件索引 →</a> · <a href={rawUrl('research/solid-state-mcp-2026-10-10/复核摘要.md')} download>下载复核摘要</a></p>
  </section>
}
