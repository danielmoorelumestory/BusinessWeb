import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import SmartLink from './SmartLink'
import { isNotesPath } from '../data/notesLinks'

afterEach(cleanup)

// 点击后事件是否被前端路由拦截：React 的处理函数先于 document 执行，Link 会调用 preventDefault，普通 <a> 不会
function clickIsIntercepted(element: Element): boolean {
  let prevented = false
  const record = (event: Event) => { prevented = event.defaultPrevented; event.preventDefault() }
  document.addEventListener('click', record)
  try { fireEvent.click(element) } finally { document.removeEventListener('click', record) }
  return prevented
}

const renderLink = (to: string) => render(<MemoryRouter><SmartLink to={to} className="x">链接</SmartLink></MemoryRouter>)

describe('SmartLink', () => {
  it('以 /note/ 开头的路径渲染成普通 <a>，点击不会被前端路由拦截', () => {
    renderLink('/note/lab/grid-trading/')
    const link = screen.getByRole('link', { name: '链接' })
    expect(link.getAttribute('href')).toBe('/note/lab/grid-trading/')
    expect(clickIsIntercepted(link)).toBe(false)
  })

  it('其余路径仍然由前端路由处理', () => {
    renderLink('/invest')
    const link = screen.getByRole('link', { name: '链接' })
    expect(link.getAttribute('href')).toBe('/invest')
    expect(clickIsIntercepted(link)).toBe(true)
  })

  it('属性与 ref 会透传', () => {
    const ref = React.createRef<HTMLAnchorElement>()
    render(<MemoryRouter><SmartLink to="/note/" ref={ref} aria-current="page" className="active">x</SmartLink></MemoryRouter>)
    expect(ref.current?.getAttribute('aria-current')).toBe('page')
    expect(ref.current?.className).toBe('active')
  })

  it('notesLinks 读取环境变量前先用 typeof 防护：构建期的 Node 步骤会间接导入它，纯 Node 里 import.meta.env 是 undefined', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../data/notesLinks.ts'), 'utf8')
    expect(source).toMatch(/typeof import\.meta\.env !== 'undefined'/)
  })

  it('isNotesPath：只认 /note 与 /note/ 开头，不会把 /notes-x 当成 notes', () => {
    expect(isNotesPath('/note')).toBe(true)
    expect(isNotesPath('/note/lab/')).toBe(true)
    expect(isNotesPath('/notes-x')).toBe(false)
    expect(isNotesPath('/grid-trading')).toBe(false)
  })
})
