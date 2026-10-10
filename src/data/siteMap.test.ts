import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { INVEST_GROUPS, NAV_ITEMS, findInvestEntry, isNavActive } from './siteMap'

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8')

describe('NAV_ITEMS', () => {
  it('包含知识图谱，共 6 项，顺序固定', () => {
    expect(NAV_ITEMS.map(i => i.label)).toEqual([
      '首页', '投资', 'AI实验室', '知识图谱', '自由空间', '关于',
    ])
    expect(NAV_ITEMS.map(i => i.path)).toEqual(['/', '/invest', '/ai', '/knowledge', '/life', '/about'])
  })
})

describe('AI实验室路由', () => {
  it('App.tsx 有 /ai/:slug 深链路由', () => {
    expect(appSource).toContain('path="/ai/:slug"')
  })

  it('访问方向详情页时导航「AI实验室」高亮', () => {
    expect(isNavActive('/ai', '/ai/blog')).toBe(true)
    expect(isNavActive('/ai', '/aix')).toBe(false)
  })
})

describe('INVEST_GROUPS', () => {
  const allLinks = INVEST_GROUPS.flatMap(g => g.links)

  it('收纳全部旧入口和 AI 工具，且无重复', () => {
    const paths = allLinks.map(l => l.path).sort()
    expect(paths).toEqual([
      '/dcf', '/first-book', '/future-trends', '/grid-trading', '/invest/ai-tools', '/invest/etf', '/industry-landscape', '/investment-plan-2026',
      '/investment-strategy', '/investment-targets', '/limit-up-analysis',
      '/mainland-investment-targets', '/monitor', '/pulse', '/research-notes',
      '/sector-rotation', '/trading-philosophy', '/valuation',
    ].sort())
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('每个入口路径都在 App.tsx 路由表里', () => {
    for (const l of allLinks) {
      expect(appSource, l.path).toContain(`path="${l.path}"`)
    }
  })

  it('分组顺序按书里的流程：读书 → 定规则 → 选标的 → 用工具执行 → 看行情，已舍弃垫底', () => {
    expect(INVEST_GROUPS.map(g => g.id)).toEqual(['read', 'method', 'research', 'tools', 'watch', 'archived'])
  })

  it('看行情组直接展开，只放行情类页面', () => {
    const watch = INVEST_GROUPS.find(g => g.id === 'watch')!
    expect(watch.collapsed).toBe(false)
    expect(watch.links.map(l => l.path)).toEqual(['/pulse', '/sector-rotation', '/limit-up-analysis'])
  })

  it('选标的组只放研究方法与资料，不放带具体买卖建议的观察池', () => {
    const research = INVEST_GROUPS.find(g => g.id === 'research')!
    expect(research.links.map(l => l.path)).toEqual(['/research-notes', '/invest/etf', '/future-trends', '/industry-landscape'])
  })

  it('宏观温度（原每日监控）归入定规则，和 2026 计划同组', () => {
    const method = INVEST_GROUPS.find(g => g.id === 'method')!
    expect(method.links.map(l => [l.path, l.label])).toEqual([['/investment-plan-2026', '2026 投资计划'], ['/monitor', '宏观温度']])
  })

  it('道与术、综合投资策略框架标为舍弃：折叠在最后，每页都带舍弃说明', () => {
    const archived = INVEST_GROUPS[INVEST_GROUPS.length - 1]
    expect(archived.id).toBe('archived')
    expect(archived.collapsed).toBe(true)
    expect(archived.links.map(l => l.path)).toEqual(['/trading-philosophy', '/investment-strategy', '/mainland-investment-targets', '/investment-targets'])
    for (const l of archived.links) expect(l.archived, l.path).toMatch(/^已舍弃/)
    const elsewhere = INVEST_GROUPS.filter(g => g.id !== 'archived').flatMap(g => g.links)
    expect(elsewhere.some(l => l.archived)).toBe(false)
  })
})

describe('findInvestEntry', () => {
  it('精确匹配', () => {
    expect(findInvestEntry('/valuation')?.group.id).toBe('tools')
  })

  it('深层路径落在父入口所在分组，最长前缀优先', () => {
    expect(findInvestEntry('/grid-trading/records/xyz')?.link.path).toBe('/grid-trading')
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
  it('首页只在根路径高亮', () => {
    expect(isNavActive('/', '/')).toBe(true)
    expect(isNavActive('/', '/invest')).toBe(false)
  })

  it('任何收纳页面都点亮「投资」', () => {
    expect(isNavActive('/invest', '/invest')).toBe(true)
    expect(isNavActive('/invest', '/sector-rotation')).toBe(true)
    expect(isNavActive('/invest', '/grid-trading/records/1')).toBe(true)
    expect(isNavActive('/invest', '/first-book/x.md')).toBe(true)
  })

  it('未知路径无任何高亮', () => {
    for (const item of NAV_ITEMS) {
      expect(isNavActive(item.path, '/nope')).toBe(false)
    }
  })

  it('/ai /life /about 精确或子路径高亮', () => {
    expect(isNavActive('/ai', '/ai')).toBe(true)
    expect(isNavActive('/about', '/about')).toBe(true)
    expect(isNavActive('/life', '/invest')).toBe(false)
  })
})
