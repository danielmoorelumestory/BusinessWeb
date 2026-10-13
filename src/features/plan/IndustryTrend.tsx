import React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, Compass, Layers, ListChecks, Star, TrendingDown } from 'lucide-react'
import { CHAIN, COMPANIES, MAIN_LINE, PLAYBOOK, SELLOFF, STAR_NOTE, THESES, TREND_ASOF, UNVERIFIED, type Certainty, type CompanyView, type Volatility } from '../../data/industryTrends'

const CERTAINTY_TONE: Record<Certainty, string> = { 高: 'green', 中: 'yellow', 低: 'red' }
const VOLATILITY_TONE: Record<Volatility, string> = { 低: 'green', 中: 'blue', 高: 'yellow', 很高: 'red' }

function Section({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="ui-card plan-card trend-section" aria-labelledby={id}>
      <header className="plan-card__head"><h3 id={id} className="plan-card__title">{icon}{title}</h3></header>
      {children}
    </section>
  )
}

function Stars({ n }: { n: number }): JSX.Element {
  return (
    <span className="trend-stars" role="img" aria-label={`${n} 星`}>
      {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} aria-hidden="true" className={i <= n ? 'is-on' : undefined} />)}
    </span>
  )
}

const slug = (c: CompanyView): string => `trend-co-${c.ticker.split(/\s*\/\s*/)[0].replace(/\W/g, '').toLowerCase()}`

