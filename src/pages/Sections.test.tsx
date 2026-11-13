import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import InvestHub from './InvestHub'
import { INVEST_GROUPS } from '../data/siteMap'

afterEach(cleanup)

const wrap = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>)

describe('InvestHub', () => {
  it('渲染全部分组标题与每个入口链接', () => {
    wrap(<InvestHub />)
    for (const g of INVEST_GROUPS) {
      expect(screen.getAllByText(g.title).length, g.title).toBeGreaterThan(0)
      for (const l of g.links) {
        const a = screen.getAllByRole('link').find(x => x.getAttribute('href') === l.path)
        expect(a, l.path).toBeTruthy()
      }
    }
  })

  it('观察盘组直接展开，并带提示语', () => {
    const { container } = wrap(<InvestHub />)
    const group = screen.getByRole('heading', { name: '第三步观察盘' }).closest('section')
    expect(group?.closest('details')).toBeNull()
    expect(within(group as HTMLElement).getByText(/每天看一眼观察盘/)).toBeTruthy()
    expect(within(group as HTMLElement).getAllByRole('link')).toHaveLength(9)
  })

  it('不再有「已舍弃」分组，也没有 AI 工具入口', () => {
    const { container } = wrap(<InvestHub />)
    expect(container.querySelectorAll('details')).toHaveLength(0)
    expect(screen.queryByText('已舍弃')).toBeNull()
    expect(screen.getAllByRole('link').some(a => a.getAttribute('href') === '/invest/ai-tools')).toBe(false)
  })

  it('「读这本书」突出显示并链接到 /first-book', () => {
    wrap(<InvestHub />)
    expect(screen.getByRole('link', { name: /我的书/ }).getAttribute('href')).toBe('/first-book')
  })
})
