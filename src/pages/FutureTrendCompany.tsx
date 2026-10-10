import React, { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { usePageSeo } from '../components/RouteSeo'
import { CompanyResearch, RESEARCH_BY_ID, researchPercent } from '../data/futureTrendsResearch'

import { presentation, priorityNames, displayText, priceLabel } from '../data/futureTrendsPresentation'
import '../styles/future-trends.css'

const card: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 12, padding: 22, marginBottom: 16, lineHeight: 1.85, overflowWrap: 'anywhere' }
const cell: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--system-gray5)', verticalAlign: 'top' }
const titles = ['研究信息', '公司与赚钱机制', '业务分布与驱动', '优势与缺点', '行业与周期', '综合结论卡', '关键指标及日期', '增长与护城河', '三情景、盈亏比与胜率', '价格与研究纪律', '风险与量化证伪', '多视角与多空交锋', '口径陷阱与缺失证据', '验证日历', '研究说明与来源']
function List({ items }: { items: string[] }): JSX.Element { return <ul>{items.map((x, i) => <li key={i}>{displayText(x)}</li>)}</ul> }

function ResearchSection({ index, children }: { index: number; children: React.ReactNode }): JSX.Element {
  const supplementary = [0, 3, 4, 11, 12].includes(index)
  return <section id={`section-${index}`} style={card}>{supplementary
    ? <details><summary>{titles[index]}</summary>{children}</details>
    : <><h2>{titles[index]}</h2>{children}</>}</section>
}

