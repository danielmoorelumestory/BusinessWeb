import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import IndustryEtf from './IndustryEtf'

afterEach(cleanup)
const renderPage = () => render(<MemoryRouter><IndustryEtf /></MemoryRouter>)

describe('IndustryEtf', () => {
  it('显示 7 个行业组与 59 只 ETF，总数与各组数量一致，并有研究参考提示', () => {
    renderPage()
    expect(screen.getByText(/7 个行业组，共 59 只 ETF/)).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(7)
    const rows = screen.getAllByRole('row').filter(r => within(r).queryAllByRole('columnheader').length === 0)
    expect(rows).toHaveLength(59)
    expect(screen.getByRole('heading', { name: /TMT科技（16）/ })).toBeTruthy()
    expect(screen.getByText(/不构成投资建议/)).toBeTruthy()
  })

  it('站内参考链接用 Link 指向 /notes/<slug>', () => {
    renderPage()
    const link = screen.getByRole('link', { name: '机器人ETF对比研报：562500 vs 159530' })
    expect(link.getAttribute('href')).toBe('/notes/robotics-industry-research')
    expect(link.getAttribute('target')).toBeNull()
  })

  it('外部参考链接在新标签页打开并带 rel=noopener noreferrer', () => {
    renderPage()
    for (const a of screen.getAllByRole('link').filter(a => /^https?:\/\//.test(a.getAttribute('href') ?? ''))) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })
})
