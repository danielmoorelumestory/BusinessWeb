import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')

const TOKENS: Record<string, string> = {
  '--bg-primary': '#f5f7fa',
  '--bg-card': '#ffffff',
  '--bg-subtle': '#f7f9fc',
  '--text-primary': '#172033',
  '--text-secondary': '#667085',
  '--text-strong': '#344054',
  '--accent': '#1d4ed8',
  '--accent-warm': '#d97706',
  '--border-subtle': '#dde3ec',
  '--border-row': '#e6ebf2',
  '--up': '#dc2626',
  '--down': '#16a34a',
  '--ok': '#087443',
  '--ok-soft': '#e9f8ee',
  '--warn': '#966400',
  '--warn-soft': '#fff4d6',
  '--bad': '#b42318',
  '--bad-soft': '#ffebe9',
  '--radius-card': '12px',
  '--radius-pill': '999px',
}

describe('设计变量', () => {
  for (const [name, value] of Object.entries(TOKENS)) {
    it(`${name} = ${value}`, () => {
      const re = new RegExp(`${name}\\s*:\\s*${value}`, 'i')
      expect(css).toMatch(re)
    })
  }

  it('旧变量 --system-blue 映射到主色，老页面自动换肤', () => {
    expect(css).toMatch(/--system-blue\s*:\s*var\(--accent\)/)
  })

  it('旧的涨跌变量仍映射到涨跌色，而不是状态色（红涨绿跌不变）', () => {
    expect(css).toMatch(/--system-red\s*:\s*var\(--up\)/)
    expect(css).toMatch(/--system-green\s*:\s*var\(--down\)/)
  })

  it('状态色与涨跌色是两套独立变量：--ok/--warn/--bad 不引用 --up/--down', () => {
    for (const name of ['--ok', '--warn', '--bad']) {
      const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
      expect(m, name).not.toBeNull()
      expect(m![1], name).not.toMatch(/--up|--down/)
    }
  })

  it('字体只用系统无衬线：--font-sans 不含衬线或网络字体，--font-serif 不再指向衬线', () => {
    const sans = css.match(/--font-sans\s*:\s*([^;]+);/)![1]
    expect(sans).toBe('-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif')
    expect(css).not.toMatch(/Noto Serif|Songti|STSong|SimSun/)
    expect(css).toMatch(/--font-serif\s*:\s*var\(--font-sans\)/)
  })

  it('不再使用玻璃拟态 backdrop-filter', () => {
    expect(css).not.toMatch(/backdrop-filter\s*:\s*blur/)
  })

  it('index.html 为Live并启用 viewport-fit=cover', () => {
    expect(html).toContain('<title>Live')
    expect(html).toContain('viewport-fit=cover')
  })
})
