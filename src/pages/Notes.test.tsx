import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import Notes from './Notes'
import { NOTES } from '../data/notes'

afterEach(cleanup)
const renderAt = (path = '/notes') => render(<MemoryRouter initialEntries={[path]}><Notes /></MemoryRouter>)
const titles = () => within(screen.getByRole('region', { name: '笔记列表' })).getAllByRole('heading', { level: 3 }).map(h => h.textContent)

describe('Notes 列表', () => {
  it('按日期倒序列出全部笔记，每篇有日期、摘要、标签，标题链接到详情', () => {
    renderAt()
    // 篇数与标题都从数据推导，新增笔记时不用再改这个测试
    const expected = [...NOTES].sort((a, b) => b.date.localeCompare(a.date)).map(note => note.title)
    expect(titles()).toEqual(expected)
    const link = screen.getByRole('link', { name: /机器人行业研究/ })
    expect(link.getAttribute('href')).toBe('/notes/robotics-industry-research')
    expect(screen.getByText('2026-09-23')).toBeTruthy()
    expect(screen.getByText(/含完整报告/)).toBeTruthy()
  })

  it('点击标签只显示带该标签的笔记，点「全部」清除筛选', () => {
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: /^行业研究 2$/ }))
    expect(titles()).toHaveLength(2)
    expect(screen.getByRole('button', { name: /^行业研究 2$/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^全部 ${NOTES.length}$`) }))
    expect(titles()).toHaveLength(NOTES.length)
  })

  it('地址里的 ?tag= 直接生效；没有匹配时提示', () => {
    renderAt('/notes?tag=网格交易')
    expect(titles()).toEqual(['ETF网格交易总方案（含逐只绝对价格网格）'])
    cleanup()
    renderAt('/notes?tag=不存在')
    expect(screen.getByText('没有符合的笔记。')).toBeTruthy()
  })
})