export default function FutureTrendCompany(): JSX.Element {
  const location = useLocation()
  const back = typeof location.state?.from === 'string' && location.state.from.startsWith('/future-trends') ? location.state.from : '/future-trends?tab=pool'
  const { id = '' } = useParams()
  const summary = RESEARCH_BY_ID.get(id)
  usePageSeo(summary ? `${summary.name}（${summary.code}）｜未来趋势研究` : undefined, summary?.headline)
  const [report, setReport] = useState<CompanyResearch | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    window.scrollTo(0, 0)
    setReport(null); setError('')
    if (!summary) return () => controller.abort()
    fetch(`${import.meta.env.BASE_URL}research/future-trends-2026-10-09/companies/${encodeURIComponent(id)}.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('报告读取失败'); return r.json() as Promise<CompanyResearch> })
      .then(setReport).catch(e => { if (e.name !== 'AbortError') setError('报告暂时无法读取，请刷新重试。') })
    return () => controller.abort()
  }, [id, summary, attempt])
  if (!summary) return <main className="container"><h1>未找到公司研究页</h1><Link to="/future-trends">返回未来趋势</Link></main>
  const p = presentation(summary)
  const d = report
  const money = (v: number | null) => priceLabel(v, summary.currency)
  const percent = (v: number | null) => displayText(researchPercent(v))
  return <main className="container ft ft-reader">
    <nav aria-label="返回研究列表" style={{ display: 'flex', gap: 20 }}><Link to={back}>← 返回列表</Link><Link to="/future-trends?tab=core">核心研究</Link><Link to="/future-trends?tab=ai">产业目录</Link></nav>
    <header className="ft-reader-hero"><h1>{summary.name} <small>{summary.code} · {p.industry}</small></h1>
      <span className={`ft-badge ft-badge--${p.priority}`}>{priorityNames[p.priority]}</span>
      <p>{displayText(p.reason)}</p><p className="ft-wait"><strong>下一步：</strong>{p.watch}</p>
      <div className="ft-reader-stats"><div><small>报价 · {summary.priceDate}</small><strong>{money(summary.price)}</strong></div><div><small>2:1 情景条件价</small><strong>{money(summary.threshold)}</strong></div><div><small>情景盈亏比</small><strong>{summary.ratio === null ? '暂不适用' : `${summary.ratio.toFixed(2)} : 1`}</strong></div></div>
      <details className="ft-method"><summary>研究结论与完成程度</summary><p>{displayText(summary.headline)}</p><p>{summary.rating} · 证据确定性：{summary.certainty}</p><p>{summary.valuationStatus}</p></details>
      <p className="ft-method">更新 {summary.asOf} · {summary.depth}。估值情景仍为待复核草稿，条件价不是买入价，实际胜率尚未校准。</p>
      <nav aria-label="报告目录">{[[1,'业务'],[7,'护城河'],[6,'财务'],[8,'估值与胜率'],[10,'风险'],[13,'验证日历'],[14,'来源']].map(([i,t]) => <a key={i} href={`#section-${i}`}>{t}</a>)}</nav>
    </header>
    {error && <p role="alert">{error} <button className="ft-export" type="button" onClick={() => setAttempt(x => x+1)}>重新加载</button></p>}{!d && !error && <p role="status">正在加载公司分析…</p>}
    {d && [1,2,7,6,8,9,10,13,3,4,11,12,0,14].map(i => <ResearchSection key={i} index={i}>
      {i === 0 && <><p>{displayText(d.period)}</p><p>现价：{displayText(d.priceText)}；时间：{displayText(d.priceDate)}（市场当地时间，不统一称收盘）。</p><p>关联趋势：{d.trends.join('；')}。主要盈利驱动：{displayText(d.primaryTrend)}；共同风险：{displayText(d.riskGroup)}。</p></>}
      {i === 1 && <><p>{displayText(d.profile)}</p><p>{displayText(d.mechanism)}</p></>}
      {i === 2 && <><List items={d.segments} /><h3>决定结果的变量</h3><List items={d.drivers} /><p>目录角色不等于收入占比；未披露分部比例时不填造占比。</p></>}
      {i === 3 && <><h3>优势</h3><List items={d.pros} /><h3>缺点与代价</h3><List items={d.cons} /></>}
      {i === 4 && <List items={d.industry} />}
      {i === 5 && <><p><strong>{displayText(d.rating)}</strong> · 证据确定性：{displayText(d.certainty)}</p><p>{displayText(d.headline)}</p><p>护城河：{displayText(d.moat)}</p><p>最大隐忧：{displayText(d.concern)}</p><p>估值状态：{displayText(d.valuationStatus)}</p><p>核心是优先长期研究名单，当前未认证买入，不等于建议立即配置。</p></>}
      {i === 6 && <><div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}><tbody>{d.metrics.map(([k, v], j) => <tr key={j}><th style={cell}>{k}</th><td style={cell}>{displayText(v)}</td></tr>)}</tbody></table></div><details><summary>旧判断与本次调整</summary><List items={d.prior} /></details></>}
      {i === 7 && <><h3>增长链条</h3><List items={d.growth} /><h3>护城河能否转成现金</h3><List items={d.moatAnalysis} /></>}
      {i === 8 && <><p><strong>{displayText(d.modelNote)}</strong></p><div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr>{['情景', '盈利与倍数假设', '隐含价格', '相对现价', '主观概率'].map(x => <th style={cell} key={x}>{x}</th>)}</tr></thead><tbody>{d.scenarios.map(s => <tr key={s.name}><th style={cell}>{s.name}</th><td style={cell}>{displayText(s.assumption)}</td><td style={cell}>{money(s.price)}</td><td style={cell}>{d.price && s.price ? percent(s.price / d.price - 1) : '待核实'}</td><td style={cell}>{s.probability === null ? '—' : `${Math.round(s.probability * 100)}%`}</td></tr>)}</tbody></table></div>
        <p>条件盈亏比 R = (Base − P) / (P − Bear)：<strong>{d.ratio === null ? '不适用／缺失' : `${d.ratio.toFixed(4)} : 1`}</strong>。{d.price !== null && d.scenarios[1].price !== null && d.price >= d.scenarios[1].price ? '价格锚点已达到或超过基准价，上行不足，不能报正赔率。' : d.price !== null && d.scenarios[0].price !== null && d.price <= d.scenarios[0].price ? '价格锚点已低于悲观价，分母不成立，须重新检查下行情景。' : '仅在 Bear < P < Base 时有效。'}</p>
        <p>基准上行 {percent(d.up)} · 悲观下行 {percent(d.down === null ? null : -d.down)} · 2:1 条件门槛价 {money(d.threshold)}。</p>
        <p><strong>实际胜率：{displayText(d.winRate)}</strong></p><p>二点模型保本所需胜率：{percent(d.breakEven)}；期望收益：{d.expected === null ? '待核实' : percent(d.expected)}。</p><p>{displayText(d.probabilityNote)}</p>
        <h3>独立估值核对</h3><p>{displayText(d.secondMethod)}</p><h3>敏感性</h3><List items={d.sensitivity} /><p>保留未四舍五入值计算；显示小数不代表估值具有同等预测精度。情景价格不含分红、税费与交易成本。</p></>}
      {i === 9 && <List items={d.discipline} />}
      {i === 10 && <><p>{displayText(d.concern)}</p><List items={d.falsification} /></>}
      {i === 11 && <><p>单模型多视角复核；没有独立专家或子代理参与，不以投票代替证据。</p>{d.debate.map(v => <div key={v.perspective}><h3>{v.perspective} · {v.stance}</h3><p>支持：{displayText(v.evidence)}</p><p>反证：{displayText(v.counter)}</p></div>)}<p><strong>综合裁决：</strong>{displayText(d.verdict)}</p></>}
      {i === 12 && <><h3>口径陷阱</h3><List items={d.pitfalls} /><h3>尚待补充的证据</h3><List items={d.missing} /></>}
      {i === 13 && <List items={d.calendar} />}
      {i === 14 && <><p>条件化研究，不是收益保证或个人交易指令。来源仅支持其明确披露的事实；判断、预测和情景价格由分析者承担。未核实项不作为确定事实。</p><ul>{d.sources.filter(s => s.url).map((s, j) => <li key={j}><a href={s.url.startsWith('/') ? import.meta.env.BASE_URL + s.url.slice(1) : s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> — {s.status}</li>)}</ul><a href={`${import.meta.env.BASE_URL}research/future-trends-2026-10-09/companies/${id}.json`} download>下载完整公司研究 JSON</a></>}
    </ResearchSection>)}
  </main>
}
