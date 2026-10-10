import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePageSeo } from '../components/RouteSeo'
import { amount, primaryListing, rawUrl } from '../data/solidState/mcpResearch'
import { solidCompanyById, solidCompanyPath, solidCompanyReport } from '../data/solidState/companyResearch'
import '../styles/solid-state.css'

function Metrics({ caption, rows }: { caption: string; rows: string[][] }): JSX.Element {
  return <div className="solid-table solid-detail-metrics"><table><caption>{caption}</caption><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table></div>
}
export default function SolidStateCompany(): JSX.Element {
  const { id = '' } = useParams()
  const company = solidCompanyById(id)
  const report = company ? solidCompanyReport(company) : null
  usePageSeo(report ? `${report.name}｜固态电池公司研究` : '未找到固态电池公司', report?.role)
  useEffect(() => { window.scrollTo(0, 0) }, [id])
  if (!company || !report) return <main className="container"><h1>未找到固态电池公司研究</h1><Link to="/future-trends?tab=solid-state">返回固态电池专题</Link></main>
  const listing = primaryListing(company)
  const finance = report.financials
  const model = report.draft
  const exportReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `solid-state-${report.id}-${report.asOf}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return <main className="container solid-state solid-reader">
    <nav className="solid-nav" aria-label="公司研究导航"><Link to="/future-trends?tab=solid-state">← 返回固态电池专题</Link><Link to="/industry-landscape">产业格局</Link></nav>
    <header className="solid-section solid-hero">
      <p className="solid-eyebrow">{report.origin} · {report.industry} · 更新 {report.asOf}</p>
      <h1>{report.name}</h1><p className="solid-lead">{report.conclusion}</p><p>{report.role}</p>
      <p className="solid-meta">{report.depth} · {report.period}。事实、公司声明与研究假设分列；当前未认证买入评级。</p>
      <div className="solid-grid solid-stat-grid">
        <div><small>行情快照 · 报价币种</small><strong>{listing ? `${listing.currency} ${listing.price}` : '[MISSING]'}</strong><small>{listing?.marketTime ?? '独立上市身份 / 有效报价待核'}</small></div>
        <div><small>2026 上半年 · {finance?.currency ?? '财报币种缺失'}</small><strong>收入 {amount(finance?.revenue)}</strong><small>归母 / 普通股净利 {amount(finance?.netIncome)}</small></div>
        <div><small>2026 上半年 · {finance?.currency ?? '财报币种缺失'}</small><strong>经营现金 {amount(finance?.cfo)}</strong><small>简化 FCF {amount(finance?.fcf)}</small></div>
      </div>
      <button className="solid-download" onClick={exportReport}>下载本公司研究 JSON</button>
    </header>
    <nav className="solid-nav" aria-label="公司报告目录">{report.sections.map((s, i) => <a href={`#company-section-${i}`} key={s.title}>{s.title}</a>)}<a href="#company-financials">财务数据</a><a href="#company-peers">同环节比较</a><a href="#company-sources">来源原件</a></nav>
    {report.sections.map((s, i) => <section id={`company-section-${i}`} className="solid-section" key={s.title} aria-labelledby={`company-section-title-${i}`}>
      <h2 id={`company-section-title-${i}`}>{s.title}</h2>{s.items.map((text, j) => <p key={j}>{text}</p>)}
      {i === 0 && report.businessSummary && <details><summary>数据源公司业务简介原文（第三方，需核实原文）</summary><p>{report.businessSummary}</p></details>}
      {i === 4 && <div id="company-financials">
        <p>全部为集团口径；MCP H1 流量由两季相加，余额取 6 月末。公司原件摘要直接采用披露的 H1 累计，不与第三方拼数。原件核对范围见本节说明；简化 FCF 不是 FCFF，也不等于可分红现金。</p>
        <Metrics caption="半年经营与现金流" rows={report.incomeRows} />
        <Metrics caption="资产负债与周转资金" rows={report.balanceRows} />
        <Metrics caption="市场与估值指标（第三方，未核实项不能作定价依据）" rows={report.marketRows} />
        <h3>季度趋势 · 金额为财报币种的亿</h3>
        {finance?.history.length ? <div className="solid-table"><table><thead><tr>{['单季截至', '收入', '归母 / 普通股净利', '经营现金', '资本支出', '简化 FCF'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{finance.history.map(q => <tr key={q.period}><th scope="row">{q.period}</th><td>{amount(q.revenue)}</td><td>{amount(q.netIncome)}</td><td>{amount(q.cfo)}</td><td>{amount(q.capex)}</td><td>{amount(q.fcf)}</td></tr>)}</tbody></table></div> : <p>可比季度报表 [MISSING]，不以集团规划或其他公司的数字补齐。</p>}
        <h3>多上市地记录</h3>{company.listings.length ? company.listings.map(l => <p key={l.symbol}><a href={rawUrl(l.source)} target="_blank" rel="noreferrer">{l.symbol} · {l.providerName ?? '资料为空'}</a>：{l.available ? `${l.currency} ${l.price}；市场时间 ${l.marketTime}` : l.issue}。财报币种 {l.financialCurrency ?? '[MISSING]'}；抓取 {l.retrievedAt}。价格可能延迟。</p>) : <p>独立发行人及证券代码未核，不使用合作方代码。</p>}
      </div>}
      {i === 6 && (model ? <>
        <h3>既有 EPS×PE 假设草稿</h3><p>EPS、PE 和概率均为研究者假设，未由完整订单及正常化盈利桥约束；主观情景概率不是实际胜率，不能认证买卖价格。</p>
        <div className="solid-table"><table><thead><tr>{['情景', '2027 EPS 假设', 'PE 假设', '数学情景价 · CNY', '主观概率'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{['悲观', '基准', '乐观'].map((name, j) => <tr key={name}><th scope="row">{name}</th><td>{model.input.eps[j]}</td><td>{model.input.pe[j]}</td><td>{model.result.prices[j].toFixed(2)}</td><td>{(model.input.prob[j] * 100).toFixed(0)}%</td></tr>)}</tbody></table></div>
        <p>条件盈亏比：{model.result.valid ? model.result.ratio!.toFixed(2) : '不适用：Bear＜P＜Base 未同时成立'}。这只是给定假设的算术结果；DCF / 第二种独立估值与摊薄桥未齐，暂不输出认证目标价。</p>
        <h3>EPS × PE 敏感性（不属于第二种独立估值）</h3>
        <div className="solid-table"><table><thead><tr><th scope="col">EPS / PE 假设</th>{[.8, 1, 1.2].map(k => <th scope="col" key={k}>{(model.input.pe[1] * k).toFixed(1)} 倍</th>)}</tr></thead><tbody>{[.8, 1, 1.2].map(k => <tr key={k}><th scope="row">EPS {(model.input.eps[1] * k).toFixed(2)}</th>{[.8, 1, 1.2].map(j => <td key={j}>{(model.input.eps[1] * k * model.input.pe[1] * j).toFixed(2)}</td>)}</tr>)}</tbody></table></div>
      </> : <p>本公司没有已验证的价格模型；当前仅提供三种经营路径和适用估值方法。未补齐正常化利润、项目成功率和摊薄前，不用任意 PE 或合作方股价补造目标价。</p>)}
    </section>)}
    <section className="solid-section" id="company-peers" aria-labelledby="company-peers-title"><h2 id="company-peers-title">同环节比较与研究入口</h2><p>选择同一赚钱机制对照，不代表完全相同产品或技术路线。跨币种不能直接比较金额；集团现金不代表固态利润。</p>
      <div className="solid-table"><table><thead><tr>{['公司', '财报币种', 'H1 收入', 'H1 净利润', 'H1 经营现金', 'H1 简化 FCF'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{report.peers.map(p => <tr key={p.id}><td><Link to={solidCompanyPath(p)}>{p.name}</Link></td><td>{p.financials?.currency ?? '[MISSING]'}</td><td>{amount(p.financials?.revenue)}</td><td>{amount(p.financials?.netIncome)}</td><td>{amount(p.financials?.cfo)}</td><td>{amount(p.financials?.fcf)}</td></tr>)}</tbody></table></div>
    </section>
    <section className="solid-section" id="company-sources" aria-labelledby="company-sources-title"><h2 id="company-sources-title">来源、日期与证据范围</h2>
      <ul className="solid-sources">{report.sources.map((s, i) => <li key={i}><a href={/^https?:/.test(s.url) ? s.url : rawUrl(s.url)} target="_blank" rel="noreferrer">{s.title}</a><div>{s.status}</div></li>)}</ul>
      <p>截至 {report.asOf} 的研究快照。超过 90 天的历史原件标 [STALE]，报告期与披露期分开；无日期的产品网页只支持公司自述，不认证商业收入。缺失不等于经营恶化。</p>
    </section>
    <p className="solid-disclaimer">{report.disclaimer}</p>
  </main>
}
