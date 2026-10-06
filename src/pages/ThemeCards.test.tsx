import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ThemeCards from './ThemeCards'

beforeEach(() => localStorage.clear())
afterEach(() => cleanup())

describe('主题研究卡页', () => {
  it('不预填任何产业判断：新建一张卡，11 个字段全空，并提示缺证伪条件', () => {
    render(<ThemeCards />)
    fireEvent.click(screen.getByRole('button', { name: '固态电池' }))
    expect(screen.getByText(/已填 0\/11/)).toBeTruthy()
    expect(screen.getByText(/还没写证伪条件/)).toBeTruthy()
    expect(document.querySelectorAll('textarea')).toHaveLength(11)
    for (const t of Array.from(document.querySelectorAll('textarea'))) expect((t as HTMLTextAreaElement).value).toBe('')
  })

  it('填写后保存在本地，刷新后还在，仓位合计跟着变', () => {
    const { unmount } = render(<ThemeCards />)
    fireEvent.click(screen.getByRole('button', { name: '半导体' }))
    fireEvent.change(screen.getByLabelText(/仓位上限/), { target: { value: '5' } })
    fireEvent.change(document.querySelectorAll('textarea')[10], { target: { value: '连续两年国产化率不升' } })
    expect(screen.getByText(/合计 5%/)).toBeTruthy()
    unmount()
    render(<ThemeCards />)
    expect(screen.getByText(/已填 1\/11/)).toBeTruthy()
  })

  it('同名主题不重复新建，本地数据损坏时不崩溃', () => {
    localStorage.setItem('theme-cards-v1', '{坏数据')
    render(<ThemeCards />)
    const input = screen.getByLabelText('主题名称')
    for (let i = 0; i < 2; i++) {
      fireEvent.change(input, { target: { value: '商业航天' } })
      fireEvent.click(screen.getByRole('button', { name: '新建' }))
    }
    expect(screen.getAllByRole('region', { name: '商业航天' })).toHaveLength(1)
  })
})
