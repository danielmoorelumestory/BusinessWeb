import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MarketCard } from '../components/pulse/MarketCard'

afterEach(cleanup)

const root = resolve(__dirname, '..')
const read = (p: string): string => readFileSync(resolve(root, p), 'utf8')
const tsxIn = (dir: string): string[] =>
  readdirSync(resolve(root, dir))
    .filter(f => f.endsWith('.tsx') && !f.includes('.test.') && !/Heatmap/.test(f))
    .map(f => join(dir, f))

describe('涨跌色语义：--up/--down 只表示 A 股红涨绿跌', () => {
  it('脉搏页（美股习惯：绿涨红跌）与监控页不再借用 --up/--down，改用中性颜色名', () => {
    const files = ['pages/Pulse.tsx', ...tsxIn('components/pulse'), ...tsxIn('components/monitor')]
    for (const f of files) {
      const src = read(f)
      expect(src, f).not.toMatch(/var\(--up\)|var\(--down\)/)
    }
  })

  it('MarketCard：上涨用绿、下跌用红（视觉不变），变量是中性的 system-green / system-red', () => {
    const base = { symbol: 'AAPL', name: '苹果', price: 100, change: 1, changePercent: 1 }
    const up = render(React.createElement(MarketCard, { stock: base as never, color: '#000' }))
    expect(up.container.innerHTML).toContain('var(--system-green)')
    expect(up.container.innerHTML).not.toContain('var(--system-red)')
    up.unmount()
    const down = render(React.createElement(MarketCard, { stock: { ...base, change: -1, changePercent: -1 } as never, color: '#000' }))
    expect(down.container.innerHTML).toContain('var(--system-red)')
    expect(down.container.innerHTML).not.toContain('var(--system-green)')
  })
})

describe('样式小问题', () => {
  it('valuation.css 没有 var(--x, var(--x)) 这种自己引用自己的回退', () => {
    const css = read('components/valuation/valuation.css')
    expect(css).not.toMatch(/var\((--[a-z0-9-]+),\s*var\(\1\)\)/)
  })

  it('章节目录里不可点击的条目鼠标样式为 default', () => {
    expect(read('styles/shell.css')).toMatch(/\.chapter-nav__item\.is-disabled\s*\{[^}]*cursor:\s*default/)
  })
})
