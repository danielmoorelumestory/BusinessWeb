import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import AiStudio from './AiStudio'
import { LAB_SHOWCASE, avoidedDirections, recommendedDirections } from '../data/aiLab'

afterEach(cleanup)

const wrap = () => render(<MemoryRouter><AiStudio /></MemoryRouter>)

describe('AiStudio', () => {
  it('可以从学习计划入口进入八周路线', () => {
    wrap()
    expect(screen.getByRole('link', { name: /AI 全栈 8 周学习路线/ }).getAttribute('href')).toBe('/ai/fullstack-roadmap')
  })
  it('页头：标题与统计', () => {
    wrap()
    expect(screen.getByRole('heading', { level: 1, name: 'AI实验室' })).toBeTruthy()
    expect(screen.getByText('作品 4 · 进行中 2 · 已停止 0')).toBeTruthy()
  })

  it('作品橱窗 4 个链接，放在可横向滑动的容器里', () => {
    const { container } = wrap()
    const shelf = container.querySelector('.lab-showcase') as HTMLElement
    expect(shelf).toBeTruthy()
    expect(within(shelf).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(LAB_SHOWCASE.map(s => s.path))
    expect(container.querySelector('main')?.classList.contains('lab-page')).toBe(true)
  })

  it('推荐组卡片顺序与数据排序一致，每张卡带标记、星级、状态', () => {
    wrap()
    const section = screen.getByRole('heading', { level: 2, name: '推荐方向' }).closest('section') as HTMLElement
    const links = within(section).getAllByRole('link')
    expect(links.map(a => a.getAttribute('href'))).toEqual(recommendedDirections().map(d => `/ai/${d.slug}`))
    const first = links[0]
    expect(within(first).getByText('强烈推荐')).toBeTruthy()
    expect(within(first).getByLabelText('匹配度 5/5')).toBeTruthy()
    expect(within(first).getByText('进行中')).toBeTruthy()
  })

  it('无货源电商卡片标为“实验”', () => {
    wrap()
    const card = screen.getByRole('link', { name: /无货源电商/ })
    expect(within(card).getByText('实验')).toBeTruthy()
    expect(within(card).getByLabelText('匹配度 2/5')).toBeTruthy()
  })

  it('不推荐组在默认收起的 details 里，写明数量', () => {
    const { container } = wrap()
    const fold = container.querySelector('details') as HTMLDetailsElement
    expect(fold.open).toBe(false)
    expect(fold.querySelector('summary')?.textContent).toBe(`不推荐（${avoidedDirections().length}）`)
    expect(within(fold).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(
      avoidedDirections().map(d => `/ai/${d.slug}`)
    )
  })

  it('最后是实验规则', () => {
    wrap()
    expect(screen.getByRole('heading', { level: 2, name: '实验规则' })).toBeTruthy()
  })
})