/** 单家公司：摘要一行，展开看位置、理由、风险、跟踪指标和结论 */
function CompanyCard({ c, rank, open }: { c: CompanyView; rank: number; open: boolean }): JSX.Element {
  return (
    <details className="trend-co" id={slug(c)} open={open}>
      <summary>
        <span className="trend-co__rank">{rank}</span>
        <span className="trend-co__name"><strong>{c.name}</strong><small>{c.ticker} · {c.segment}</small></span>
        <Stars n={c.stars} />
        <ChevronDown size={16} aria-hidden="true" className="trend-co__chev" />
      </summary>
      <div className="trend-co__body">
        <p className="trend-co__reason">{c.reason}</p>
        <p className="plan-body">{c.position}</p>
        {c.products && (
          <ul className="trend-products">
            {c.products.map(p => <li key={p.name}><strong>{p.name}</strong>{p.text}</li>)}
          </ul>
        )}
        <div className="plan-grid plan-grid--lg trend-two">
          <div>
            <p className="plan-kicker plan-kicker--do">推荐理由</p>
            <ul className="plan-bullets is-green">{c.why.map(w => <li key={w}>{w}</li>)}</ul>
          </div>
          <div>
            <p className="plan-kicker plan-kicker--dont">主要风险</p>
            <ul className="plan-bullets is-red">{c.risks.map(r => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>
        <p className="trend-label">跟踪指标</p>
        <ul className="trend-chips">{c.watch.map(w => <li key={w}>{w}</li>)}</ul>
        <p className="trend-verdict">{c.verdict}</p>
      </div>
    </details>
  )
}

/** 投资计划 · 产业趋势：先给主线，再给判断、复盘、产业链对照、重点公司和应对纪律 */
export default function IndustryTrend(): JSX.Element {
  return (
    <div className="trend">
      <section className="trend-hero" aria-labelledby="trend-main">
        <p className="trend-hero__kicker">产业趋势 · 整理于 {TREND_ASOF}</p>
        <h2 id="trend-main" className="trend-hero__title">{MAIN_LINE.title}</h2>
        <p className="trend-hero__text">{MAIN_LINE.summary}</p>
        <nav className="trend-toc" aria-label="本页目录">
          <a href="#trend-theses">三个判断</a>
          <a href="#trend-selloff">存储大跌复盘</a>
          <a href="#trend-chain">产业链对照</a>
          <a href="#trend-picks">重点公司排序</a>
          <a href="#trend-playbook">联动下跌怎么做</a>
        </nav>
      </section>

      <Section id="trend-theses" icon={<Compass size={18} aria-hidden="true" />} title="三个判断（以及什么情况说明判断错了）">
        <ol className="trend-theses">
          {THESES.map(t => (
            <li key={t.title}>
              <h4>{t.title}</h4>
              <p>{t.logic}</p>
              <p className="trend-label">看什么</p>
              <ul className="plan-bullets is-blue">{t.watch.map(w => <li key={w}>{w}</li>)}</ul>
              <p className="trend-wrong"><span>判断错了的信号</span>{t.wrong}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="trend-selloff" icon={<TrendingDown size={18} aria-hidden="true" />} title={SELLOFF.title}>
        <div className="trend-causes">
          {SELLOFF.causes.map((c, i) => (
            <div key={c.name} className="trend-cause">
              <span className="trend-cause__n" aria-hidden="true">{i + 1}</span>
              <div><strong>{c.name}</strong><p>{c.text}</p></div>
            </div>
          ))}
        </div>
        <p className="trend-label">学到什么</p>
        <ul className="plan-bullets is-yellow">{SELLOFF.lessons.map(l => <li key={l}>{l}</li>)}</ul>
      </Section>

      <Section id="trend-chain" icon={<Layers size={18} aria-hidden="true" />} title="产业链对照：谁在主线的什么位置">
        <p className="plan-body plan-muted">确定性指在「推理上云、ASIC 降本」这条主线里受益的确定程度；波动指股价对行业情绪的敏感度。两者都是研究判断，不是评级。</p>
        <div className="ui-table-wrap">
          <table className="ui-table trend-table">
            <caption className="visually-hidden">AI 算力链各环节对照</caption>
            <thead><tr>{['环节', '在主线中的位置', '护城河', '主要风险', '确定性', '波动', '怎么用'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {CHAIN.map(c => (
                <tr key={c.segment}>
                  <th scope="row"><strong>{c.segment}</strong><small>{c.companies}</small></th>
                  <td>{c.role}</td>
                  <td>{c.moat}</td>
                  <td>{c.risk}</td>
                  <td><span className={`plan-pill is-${CERTAINTY_TONE[c.certainty]}`}>{c.certainty}</span></td>
                  <td><span className={`plan-pill is-${VOLATILITY_TONE[c.volatility]}`}>{c.volatility}</span></td>
                  <td className="plan-nowrap">{c.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="trend-picks" icon={<Star size={18} aria-hidden="true" />} title="重点公司排序（按业务星级）">
        <p className="plan-body plan-muted">{STAR_NOTE}</p>
        <div className="ui-table-wrap">
          <table className="ui-table trend-rank">
            <caption className="visually-hidden">重点公司排序</caption>
            <thead><tr>{['#', '公司', '环节', '星级', '为什么排在这里'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {COMPANIES.map((c, i) => (
                <tr key={c.ticker}>
                  <td className="plan-num">{i + 1}</td>
                  <th scope="row"><a href={`#${slug(c)}`}>{c.name}</a><small>{c.ticker}</small></th>
                  <td>{c.segment}</td>
                  <td><Stars n={c.stars} /></td>
                  <td>{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="trend-label">逐家分析（点开查看）</p>
        <div className="trend-cos">
          {COMPANIES.map((c, i) => <CompanyCard key={c.ticker} c={c} rank={i + 1} open={i < 2} />)}
        </div>
      </Section>

      <Section id="trend-playbook" icon={<ListChecks size={18} aria-hidden="true" />} title={PLAYBOOK.title}>
        <p className="plan-body">{PLAYBOOK.why}</p>
        <ol className="trend-steps">
          {PLAYBOOK.steps.map(s => <li key={s.name}><strong>{s.name}</strong><span>{s.text}</span></li>)}
        </ol>
        <p className="plan-body plan-muted plan-small">{PLAYBOOK.excluded}</p>
        <p className="trend-links">
          <Link to="/candidates">去候选池写条件 →</Link>
          <Link to="/investment-plan-2026?tab=allocation">回撤补仓阶梯 →</Link>
          <Link to="/future-trends?tab=ai">AI 产业链公司目录 →</Link>
        </p>
      </Section>

      <div className="plan-note is-gray" role="note">
        <AlertTriangle size={16} aria-hidden="true" />
        <div>
          <strong>待核实，不作为依据：</strong>以下说法来自讨论，尚未找到原始来源，核实后再写入。
          <ul className="trend-unverified">{UNVERIFIED.map(u => <li key={u}>{u}</li>)}</ul>
          公司仅用于说明产业链位置，不构成买卖建议。
        </div>
      </div>
    </div>
  )
}
