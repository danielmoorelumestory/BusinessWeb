import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// 用 index.css 里的令牌值计算 WCAG 对比度。不达标时应调整令牌取值，而不是放宽阈值。
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

function token(name: string): string {
  const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`))
  if (!m) throw new Error(`令牌 ${name} 不是 6 位十六进制色值`)
  return m[1]
}

const channel = (v: number): number => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const AA = 4.5

describe('文字对比度（WCAG AA，正文 4.5:1）', () => {
  const pairs: Array<[string, string, string]> = [
    ['--text-primary', '--bg-card', '正文在白色卡片上'],
    ['--text-primary', '--bg-primary', '正文在页面底色上'],
    ['--text-secondary', '--bg-card', '次要文字在白色卡片上'],
    ['--text-secondary', '--bg-primary', '次要文字在页面底色上'],
    ['--text-strong', '--bg-subtle', '表头文字在表头底色上'],
    ['--accent', '--bg-card', '主色链接在白色卡片上'],
    ['--accent', '--bg-primary', '主色链接在页面底色上'],
    ['--ok', '--ok-soft', '“保留”胶囊文字'],
    ['--warn', '--warn-soft', '“减仓”胶囊文字'],
    ['--bad', '--bad-soft', '“退出”胶囊文字'],
    ['--text-primary', '--callout-info-bg', '蓝色提示块内的正文'],
    ['--text-primary', '--callout-warn-bg', '橙色提示块内的正文'],
    ['--text-primary', '--callout-bad-bg', '红色提示块内的正文'],
  ]
  for (const [fg, bg, label] of pairs) {
    it(`${label}：${fg} 对 ${bg} 不低于 ${AA}:1`, () => {
      const ratio = contrast(token(fg), token(bg))
      expect(ratio, `${fg} ${token(fg)} 对 ${bg} ${token(bg)} 实测 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
    })
  }

  it('主色按钮上的白色文字不低于 4.5:1', () => {
    expect(contrast('#ffffff', token('--accent'))).toBeGreaterThanOrEqual(AA)
  })
})
