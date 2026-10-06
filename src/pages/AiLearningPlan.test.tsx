import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AiLearningPlan from './AiLearningPlan'

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const wrap = () => render(<MemoryRouter><AiLearningPlan /></MemoryRouter>)

it('完整展示计划，每一天都能单独勾选，目录链接指向实际章节', () => {
  const { container } = wrap()
  expect(screen.getByRole('heading', { level: 1, name: 'AI 全栈 8 周实战学习路线' })).toBeTruthy()
  for (let day = 1; day <= 56; day++) expect(screen.getByRole('checkbox', { name: `Day ${day} 已完成`, exact: true })).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: '正式域名可以通过 HTTPS 访问。' })).toBeTruthy()
  for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    expect(container.querySelector(`[id="${decodeURIComponent(link.hash.slice(1))}"]`), link.textContent ?? '').toBeTruthy()
  }
  expect(screen.getByRole('link', { name: '下载学习计划（Markdown）' }).getAttribute('download')).toBe('AI全栈8周学习路线.md')
})

it('勾选和取消更新总体与每周进度，重新进入后恢复', () => {
  const first = wrap()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Day 1 已完成', exact: true }))
  expect(within(screen.getByLabelText('学习进度')).getByText('已完成 1 / 56 天')).toBeTruthy()
  expect(screen.getByLabelText('Week 1 学习进度').textContent).toContain('1 / 7 天')
  first.unmount()
  wrap()
  expect((screen.getByRole('checkbox', { name: 'Day 1 已完成', exact: true }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Day 1 已完成', exact: true }))
  expect(within(screen.getByLabelText('学习进度')).getByText('已完成 0 / 56 天')).toBeTruthy()
})

it('验收项进度独立保存，损坏的存储不阻止使用', () => {
  localStorage.setItem('businessweb.ai-fullstack-progress.v1', '{broken')
  const first = wrap()
  const label = 'Watchlist 的添加、删除、搜索和排序可运行。'
  fireEvent.click(screen.getByRole('checkbox', { name: label }))
  first.unmount()
  wrap()
  expect((screen.getByRole('checkbox', { name: label }) as HTMLInputElement).checked).toBe(true)
  expect(within(screen.getByLabelText('学习进度')).getByText('已完成 0 / 56 天')).toBeTruthy()
})

it('存储不可写时明确提示进度未保存', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  wrap()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Day 1 已完成', exact: true }))
  expect(screen.getByRole('alert').textContent).toContain('无法保存')
})
