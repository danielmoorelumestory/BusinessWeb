import React from 'react'
import { Marked } from 'marked'
import markdown from '../../content/dropshipping-strategy.md?raw'
import downloadUrl from '../../content/dropshipping-strategy.md?url'
import DropshippingCalculator from './DropshippingCalculator'
import '../../styles/ai-learning.css'
import '../../styles/skill-guide.css'

const sections: Array<{ title: string; id: string }> = []
const parser = new Marked({ renderer: {
  heading({ depth, text, tokens }) {
    if (depth === 1) return ''
    const id = depth === 2 ? `dropshipping-section-${sections.length + 1}` : ''
    if (id) sections.push({ title: text, id })
    return `<h${depth}${id ? ` id="${id}"` : ''}>${this.parser.parseInline(tokens)}</h${depth}>\n`
  },
} })
// 仅渲染随代码审阅的本地文章，不接收用户输入的 HTML。
const html = parser.parse(markdown) as string

export default function DropshippingStrategy(): JSX.Element {
  return <div className="dropshipping-strategy learning-page">
    <nav className="skill-guide-toc" aria-label="无货源电商实施目录">
      <ol>
        <li><a href="#dropshipping-calculator-title">利润测算</a></li>
        {sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}
      </ol>
    </nav>
    <div className="dropshipping-downloads">
      <a className="learning-download" href={downloadUrl} download="无货源电商-30天实施方案.md">下载完整方案</a>
      <a className="learning-download" href={`${import.meta.env.BASE_URL}templates/dropshipping-orders.csv`} download="无货源电商-订单记账模板.csv">下载订单记账模板</a>
    </div>
    <DropshippingCalculator />
    <article className="learning-document" aria-label="无货源电商说明与实施建议" dangerouslySetInnerHTML={{ __html: html }} />
  </div>
}
