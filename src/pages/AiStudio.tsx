import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import LabDirectionCard from '../components/lab/LabDirectionCard'
import { LAB_PRINCIPLE, LAB_SHOWCASE, avoidedDirections, findDirection, labStats, recommendedDirections } from '../data/aiLab'

export default function AiStudio(): JSX.Element {
  const stats = labStats()
  const avoided = avoidedDirections()
  return (
    <main className="container animate-fade-in lab-page">
      <header className="page-head">
        <h1>AI实验室</h1>
        <p>一个程序员为自由生活准备的第二曲线：开发、工具、内容和小生意，每个方向都当成一次公开实验。</p>
        <p className="lab-stats">作品 {stats.works} · 进行中 {stats.running} · 已停止 {stats.stopped}</p>
      </header>

      <section className="lab-section lab-principle" aria-labelledby="lab-principle-title">
        <h2 id="lab-principle-title">商业原理</h2>
        <p className="lab-principle__statement">{LAB_PRINCIPLE.statement}</p>

        <h3>我的本钱</h3>
        <dl className="lab-limits">
          {LAB_PRINCIPLE.assets.map(a => <React.Fragment key={a.label}><dt>{a.label}</dt><dd>{a.detail}</dd></React.Fragment>)}
        </dl>

        <h3>价值怎样变成收入</h3>
        <ol className="lab-loop">
          {LAB_PRINCIPLE.loop.map(l => <li key={l.step}><strong>{l.step}</strong><span>{l.text}</span></li>)}
        </ol>

        <h3>三层结构</h3>
        <div className="lab-grid">
          {LAB_PRINCIPLE.layers.map(layer => (
            <div key={layer.name} className="lab-card lab-layer">
              <span className="hub-card__title">{layer.name}</span>
              <span className="hub-card__desc">{layer.job}</span>
              <span className="lab-layer__links">
                {layer.directions.map(slug => {
                  const d = findDirection(slug)
                  return d ? <Link key={slug} to={`/ai/${slug}`} className="tag">{d.title}</Link> : null
                })}
              </span>
            </div>
          ))}
        </div>

        <h3>六条规矩</h3>
        <dl className="lab-limits">
          {LAB_PRINCIPLE.rules.map(r => <React.Fragment key={r.title}><dt>{r.title}</dt><dd>{r.text}</dd></React.Fragment>)}
        </dl>

        <h3>逐关验证</h3>
        <dl className="lab-limits">
          {LAB_PRINCIPLE.gates.map(g => <React.Fragment key={g.stage}><dt>{g.stage}</dt><dd>{g.pass}</dd></React.Fragment>)}
        </dl>

        <p><strong>只盯一个数：</strong>{LAB_PRINCIPLE.northStar}</p>
        <p className="hub-group__hint">{LAB_PRINCIPLE.caveat}</p>
      </section>

      <section className="lab-section">
        <h2>作品</h2>
        <div className="lab-showcase">
          {LAB_SHOWCASE.map(s => (
            <Link key={s.path} to={s.path} className="hub-card lab-showcase__item">
              <span className="hub-card__title">{s.title}</span>
              <span className="hub-card__desc">{s.desc}</span>
              <ArrowRight size={16} className="hub-card__arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="lab-section">
        <h2>学习计划</h2>
        <Link to="/ai/fullstack-roadmap" className="lab-card">
          <span className="hub-card__title">AI 全栈 8 周学习路线</span>
          <span className="hub-card__desc">56 天，围绕一个 AI SaaS 边学边做。查看完整计划、标记学习进度、下载原文。</span>
          <span className="tag">进入学习计划 →</span>
        </Link>
      </section>

      <section className="lab-section">
        <h2>推荐方向</h2>
        <p className="hub-group__hint">按和我的匹配度从高到低排列，匹配度是当前判断。点开看具体用户、获客与收费假设，以及实验边界和日志。</p>
        <div className="lab-grid">
          {recommendedDirections().map(d => <LabDirectionCard key={d.slug} direction={d} />)}
        </div>
      </section>

      <details className="hub-group hub-group--fold lab-section">
        <summary>不推荐（{avoided.length}）</summary>
        <p className="hub-group__hint">这些方向我不做，原因写在每一项里，给想做的人提个醒。</p>
        <div className="lab-grid">
          {avoided.map(d => <LabDirectionCard key={d.slug} direction={d} />)}
        </div>
      </details>

      <section className="lab-section">
        <h2>实验规则</h2>
        <p>一次只启动一个新实验。每个实验开始前先定好每周时间、预算上限和截止日期；到期看数据，决定继续还是停止。过程和结果都公开记录，没开始的就写“还没开始”。</p>
      </section>
    </main>
  )
}
