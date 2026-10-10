import React from 'react'
import { Link } from 'react-router-dom'
import CompanyComparison from '../components/future-trends/CompanyComparison'
import FutureCompanyLink from '../components/FutureCompanyLink'
import { CORE } from '../data/futureTrendsCore'
import { downloadJson } from '../data/futureTrendsPool'
import { RESEARCH_BY_KEY } from '../data/futureTrendsResearch'
import { byPriority, presentation, SELECTION } from '../data/futureTrendsPresentation'
import '../styles/future-trends.css'
export default function FutureTrendsCore(): JSX.Element {
  const rows = CORE.map(x => x.research).sort(byPriority)
  const first = rows.filter(x => presentation(x).priority === 1)
  const second = rows.filter(x => presentation(x).priority === 2)
  const groups = Object.entries(rows.reduce<Record<string,number>>((m,r) => { const sector=presentation(r).sector; m[sector]=(m[sector] ?? 0)+1; return m },{}))
  const max = Math.max(...groups.map(([,n]) => n))
  const waiting = SELECTION.filter(x => x.priority === 3).map(x => ({ x, r: RESEARCH_BY_KEY.get(x.key)! }))
  const modeled = waiting.filter(({r}) => r.depth.startsWith('公司证据')).length
  return <div className="ft">
    <p className="ft-method"><Link to="/future-trends?tab=solid-state#solid-core-review">固态电池竞选复核：宁德保留核心，先导、新宙邦、赢合优先研究 →</Link></p>
    <header className="ft-heading"><div><div className="ft-eyebrow">精选 {rows.length} 家 · 覆盖 {groups.length} 个赛道 · 单一赛道最多 {max} 家</div><h2>核心：先看这 {first.length} 家</h2><p>{first.map(r => r.name).join('、')}优先跟踪；其余 {second.length} 家作为备选。依据是经营壁垒、现金质量、情景盈亏比与赛道分散，不为凑数入选：半导体与先进制造、航空航天、新材料赛道已分析公司现价均高于或贴近基准价，本轮没有入选；博通、礼来、TransDigm、林德按盈亏比≥0.75 且期望收益≥20% 的准入线降为入围候选。</p></div><button className="ft-export" type="button" onClick={() => downloadJson('未来趋势核心研究-2026-10-09.json',rows)}>导出核心 JSON</button></header>
    <div className="ft-distribution" aria-label="核心赛道分布">{groups.map(([name,count]) => <span key={name}><strong>{name}</strong>{count} 家</span>)}</div>
    <div className="ft-section-head"><h3>优先候选</h3><p>业务质量优先，价格条件逐家比较</p></div><CompanyComparison rows={first} />
    <div className="ft-section-head"><h3>备选</h3><p>保留跟踪，等待更好的价格或经营证据</p></div><CompanyComparison rows={second} />
    <p className="ft-method">当前情景估值均为待复核草稿；优先跟踪不等于现价买入。2:1 条件价仅说明给定假设下的赔率门槛，目前没有一家现价达到 2:1。假设胜率是情景概率（悲观/基准/乐观的主观取值）中价格高出现价 10% 以上的合计，不是历史回测胜率。报价截至 2026-10-09。</p>
    <details className="ft-method"><summary>入围但未进核心的 {waiting.length} 家（共分析 {CORE.length + waiting.length} 家，其中 {modeled + CORE.length} 家已建情景）</summary><ul>{waiting.map(({x,r}) => <li key={x.key}><strong><FutureCompanyLink name={r.name} code={r.code} /></strong>（{x.sector}）：{x.reason} {x.watch}</li>)}</ul></details>
    <details className="ft-method"><summary>赛道分散之后，还要看哪些共同风险？</summary><p>单一赛道最多 {max} / {rows.length} 家（按公司数量计算，并非持仓权重）。赛道是检索分类，不是互斥的风险因子，下面几组公司仍共享同一风险。</p><p>AI 资本开支：博通与腾讯的 AI 变现都取决于云和平台的投入回报。药价与医保：阿斯利康与礼来共享美国和中国的定价政策。汽车年降：舜宇与恩智浦共享整车需求与降价传导。航空供应链：TransDigm 与候选中的空客、GE 共享发动机与飞机交付节奏。利率：NextEra 与林德的估值同时受利率影响。</p></details>
  </div>
}
