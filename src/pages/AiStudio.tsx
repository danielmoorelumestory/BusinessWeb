import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import LabDirectionCard from '../components/lab/LabDirectionCard'
import { LAB_SHOWCASE, avoidedDirections, labStats, recommendedDirections } from '../data/aiLab'

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
        <p className="hub-group__hint">按和我的匹配度从高到低排列。点开看每个实验的边界和日志。</p>
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
        <p>每个实验开始前先定好每周时间、预算上限和截止日期；到期看数据，决定继续还是停止。过程和结果都公开记录，没开始的就写“还没开始”。</p>
      </section>
    </main>
  )
}
