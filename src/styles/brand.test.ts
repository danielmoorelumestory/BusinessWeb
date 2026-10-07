import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string): string => readFileSync(resolve(__dirname, '../../', p), 'utf8')

describe('品牌文件', () => {
  it('manifest 名称、描述、主题色都是Live / 纸色', () => {
    const m = JSON.parse(read('public/manifest.webmanifest'))
    expect(m.name).toBe('Live')
    expect(m.short_name).toBe('Live')
    expect(m.description).toContain('投资')
    expect(m.theme_color).toBe('#FAF6EE')
    expect(m.background_color).toBe('#FAF6EE')
  })

  it('图标改为纸底暗绿叶片，不再是黑底绿折线', () => {
    for (const f of ['public/favicon.svg', 'public/favicon-32.svg']) {
      const svg = read(f)
      expect(svg, f).not.toContain('#0A0A0A')
      expect(svg, f).not.toContain('#3DDC84')
      expect(svg, f).toContain('#FAF6EE')
      expect(svg, f).toContain('#5B7B65')
    }
  })

  it('index.css 里不再保留无人引用的 fadeInScale 别名', () => {
    expect(read('src/index.css')).not.toContain('fadeInScale')
  })

  it('字体自托管：不再请求 Google Fonts，由本地 @fontsource 提供', () => {
    const html = read('index.html')
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).not.toContain('fonts.gstatic.com')
    const main = read('src/main.tsx')
    // 600.css / 700.css 是按 unicode-range 切片的版本，浏览器只会下载页面用到的字形片
    expect(main).toMatch(/@fontsource\/noto-serif-sc\/600\.css/)
    expect(main).toMatch(/@fontsource\/noto-serif-sc\/700\.css/)
    expect(main).not.toMatch(/chinese-simplified-\d+\.css/)
  })

  it('标题不再使用衬线字体：--font-serif 暂时指向系统无衬线字体栈', () => {
    const css = read('src/index.css')
    expect(css).toMatch(/--font-serif:\s*var\(--font-sans\)/)
    expect(css).not.toMatch(/--font-serif:\s*"Noto Serif SC"/)
  })
})
