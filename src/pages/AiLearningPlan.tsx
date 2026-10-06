import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PROGRESS_KEY, readProgress, roadmapHtml, tasks, weeks } from '../features/ai-learning/roadmap'
import '../styles/ai-learning.css'

export default function AiLearningPlan(): JSX.Element {
  const [completed, setCompleted] = useState(readProgress)
  const [saveError, setSaveError] = useState(false)
  const documentRef = useRef<HTMLDivElement>(null)
  const done = new Set(completed)
  const daysDone = tasks.filter(task => task.day && done.has(task.id)).length
  const checks = tasks.filter(task => !task.day)
  const checksDone = checks.filter(task => done.has(task.id)).length

  useEffect(() => {
    documentRef.current?.querySelectorAll<HTMLInputElement>('input[data-task]').forEach(input => {
      input.checked = completed.includes(input.dataset.task ?? '')
    })
  }, [completed])

  function toggle(event: React.MouseEvent<HTMLDivElement>) {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || !input.dataset.task) return
    const id = input.dataset.task
    const next = input.checked ? [...new Set([...completed, id])] : completed.filter(item => item !== id)
    setCompleted(next)
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(next))
      setSaveError(false)
    } catch { setSaveError(true) }
  }

  return (
    <main className="container animate-fade-in lab-page learning-page">
      <Link to="/ai" className="lab-back">← AI实验室</Link>
      <header className="page-head">
        <h1>AI 全栈 8 周实战学习路线</h1>
        <p>20% 学习，80% 实践。围绕一个真实产品，从 Web 基础走到 AI SaaS 上线。</p>
        <a className="learning-download" href={`${import.meta.env.BASE_URL}ai-learning/${encodeURIComponent('AI全栈8周学习路线.md')}`} download="AI全栈8周学习路线.md">下载学习计划（Markdown）</a>
      </header>
      <section className="learning-progress" aria-label="学习进度">
        <div className="learning-progress__summary" aria-live="polite">
          <strong>已完成 {daysDone} / 56 天</strong>
          <span>{Math.round(daysDone / 56 * 100)}%</span>
        </div>
        <progress aria-label="总体学习进度" value={daysDone} max={56} />
        <p>验收项 {checksDone} / {checks.length} · 勾选后自动保存在当前浏览器。</p>
        {saveError && <p role="alert">当前浏览器无法保存进度，离开页面后本次更改可能丢失。</p>}
        <nav className="learning-weeks" aria-label="每周学习进度">
          {weeks.map(w => {
            const count = tasks.filter(task => task.week === w.number && task.day && done.has(task.id)).length
            return <a key={w.number} href={`#${w.anchor}`} aria-label={`Week ${w.number} 学习进度`}>
              <strong>Week {w.number}</strong><span>{w.title}</span><span>{count} / 7 天</span>
              <progress aria-label={`第 ${w.number} 周`} value={count} max={7} />
            </a>
          })}
        </nav>
      </section>
      <div ref={documentRef} className="learning-document" onClick={toggle} dangerouslySetInnerHTML={{ __html: roadmapHtml }} />
    </main>
  )
}
