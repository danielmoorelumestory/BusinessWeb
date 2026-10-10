import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import InvestHub from './InvestHub'
import LifeLab from './LifeLab'
import { INVEST_GROUPS } from '../data/siteMap'

afterEach(cleanup)

const wrap = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>)

describe('InvestHub', () => {
  it('渲染全部分组标题与每个入口链接', () => {
    wrap(<InvestHub />)
    for (const g of INVEST_GROUPS) {
      expect(screen.getByText(g.title), g.title).toBeTruthy()
      for (const l of g.links) {
        const a = screen.getAllByRole('link').find(x => x.getAttribute('href') === l.path)
        expect(a, l.path).toBeTruthy()
      }
    }
  })

  it('看行情组直接展开，并带提示语', () => {
    const { container } = wrap(<InvestHub />)
    const group = screen.getByRole('heading', { name: '看行情（选看）' }).closest('section')
    expect(group?.closest('details')).toBeNull()
    expect(within(group as HTMLElement).getByText(/少看行情/)).toBeTruthy()
    expect(within(group as HTMLElement).getAllByRole('link')).toHaveLength(4)
  })

  it('已舍弃组默认折叠，放在页面最后', () => {
    const { container } = wrap(<InvestHub />)
    const folds = container.querySelectorAll('details')
    expect(folds).toHaveLength(1)
    expect(folds[0].open).toBe(false)
    expect(folds[0].querySelector('summary')?.textContent).toBe('已舍弃')
    expect(container.querySelector('main')?.lastElementChild).toBe(folds[0])
  })

  it('「读这本书」突出显示并链接到 /first-book', () => {
    wrap(<InvestHub />)
    expect(screen.getByRole('link', { name: /我的书/ }).getAttribute('href')).toBe('/first-book')
  })
})

describe('LifeLab', () => {
  it('LifeLab 标出“准备中”并给出阶段', () => {
    wrap(<LifeLab />)
    expect(screen.getByRole('heading', { level: 1, name: '自由空间' })).toBeTruthy()
    expect(screen.getAllByText('准备中').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/400/).length).toBeGreaterThan(0)
  })

  it('LifeLab 不公开起始金额：用 *** 代替，只写目标 400 万', () => {
    const { container } = wrap(<LifeLab />)
    expect(container.textContent).not.toMatch(/300/)
    expect(screen.getByRole('heading', { level: 2, name: '*** → 目标 400 万' })).toBeTruthy()
  })
})
