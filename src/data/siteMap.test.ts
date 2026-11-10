import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { INVEST_GROUPS, NAV_ITEMS, findInvestEntry, isNavActive } from './siteMap'
import { isAbsoluteUrl, isNotesPath } from './notesLinks'

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')

describe('NAV_ITEMS', () => {
  it('共 4 项，顺序固定；「投资」就是首页', () => {
    expect(NAV_ITEMS.map(i => i.label)).toEqual(['投资', '笔记', '博客', '关于'])
    expect(NAV_ITEMS.map(i => i.path)).toEqual(['/', '/notes', '/blog', '/about'])
  })
})

describe('已删除的栏目', () => {
  it('App.tsx 不再有 AI 实验室、自由空间、AI 工具与已舍弃页面的路由', () => {
    for (const path of ['/ai', '/ai/:slug', '/ai/dev-team', '/life', '/invest/ai-tools', '/trading-philosophy', '/investment-strategy', '/mainland-investment-targets', '/investment-targets']) {
      expect(appSource, path).not.toContain(`path="${path}"`)
    }
  })

  it('投资页不再列出这些入口', () => {
    const paths = INVEST_GROUPS.flatMap(g => g.links).map(l => l.path)
    for (const path of ['/invest/ai-tools', '/trading-philosophy', '/investment-strategy', '/mainland-investment-targets', '/investment-targets']) {
      expect(paths, path).not.toContain(path)
    }
  })
})

describe('INVEST_GROUPS', () => {
  const allLinks = INVEST_GROUPS.flatMap(g => g.links)

  it('收纳全部入口，且无重复', () => {
    const paths = allLinks.map(l => l.path).sort()
    expect(paths).toEqual([
      '/dcf', '/first-book', '/future-trends', 'https://businessweb-c0u.pages.dev/note/lab/etf-review/', 'https://businessweb-c0u.pages.dev/note/lab/grid-trading/', '/invest/etf', '/industry-landscape', '/investment-plan-2026',
      '/notes', '/industry-etf', '/invest/national-team', '/watch', '/daily-analysis',
      'https://businessweb-c0u.pages.dev/note/lab/stock/#stock-analysis', 'https://businessweb-c0u.pages.dev/note/lab/stock/#sector-rotation', 'https://businessweb-c0u.pages.dev/note/lab/stock/#plate-ranking',
      '/monitor', '/pulse', '/research-notes',
      '/valuation',
    ].sort())
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('每个入口路径都在 App.tsx 路由表里（/note/ 开头的是 notes 站点的静态页面，不在前端路由里；完整地址属于别的站点）', () => {
    for (const l of allLinks) {
      if (isNotesPath(l.path) || isAbsoluteUrl(l.path)) continue
      expect(appSource.includes(`path="${l.path}"`) || appSource.includes(`path="${l.path}/*"`), l.path).toBe(true)
    }
  })

  it('没有 VITE_NOTES_PATH 时网格入口直接指向部署了 notes 的站点上的计算器；设置后指向站内的 /note/ 路径', async () => {
    expect(INVEST_GROUPS.flatMap(g => g.links).some(l => l.path === 'https://businessweb-c0u.pages.dev/note/lab/grid-trading/')).toBe(true)
    vi.resetModules()
    vi.stubEnv('VITE_NOTES_PATH', '/note/')
    const withNotes = await import('./siteMap')
    const paths = withNotes.INVEST_GROUPS.flatMap(g => g.links).map(l => l.path)
    expect(paths).toContain('/note/lab/grid-trading/')
    expect(paths).not.toContain('https://businessweb-c0u.pages.dev/note/lab/grid-trading/')
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('分组顺序：读书 → 定规则 → 观察盘 → 分析筛选 → 工具与参考', () => {
    expect(INVEST_GROUPS.map(g => g.id)).toEqual(['read', 'method', 'watch', 'research', 'tools'])
  })

  it('观察盘组直接展开，观察盘在最前，细节页跟在后面', () => {
    const watch = INVEST_GROUPS.find(g => g.id === 'watch')!
    expect(watch.collapsed).toBe(false)
    expect(watch.links.map(l => l.path)).toEqual(['/watch', '/monitor', '/pulse', '/daily-analysis', 'https://businessweb-c0u.pages.dev/note/lab/etf-review/', 'https://businessweb-c0u.pages.dev/note/lab/stock/#stock-analysis', 'https://businessweb-c0u.pages.dev/note/lab/stock/#sector-rotation', 'https://businessweb-c0u.pages.dev/note/lab/stock/#plate-ranking'])
  })

  it('分析筛选组从行业到公司，不放带具体买卖建议的观察池', () => {
    const research = INVEST_GROUPS.find(g => g.id === 'research')!
    expect(research.links.map(l => l.path)).toEqual(['/industry-landscape', '/future-trends', '/research-notes', '/invest/national-team', '/notes', '/industry-etf'])
  })

  it('宏观温度（原每日监控）归入观察盘，作为观察盘的细节页', () => {
    const watch = INVEST_GROUPS.find(g => g.id === 'watch')!
    expect(watch.links.map(l => [l.path, l.label])).toContainEqual(['/monitor', '宏观温度'])
    expect(INVEST_GROUPS.find(g => g.id === 'method')!.links.map(l => l.path)).toEqual(['/investment-plan-2026'])
  })
})

describe('findInvestEntry', () => {
  it('精确匹配', () => {
    expect(findInvestEntry('/valuation')?.group.id).toBe('tools')
  })

  it('深层路径落在父入口所在分组，最长前缀优先', () => {
    expect(findInvestEntry('/research-notes/us/AAPL')?.link.path).toBe('/research-notes')
  })

  it('含编码字符的章节路径落在「读这本书」', () => {
    const e = findInvestEntry('/first-book/%E7%AC%AC1%E7%AB%A0.md')
    expect(e?.group.id).toBe('read')
    expect(e?.link.path).toBe('/first-book')
  })

  it('不按字符串前缀误判', () => {
    expect(findInvestEntry('/pulses')).toBeNull()
    expect(findInvestEntry('/nope')).toBeNull()
  })
})

describe('isNavActive', () => {
  it('根路径点亮「投资」', () => {
    expect(isNavActive('/', '/')).toBe(true)
  })

  it('任何收纳页面与 /invest 下的子页面都点亮「投资」', () => {
    expect(isNavActive('/', '/pulse')).toBe(true)
    expect(isNavActive('/', '/first-book/x.md')).toBe(true)
    expect(isNavActive('/', '/invest/etf')).toBe(true)
    expect(isNavActive('/', '/invest/national-team')).toBe(true)
  })

  it('同时是独立导航项的页面只点亮自己，不点亮「投资」', () => {
    expect(isNavActive('/', '/notes')).toBe(false)
    expect(isNavActive('/notes', '/notes/some-note')).toBe(true)
    expect(isNavActive('/', '/blog')).toBe(false)
    expect(isNavActive('/', '/about')).toBe(false)
  })

  it('未知路径无任何高亮', () => {
    for (const item of NAV_ITEMS) {
      expect(isNavActive(item.path, '/nope')).toBe(false)
    }
  })

  it('/about /blog 精确或子路径高亮', () => {
    expect(isNavActive('/about', '/about')).toBe(true)
    expect(isNavActive('/blog', '/blog/some-post')).toBe(true)
    expect(isNavActive('/about', '/aboutx')).toBe(false)
  })
})
