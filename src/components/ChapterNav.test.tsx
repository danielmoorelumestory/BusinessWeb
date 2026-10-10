import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import ChapterNav, { type NavPart } from './ChapterNav'

afterEach(cleanup)

const PARTS: NavPart[] = [
  {
    id: 'opening', title: '开篇 美好的愿望',
    chapters: [{ no: '开篇', title: '美好的愿望', file: '开篇-美好的愿望.md', status: 'draft' }],
  },
  {
    id: 'part2', title: '第二部分 配置',
    chapters: [
      { no: '第7章', title: '先分清钱的用途', file: '第7章-钱的用途.md', status: 'draft' },
      { no: '第8章', title: '待写的一章', file: '', status: 'pending' },
    ],
  },
  {
    id: 'part3', title: '第三部分 取舍',
    chapters: [{ no: '第12章', title: '短线', file: '第12章 短线.md', status: 'done' }],
  },
]

const renderNav = (current = '第7章-钱的用途.md') =>
  render(
    <MemoryRouter>
      <ChapterNav parts={PARTS} currentFile={current} />
    </MemoryRouter>
  )

describe('ChapterNav', () => {
  it('当前章所在的部默认展开，当前章高亮', () => {
    renderNav()
    const cur = screen.getByRole('link', { name: /先分清钱的用途/ })
    expect(cur.getAttribute('aria-current')).toBe('page')
    expect(cur.getAttribute('href')).toBe('/first-book/read/' + encodeURIComponent('第7章-钱的用途.md'))
  })

  it('其他部默认折叠：章节链接不在页面里，点标题后出现', () => {
    renderNav()
    expect(screen.queryByRole('link', { name: /短线/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /第三部分 取舍/ }))
    const link = screen.getByRole('link', { name: /短线/ })
    expect(link.getAttribute('href')).toBe('/first-book/read/' + encodeURIComponent('第12章 短线.md'))
  })

  it('再点一次标题可收起，aria-expanded 同步', () => {
    renderNav()
    const head = screen.getByRole('button', { name: /第二部分 配置/ })
    expect(head.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: /先分清钱的用途/ })).toBeNull()
  })

  it('没有文件的章节不是链接，标为待撰写', () => {
    renderNav()
    const row = screen.getByText('待写的一章').closest('[aria-disabled="true"]')
    expect(row).toBeTruthy()
    expect(within(row as HTMLElement).queryByRole('link')).toBeNull()
  })

  it('手机目录栏：默认收起，点开后展开，选章节后自动收起', () => {
    const { container } = renderNav()
    const toggle = screen.getByRole('button', { name: /目录/ })
    const panel = container.querySelector('.chapter-nav__panel') as HTMLElement
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(panel.classList.contains('is-open')).toBe(false)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(panel.classList.contains('is-open')).toBe(true)
    fireEvent.click(screen.getByRole('link', { name: /先分清钱的用途/ }))
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('目录栏标题显示当前章，方便知道读到哪', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /目录/ }).textContent).toContain('第7章')
  })

  it('当前文件不在目录里（如修订记录）：不报错，也不高亮任何章', () => {
    renderNav('修订记录-第十四轮.md')
    expect(screen.queryAllByRole('link').filter(a => a.getAttribute('aria-current') === 'page')).toHaveLength(0)
  })

  it('当前文件含编码字符时仍能匹配', () => {
    renderNav(encodeURIComponent('第12章 短线.md'))
    const cur = screen.getByRole('link', { name: /短线/ })
    expect(cur.getAttribute('aria-current')).toBe('page')
  })

  it('有 nav 地标，名称为章节目录', () => {
    renderNav()
    expect(screen.getByRole('navigation', { name: '章节目录' })).toBeTruthy()
  })
})
