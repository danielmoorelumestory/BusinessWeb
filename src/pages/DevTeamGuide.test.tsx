import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import DevTeamGuide from './DevTeamGuide'
import DevTeamSkillCard from '../components/skills/DevTeamSkillCard'

afterEach(cleanup)

it('完整展示 README 的七节说明、前置条件表格和配置示例', () => {
  const { container } = render(<MemoryRouter><DevTeamGuide /></MemoryRouter>)
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  const document = within(screen.getByRole('article', { name: 'dev-team 完整使用说明' }))
  expect(document.getAllByRole('heading', { level: 2 })).toHaveLength(7)
  expect(document.getByRole('heading', { name: '1. 前置条件' })).toBeTruthy()
  expect(document.getByRole('heading', { name: '7. 升级与再打包' })).toBeTruthy()
  expect(document.getByRole('table').textContent).toContain('20+')
  expect(document.getByText(/额度耗尽后的接力/)).toBeTruthy()
  expect(container.querySelector('pre code.language-json')?.textContent).toContain('"paths"')
  expect(container.querySelector('pre code.language-bash')?.textContent).toContain('doctor --models')
})

it('目录指向网页内的实际章节，原文明确作为 Markdown 下载', () => {
  const { container } = render(<MemoryRouter><DevTeamGuide /></MemoryRouter>)
  const links = within(screen.getByRole('navigation', { name: '使用说明目录' })).getAllByRole('link')
  expect(links).toHaveLength(7)
  for (const link of links) expect(container.querySelector(link.getAttribute('href')!)).toBeTruthy()
  expect(screen.getByRole('link', { name: '下载原文（Markdown）' }).getAttribute('download')).toBe('dev-team-README.md')
  expect(screen.getByRole('link', { name: '下载 dev-team ZIP' }).getAttribute('download')).toBe('dev-team.zip')
})

it.each([DevTeamSkillCard])('阅读入口指向网页说明，避免直接打开原始 Markdown（%s）', Component => {
  render(<MemoryRouter><Component /></MemoryRouter>)
  expect(screen.getByRole('link', { name: '使用说明 README' }).getAttribute('href')).toBe('/ai/dev-team')
})
