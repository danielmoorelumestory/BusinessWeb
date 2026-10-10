import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Segmented } from '../components/ui/PageTabs'
import CompanyComparison from '../components/future-trends/CompanyComparison'
import { POOL, downloadJson } from '../data/futureTrendsPool'
import { RESEARCH_BY_KEY } from '../data/futureTrendsResearch'
import { byPriority, poolBucket } from '../data/futureTrendsPresentation'
import '../styles/future-trends.css'
export default function FutureTrendsPool(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const view = ['1','2','4'].includes(params.get('view') ?? '') ? params.get('view')! : '1'
  const market = ['中国','海外'].includes(params.get('market') ?? '') ? params.get('market')! : '全部'
  const sort = ['ratio','space'].includes(params.get('sort') ?? '') ? params.get('sort')! : 'priority'
  const query = params.get('q') ?? ''
  function change(key: string, value: string) { const next = new URLSearchParams(params); next.set(key,value); next.delete('page'); setParams(next, { replace: key === 'q' }) }
  const all = POOL.map(x => ({ market: x.market, r: RESEARCH_BY_KEY.get(x.key)! }))
  const rows = all.filter(({market:m,r}) => (market === '全部' || market === m) && (view === '4' || poolBucket(r) === (view === '1' ? 'buy' : 'rich')) && `${r.name} ${r.code}`.toLowerCase().includes(query.trim().toLowerCase())).map(x => x.r).sort((a,b) => sort === 'ratio' ? (b.ratio ?? -Infinity) - (a.ratio ?? -Infinity) || byPriority(a,b) : sort === 'space' ? (b.up ?? -Infinity) - (a.up ?? -Infinity) || byPriority(a,b) : byPriority(a,b))
  const pages = Math.max(1,Math.ceil(rows.length / 20))
  const rawPage = Number(params.get('page'))
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage,pages) : 1
  function paginate(n: number) { const next = new URLSearchParams(params); next.set('page',String(n)); setParams(next) }
  return <div className="ft">
    <p className="ft-method"><Link to="/future-trends?tab=solid-state#solid-core-review">查看固态电池 40 家公司竞选结论与最新 MCP 证据 →</Link></p>
    <header className="ft-heading"><div><div className="ft-eyebrow">从公司质量，到价格条件</div><h2>候选池</h2><p>分两部分：可买卖是情景盈亏比≥0.75 且假设期望收益≥20% 的公司；好公司 · 价格太贵是已逐家分析、质量不错但现价偏高的公司，给出条件价等它回落。点击名称查看详细分析。</p></div><button className="ft-export" type="button" onClick={() => downloadJson('未来趋势候选研究-2026-10-09.json', rows)}>导出筛选结果 JSON</button></header>
    <div className="ft-views" role="group" aria-label="候选优先级">{[['1','可买卖','buy'],['2','好公司 · 价格太贵','rich'],['4','全部观察','']].map(([v,t,b]) => <button key={v} type="button" aria-pressed={view === v} onClick={() => change('view',v)}>{t}<span>{b ? all.filter(x => poolBucket(x.r) === b).length : all.length}</span></button>)}</div>
    <div className="ft-toolbar"><Segmented label="市场" value={market} onChange={v => change('market',v)} items={['全部','中国','海外'].map(id => ({id,label:id}))} /><label className="ft-sort">排序<select aria-label="排序" value={sort} onChange={e => change('sort',e.target.value)}><option value="priority">推荐顺序</option><option value="ratio">情景盈亏比</option><option value="space">基准价格空间</option></select></label><label className="ft-search"><span className="visually-hidden">搜索公司或代码</span><input type="search" name="company" autoComplete="off" spellCheck={false} placeholder="公司名称或代码…" value={query} onChange={e => change('q',e.target.value)} /></label></div>
    <div className="ft-results"><h3>{view === '1' ? '可买卖：价格已进入可操作区' : view === '2' ? '好公司，但价格太贵' : '全部观察'}</h3><span role="status" aria-live="polite">{rows.length} 家{pages > 1 ? ` · 第 ${page} / ${pages} 页` : ''}</span></div>
    <CompanyComparison rows={rows.slice((page-1)*20,page*20)} />
    {!rows.length && <div className="ft-empty"><p>没有找到匹配公司。</p><button className="ft-export" type="button" onClick={() => setParams({tab:'pool',view:'4'})}>查看全部观察公司</button></div>}
    {pages > 1 && <nav className="ft-pagination" aria-label="候选池分页"><button type="button" disabled={page === 1} onClick={() => paginate(page-1)}>上一页</button><span>{page} / {pages}</span><button type="button" disabled={page === pages} onClick={() => paginate(page+1)}>下一页</button></nav>}
    <p className="ft-method">优先级表示跟踪顺序，当前仍需等待价格与经营验证。情景盈亏比和 2:1 条件价为估值草稿，不是买入指令。报价截至 2026-10-09，具体时点见公司页。</p>
    <details className="ft-method"><summary>研究范围与计算口径</summary><p>465 家上市公司可查询，另有 26 家非上市或状态待核公司保留产业观察页。46 家（核心 12 家 + 入围候选 34 家）有公司披露摘录、情景草稿与主观概率，其余为初筛；所有情景尚待独立估值复核。实际胜率未经校准。</p><p>盈亏比 R=(基准价−现价)/(现价−悲观价)，仅悲观价＜现价＜基准价时有效。2:1 条件价=(基准价+2×悲观价)/3。悲观情景不是最大损失，条件价不等于合理价值。</p></details>
  </div>
}
