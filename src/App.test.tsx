import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import App from './App'

const appSource = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8')

beforeEach(() => {
  vi.stubGlobal('fetch', (() => new Promise(() => {})) as unknown as typeof fetch)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.pushState({}, '', '/')
})

describe('App 路由拆分', () => {
  it('重页面按路由懒加载，不随首包', () => {
    for (const page of [
      'TradingPhilosophy', 'InvestmentPlan2026', 'Pulse', 'Monitor',
      'ResearchNotes', 'CompanyDetail', 'Valuation', 'FirstBook', 'StockToolsMoved',
      'InvestmentStrategy', 'GridMoved', 'IndustryLandscape', 'Notes', 'NoteDetail', 'IndustryEtf',
    ]) {
      expect(appSource, page).toMatch(new RegExp(`const ${page} = lazy\\(\\(\\) => import\\('\\./pages/${page}'\\)\\)`))
      expect(appSource, page).not.toMatch(new RegExp(`^import ${page} from`, 'm'))
    }
  })

  it('首页与小页面保持同步加载，避免首屏闪烁', () => {
    for (const page of ['Home', 'InvestHub', 'AiStudio', 'LifeLab', 'NotFound']) {
      expect(appSource, page).toMatch(new RegExp(`^import ${page} from`, 'm'))
    }
  })

  it('懒加载页面首次进入时先显示加载提示，随后渲染页面', async () => {
    window.history.pushState({}, '', '/about')
    render(<App />)
    expect(screen.getByRole('status').textContent).toContain('加载中')
    expect(await screen.findByRole('heading', { level: 2, name: '关于「Live」' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('未知路径仍渲染 404，不触发加载提示', () => {
    window.history.pushState({}, '', '/nope')
    render(<App />)
    expect(screen.getByRole('heading', { name: '这一页不存在' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('顶栏与页脚始终在，不因页面加载而消失', () => {
    window.history.pushState({}, '', '/pulse')
    render(<App />)
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeTruthy()
    expect(screen.getByRole('contentinfo').textContent).toContain('Live')
  })
})
