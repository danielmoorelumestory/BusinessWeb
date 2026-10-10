import React from 'react'
import { ETF_DISCLAIMER, ETF_SCHOOLS } from '../data/etfGuide'

export default function EtfGuide(): JSX.Element {
  return (
    <main className="container animate-fade-in etf-guide">
      <header className="page-head">
        <h1>ETF 流派地图</h1>
        <p>从宽基到因子、红利、主题、债券、商品，每个流派选出主要代表，说明它跟踪什么、适合谁、风险在哪。</p>
        <p className="etf-guide__disclaimer">{ETF_DISCLAIMER}</p>
        <nav className="etf-guide__nav" aria-label="ETF 流派目录">
          {ETF_SCHOOLS.map(s => (
            <a key={s.id} href={`#${s.id}`} className="tag">{s.title.replace(/^[^、]+、/, '').split('：')[0]}</a>
          ))}
        </nav>
      </header>

      {ETF_SCHOOLS.map(school => (
        <section key={school.id} id={school.id} className="hub-group" aria-labelledby={`${school.id}-title`}>
          <h2 id={`${school.id}-title`}>{school.title}</h2>
          <p className="hub-group__hint">{school.idea}</p>
          <div className="skill-grid">
            {school.etfs.map(etf => (
              <article className="skill-card" key={etf.ticker}>
                <span className="tag">{etf.fromVideo ? '视频提到' : etf.issuer}</span>
                <h3>{etf.ticker}</h3>
                <p className="skill-card__alias">{etf.name} · {etf.issuer}</p>
                <p className="skill-card__focus">{etf.focus}</p>
                <p><strong>跟踪：</strong>{etf.tracks}</p>
                <p>{etf.intro}</p>
                <p><strong>适合：</strong>{etf.fit}</p>
                <p><strong>风险：</strong>{etf.risk}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
