import { describe, expect, it } from 'vitest'
import { renderBlogMarkdown } from './markdown'

describe('blog Markdown rendering', () => {
  it('renders tables and code while assigning distinct IDs to repeated Chinese headings', () => {
    const { html, toc } = renderBlogMarkdown('## 观察\n\n## 观察\n\n| 名称 | 值 |\n| --- | --- |\n| A | 1 |\n\n```js\nconst a = 1\n```', '/')
    expect(toc.map(h => h.id)).toEqual(['观察', '观察-2'])
    expect(html).toContain('<table>')
    expect(html).toContain('<code')
    expect(html).toContain('id="观察-2"')
  })
  it('blocks raw HTML, event handlers, and script URLs', () => {
    const { html } = renderBlogMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)\n\n[good](https://example.com)', '/')
    expect(html).not.toMatch(/<script|<img src=x|<[^>]*\bonerror=|href="javascript:/i)
    expect(html).toContain('href="https://example.com"')
  })
  it('prefixes local blog assets for Pages while keeping external links', () => {
    const { html } = renderBlogMarkdown('![图](/blog/assets/sample/chart.png) [文章](/blog/next) [外链](https://example.com)', '/BusinessWeb/')
    expect(html).toContain('src="/BusinessWeb/blog/assets/sample/chart.png"')
    expect(html).toContain('href="/BusinessWeb/blog/next"')
    expect(html).toContain('href="https://example.com"')
  })
})
