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
  it('分组内页面显示面包屑：投资 › 页面名，「投资」指向首页', () => {
    renderAt('/valuation')
    const crumb = screen.getByRole('navigation', { name: '面包屑' })
    const links = within(crumb).getAllByRole('link')
    expect(links.map(a => a.textContent)).toEqual(['投资'])
    expect(links[0].getAttribute('href')).toBe('/')
    expect(crumb.textContent).toContain('公司估值')
  })

  it('同组切换条列出同组页面，当前项高亮', () => {
    renderAt('/valuation')
    const tabs = screen.getByRole('navigation', { name: '同组页面' })
    const links = within(tabs).getAllByRole('link')
    expect(links.map(a => a.textContent)).toEqual(['公司估值', '现金流折现 DCF', '网格交易', 'ETF 流派地图'])
    expect(links[0].getAttribute('aria-current')).toBe('page')
    expect(links[1].getAttribute('aria-current')).toBeNull()
  })

  it('深层路径仍落在同组并高亮父入口', () => {
    renderAt('/dcf/abc')
    const tabs = screen.getByRole('navigation', { name: '同组页面' })
    const current = within(tabs).getAllByRole('link').find(a => a.getAttribute('aria-current') === 'page')
    expect(current?.textContent).toBe('现金流折现 DCF')
  })

  it('首页、关于、已删除的栏目与未知路径都不渲染', () => {
    for (const p of ['/', '/invest', '/about', '/ai', '/life', '/trading-philosophy', '/invest/ai-tools', '/nope']) {
      const { container, unmount } = renderAt(p)
      expect(container.innerHTML, p).toBe('')
      unmount()
    }
  })
})
