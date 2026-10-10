import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import SectionChrome from './SectionChrome'

afterEach(cleanup)

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SectionChrome />
    </MemoryRouter>
  )

describe('SectionChrome', () => {
  it('分组内页面显示面包屑：Live › 投资 › 页面名', () => {
    renderAt('/valuation')
    const crumb = screen.getByRole('navigation', { name: '面包屑' })
    expect(within(crumb).getAllByRole('link').map(a => a.textContent)).toEqual(['Live', '投资'])
    expect(crumb.textContent).toContain('公司估值')
  })

  it('同组切换条列出同组页面，当前项高亮', () => {
    renderAt('/valuation')
    const tabs = screen.getByRole('navigation', { name: '同组页面' })
    const links = within(tabs).getAllByRole('link')
    expect(links.map(a => a.textContent)).toEqual(['公司估值', '现金流折现 DCF', '网格交易', 'AI 工具'])
    expect(links[0].getAttribute('aria-current')).toBe('page')
    expect(links[1].getAttribute('aria-current')).toBeNull()
  })

  it('深层路径仍落在同组并高亮父入口', () => {
    renderAt('/grid-trading/records/abc')
    const tabs = screen.getByRole('navigation', { name: '同组页面' })
    const current = within(tabs).getAllByRole('link').find(a => a.getAttribute('aria-current') === 'page')
    expect(current?.textContent).toBe('网格交易')
  })

  it('已舍弃页面顶部显示舍弃说明，正常页面不显示', () => {
    renderAt('/trading-philosophy')
    expect(screen.getByRole('note').textContent).toMatch(/已舍弃.*短线/)
    cleanup()
    renderAt('/valuation')
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('/invest 本身、首页、/ai、未知路径都不渲染', () => {
    for (const p of ['/invest', '/', '/ai', '/life', '/about', '/nope']) {
      const { container, unmount } = renderAt(p)
      expect(container.innerHTML, p).toBe('')
      unmount()
    }
  })
})
