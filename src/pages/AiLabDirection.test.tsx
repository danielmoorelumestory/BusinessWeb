import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import AiLabDirection from './AiLabDirection'

afterEach(cleanup)

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/ai/:slug" element={<AiLabDirection />} /></Routes>
    </MemoryRouter>
  )

describe('AiLabDirection', () => {
  it('推荐方向：标题、标记、为什么做、返回链接', () => {
    at('/ai/indie-dev')
    expect(screen.getByRole('heading', { level: 1, name: '独立产品开发' })).toBeTruthy()
    expect(screen.getByText('强烈推荐')).toBeTruthy()
    expect(screen.getByLabelText('匹配度 5/5')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '为什么做' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /AI实验室/ }).getAttribute('href')).toBe('/ai')
  })

  it('有日志的方向显示日志', () => {
    at('/ai/indie-dev')
    expect(screen.getByRole('heading', { level: 2, name: '实验日志' })).toBeTruthy()
    expect(screen.getByText('2026-10-04')).toBeTruthy()
  })

  it('无日志的方向显示“还没开始”', () => {
    at('/ai/blog')
    expect(screen.getByText('还没开始。开始后会在这里公开记录。')).toBeTruthy()
  })

  it('无货源电商显示实验边界', () => {
    at('/ai/dropshipping')
    expect(screen.getByRole('heading', { level: 2, name: '实验边界' })).toBeTruthy()
    expect(screen.getByText('30 天；累计投入不超过 30 小时')).toBeTruthy()
    expect(screen.getByText(/首轮建议 ¥2000/)).toBeTruthy()
    expect(screen.getByText(/触及损失或工时上限、平台准入不明确/)).toBeTruthy()
  })

  it('不推荐方向：为什么不做，无日志块、无实验边界', () => {
    at('/ai/paid-signals')
    expect(screen.getByRole('heading', { level: 2, name: '为什么不做' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: '实验日志' })).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: '实验边界' })).toBeNull()
    expect(screen.queryByText(/还没开始/)).toBeNull()
  })

  it('未知 slug 显示 404', () => {
    at('/ai/nope')
    expect(screen.getByRole('heading', { level: 1, name: '这一页不存在' })).toBeTruthy()
  })
})
