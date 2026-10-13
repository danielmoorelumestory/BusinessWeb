import React from 'react'
import { Link } from 'react-router-dom'
import { Marked } from 'marked'
import { Page } from '../components/ui'
import markdown from '../content/dev-team-README.md?raw'
import downloadUrl from '../content/dev-team-README.md?url'
import '../styles/ai-learning.css'
import '../styles/skill-guide.css'

const sections: { title: string; id: string }[] = []
const parser = new Marked({ renderer: {
  heading({ depth, text, tokens }) {
    if (depth === 1) return '' // The page header supplies the document title.
    const id = depth === 2 ? `dev-team-section-${sections.length + 1}` : ''
    if (id) sections.push({ title: text.replace(/`/g, ''), id })
    return `<h${depth}${id ? ` id="${id}"` : ''}>${this.parser.parseInline(tokens)}</h${depth}>\n`
  },
} })
// Only the reviewed, repository-owned README is rendered, never user input.
const html = parser.parse(markdown) as string

export default function DevTeamGuide(): JSX.Element {
  return (
    <Page variant="reading" className="lab-page learning-page skill-guide-page">
      <Link to="/ai#lab-skills" className="lab-back">← 返回 AI 实验室</Link>
      <header className="page-head">
        <h1>dev-team 使用说明</h1>
        <p>从安装、自检和项目配置开始，了解派工、审查、交接与验证范围。</p>
        <div className="skill-download-actions">
          <a className="skill-download" href={`${import.meta.env.BASE_URL}ai-skills/dev-team.zip`} download="dev-team.zip">下载 dev-team ZIP</a>
          <a className="skill-guide" href={downloadUrl} download="dev-team-README.md">下载原文（Markdown）</a>
        </div>
      </header>
      <nav className="skill-guide-toc" aria-label="使用说明目录">
        <ol>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
      </nav>
      <article className="learning-document" aria-label="dev-team 完整使用说明" dangerouslySetInnerHTML={{ __html: html }} />
    </Page>
  )
}
