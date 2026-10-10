import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PageTabs } from './PageTabs'

afterEach(cleanup)

const ITEMS = [
  { id: 'a', label: '总览' },
  { id: 'b', label: '配置' },
  { id: 'c', label: '复盘' },
] as const

function Harness(): JSX.Element {
  const [v, setV] = useState<'a' | 'b' | 'c'>('a')
  return <PageTabs items={[...ITEMS]} value={v} onChange={setV} label="测试页签" />
}

describe('PageTabs 键盘操作', () => {
  it('只有当前页签在 Tab 顺序里', () => {
    render(<Harness />)
    expect(screen.getByRole('tab', { name: '总览' }).getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('tab', { name: '配置' }).getAttribute('tabindex')).toBe('-1')
  })

  it('方向键循环切换并移动焦点，Home/End 跳到首尾', () => {
    render(<Harness />)
    const list = screen.getByRole('tablist')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: '配置' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: '配置' }))
    fireEvent.keyDown(list, { key: 'End' })
    expect(screen.getByRole('tab', { name: '复盘' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: '总览' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(list, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: '复盘' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(list, { key: 'Home' })
    expect(screen.getByRole('tab', { name: '总览' }).getAttribute('aria-selected')).toBe('true')
  })

  it('其他按键不拦截', () => {
    render(<Harness />)
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'a' })
    expect(screen.getByRole('tab', { name: '总览' }).getAttribute('aria-selected')).toBe('true')
  })
})
