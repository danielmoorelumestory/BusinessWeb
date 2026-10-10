import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string): string => readFileSync(resolve(__dirname, '../../', p), 'utf8')

describe('品牌文件', () => {
  it('manifest 名称、描述、主题色都是 Live / 冷灰蓝页面底色', () => {
    const m = JSON.parse(read('public/manifest.webmanifest'))
    expect(m.name).toBe('Live')
    expect(m.short_name).toBe('Live')
    expect(m.description).toContain('投资')
    expect(m.theme_color).toBe('#f5f7fa')
    expect(m.background_color).toBe('#f5f7fa')
  })

  it('图标改为浅灰蓝底蓝色叶片，不再是纸底暗绿，也不是黑底绿折线', () => {
    for (const f of ['public/favicon.svg', 'public/favicon-32.svg']) {
      const svg = read(f)
      expect(svg, f).not.toContain('#0A0A0A')
      expect(svg, f).not.toContain('#3DDC84')
      expect(svg, f).not.toContain('#FAF6EE')
      expect(svg, f).not.toContain('#5B7B65')
      expect(svg, f).toContain('#f5f7fa')
      expect(svg, f).toContain('#1d4ed8')
    }
  })

  it('index.html 的 theme-color 与 manifest、页面底色一致', () => {
    expect(read('index.html')).toContain('<meta name="theme-color" content="#f5f7fa" />')
  })

  it('index.css 里不再保留无人引用的 fadeInScale 别名', () => {
    expect(read('src/index.css')).not.toContain('fadeInScale')
  })

  it('不加载任何 Web 字体：不请求 Google Fonts，也不引入 @fontsource，package.json 不再依赖它', () => {
    const html = read('index.html')
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).not.toContain('fonts.gstatic.com')
    expect(read('src/main.tsx')).not.toMatch(/@fontsource/)
    const pkg = JSON.parse(read('package.json'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(Object.keys(deps).filter(name => name.startsWith('@fontsource'))).toEqual([])
  })

  it('public 下的静态研究报告也不加载网络字体、不用衬线字体', () => {
    for (const f of ['public/research/cn-roundtable-2026-09-30.html', 'public/research/sp500-roundtable-2026-09-30.html']) {
      const html = read(f)
      expect(html, f).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
      expect(html, f).not.toMatch(/Noto Serif|Source Han Serif|Songti|Georgia/)
      expect(html, f).toContain('-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif')
    }
  })

  it('全站只用系统无衬线：任何 CSS 都不再引用 --font-serif，也没有衬线字体名（扫描 src 下全部 CSS，包括以后新增的）', () => {
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(resolve(__dirname, '../../', dir))) {
        const rel = `${dir}/${name}`
        if (statSync(resolve(__dirname, '../../', rel)).isDirectory()) walk(rel)
        else if (name.endsWith('.css')) files.push(rel)
      }
    }
    walk('src')
    expect(files.length).toBeGreaterThan(5)
    for (const f of files) {
      const css = read(f)
      expect(css, f).not.toMatch(/--font-serif/)
      expect(css, f).not.toMatch(/Noto Serif|Songti|STSong|SimSun/)
    }
  })
})
