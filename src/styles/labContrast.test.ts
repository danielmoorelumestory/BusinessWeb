import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, 'shell.css'), 'utf8')
const rule = (selector: string): string => {
  const i = css.indexOf(selector + ' {')
  expect(i, selector).toBeGreaterThan(-1)
  return css.slice(i, css.indexOf('}', i))
}

describe('AI 实验室徽章对比度', () => {
  it('可以试 / 实验 徽章文字不用强调色琥珀（对白色卡片仅 3.2:1，不到 AA 的 4.5:1），只用它描边', () => {
    const r = rule('.lab-badge--try,\n.lab-badge--experiment')
    expect(r).toContain('color: var(--text-primary)')
    expect(r).toContain('border-color: var(--accent-warm)')
  })

  it('不推荐卡片不再降低不透明度', () => {
    expect(css).not.toMatch(/\.lab-card--avoid\s*\{[^}]*opacity/)
  })
})
