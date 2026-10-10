import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FutureTrends from './FutureTrends'
import { MemoryRouter } from 'react-router-dom'
import { TRENDS } from '../data/futureTrends'

describe('未来趋势', () => {
  it('每个赛道每个环节都有公司，且无重复赛道', () => {
    expect(new Set(TRENDS.map(t => t.id)).size).toBe(TRENDS.length)
    for (const t of TRENDS) for (const l of t.chain) {
      expect(l.cn.length + l.us.length, `${t.name}/${l.link}`).toBeGreaterThan(0)
    }
  })

  it('页面可切换赛道，并带有非投资建议声明', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=ai']}><FutureTrends /></MemoryRouter>)
    expect(screen.getByText(/查看推荐顺序请进入核心或候选池/)).toBeTruthy()
    expect(screen.getByRole('navigation', { name: '产业链环节索引' })).toBeTruthy()
    expect(screen.getAllByText(/候选待核/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '服务器、PCB、连接器与高速覆铜板' }).getAttribute('href')).toMatch(/^#ai-chain-/)
    expect(screen.getAllByRole('link', { name: 'HBM 官方产品资料' })[0].getAttribute('href')).toBe('https://www.micron.com/products/memory/hbm')
    fireEvent.click(screen.getByRole('tab', { name: '智能驾驶' }))
    expect(screen.getByRole('heading', { name: '智能驾驶' })).toBeTruthy()
  })

  it('七个赛道都有中国公司研究，展示护城河和情景证据', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=ai']}><FutureTrends /></MemoryRouter>)
    for (const name of ['机器人与具身智能', '创新药', '航空航天', '新能源', '半导体与先进制造', '新材料', '脑机接口、量子计算与合成生物']) {
      fireEvent.click(screen.getByRole('tab', { name }))
      expect(screen.getByRole('heading', { name: new RegExp(`^${name}中国公司研究`) })).toBeTruthy()
      expect(screen.getAllByRole('columnheader', { name: '护城河' }).length).toBeGreaterThan(0)
    }
  })

  it('AI 公司可进入二级研究页，并明确实际胜率未校准', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=ai']}><FutureTrends /></MemoryRouter>)
    expect(screen.getAllByText('中际旭创').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: '中际旭创' }).every(a => a.getAttribute('href') === '/future-trends/company/listed-300308')).toBe(true)
    expect(screen.getAllByText('实际胜率：未校准').length).toBeGreaterThan(0)
  })

  it('九个赛道最底部都有海外公司研究', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=ai']}><FutureTrends /></MemoryRouter>)
    for (const [tab, title] of [['人工智能', '人工智能'], ['智能驾驶', '智能驾驶'], ['机器人与具身智能', '机器人与具身智能'], ['创新药', '创新药'], ['航空航天', '航空航天'], ['新能源', '新能源'], ['半导体与先进制造', '半导体与先进制造'], ['新材料', '新材料'], ['脑机接口、量子计算与合成生物', '脑机接口、量子计算与合成生物']]) {
      fireEvent.click(screen.getByRole('tab', { name: tab }))
      const sections = screen.getAllByRole('region')
      expect(sections[sections.length - 1].getAttribute('aria-labelledby'), tab).toMatch(/-us-picks$/)
      expect(screen.getByRole('heading', { name: new RegExp(`^${title}海外公司研究`) })).toBeTruthy()
    }
  })

  it('候选池可筛选市场与推荐优先级，默认展示可买卖', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=ai']}><FutureTrends /></MemoryRouter>)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[1].textContent).toBe('候选池')
    fireEvent.click(screen.getByRole('tab', { name: '候选池' }))
    expect(screen.getByRole('heading', { name: /^候选池/ })).toBeTruthy()
    expect(screen.getByText(/实际胜率未经校准/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '海外' }))
    expect(screen.getByRole('button', { name: '海外' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^可买卖/ }))
    expect(screen.getByRole('table').querySelectorAll('tbody tr').length).toBeGreaterThan(0)
    expect(screen.getByRole('table').querySelectorAll('tbody tr').length).toBeLessThan(20)
    fireEvent.click(screen.getByRole('button', { name: /^好公司/ }))
    expect(screen.getByRole('table').querySelectorAll('tbody tr').length).toBeGreaterThan(0)
  })

  it('第一个页签是核心 8，展示优先与备选及价格条件', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=ai']}><FutureTrends /></MemoryRouter>)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].textContent).toBe('核心')
    fireEvent.click(screen.getByRole('tab', { name: '核心' }))
    expect(screen.getByRole('heading', { name: /^核心：先看这 6 家/ })).toBeTruthy()
    expect(screen.getAllByRole('table').reduce((n,t) => n+t.querySelectorAll('tbody tr').length,0)).toBe(8)
    expect(screen.getByText(/当前情景估值均为待复核草稿/)).toBeTruthy()
  })

  it('候选池与核心都能下载当前选择的公司 JSON', async () => {
    vi.useFakeTimers()
    const blobs: Blob[] = []
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    URL.createObjectURL = ((b: Blob) => { blobs.push(b); return 'blob:x' }) as typeof URL.createObjectURL
    URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL
    try {
      render(<MemoryRouter initialEntries={['/future-trends?tab=ai']}><FutureTrends /></MemoryRouter>)
      fireEvent.click(screen.getByRole('tab', { name: '候选池' }))
      fireEvent.click(screen.getByRole('button', { name: '海外' }))
      fireEvent.click(screen.getByRole('button', { name: '导出筛选结果 JSON' }))
      const pool = JSON.parse(await blobs[0].text())
      expect(pool).toHaveLength(4)
      expect(pool.every((x: { key: string }) => x.key.startsWith('海外:'))).toBe(true)
      expect(pool[0]).toHaveProperty('valuationStatus')
      fireEvent.click(screen.getByRole('tab', { name: '核心' }))
      fireEvent.click(screen.getByRole('button', { name: '导出核心 JSON' }))
      const core = JSON.parse(await blobs[1].text())
      expect(core).toHaveLength(8)
      expect(core.every((x: { core: boolean }) => x.core)).toBe(true)
      expect(core[0]).toHaveProperty('moat')
    } finally {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
    }
  })
})

describe('固态电池专题', () => {
  it('竞选复核展示公司结论，并可访问本次查询记录与完整报告', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=solid-state']}><FutureTrends /></MemoryRouter>)
    const review = within(screen.getByRole('region', { name: '核心候选池竞选复核' }))
    expect(review.getByText(/本轮没有新增已认证的现价买入标的/)).toBeTruthy()
    expect(review.getByText('查看全部 40 家公司的竞选去向')).toBeTruthy()
    expect(review.getByRole('link', { name: /本次重新查询的 MCP 调用记录/ }).getAttribute('href')).toContain('/solid-state-core-review-2026-10-09/manifest.json')
    expect(review.getByRole('link', { name: /完整竞选报告/ }).getAttribute('href')).toContain('/review.md')
  })
  it('显示 MCP 覆盖、财务口径与缺项，并支持现名和港股代码检索', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=solid-state']}><FutureTrends /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '本轮 MCP 更新：覆盖范围与研究调整' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '2026H1 集团财务比较' })).toBeTruthy()
    expect(screen.getByText(/贝特瑞旧价未获本轮 MCP 复核/)).toBeTruthy()
    const search = screen.getByRole('textbox', { name: '搜索公司 / 代码' })
    fireEvent.change(search, { target: { value: '五矿新能' } })
    expect(screen.getByRole('status').textContent).toMatch(/^显示 1 \/ /)
    fireEvent.change(search, { target: { value: '1772.HK' } })
    expect(screen.getByRole('status').textContent).toMatch(/^显示 1 \/ /)
    expect(within(screen.getByRole('region', { name: '公司观察池：从产业格局逐条提取' })).getByRole('link', { name: '赣锋锂业' }).getAttribute('href')).toBe('/future-trends/solid-state/002460-sz')
    const manifest = screen.getByRole('link', { name: /下载本轮调用及原始文件索引/ })
    expect(manifest.getAttribute('href')).toContain('/research/solid-state-mcp-2026-10-09/manifest.json')
  })
  it('支持独立 tab 深链接，展示产业研究并可返回其他赛道', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=solid-state']}><FutureTrends /></MemoryRouter>)
    expect(screen.getByRole('tab', { name: '固态电池' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: '固态电池' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /价值链：谁付钱/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /三情景与赔率/ })).toBeTruthy()
    expect(screen.getByText('本报告仅供研究参考，不构成个人投资建议。')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '新能源' }))
    expect(screen.queryByRole('heading', { name: '固态电池', level: 2 })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '固态电池' }))
    expect(screen.getByRole('heading', { name: '固态电池' })).toBeTruthy()
  })

  it('公司池可按关键词和环节交叉筛选，研究锚点对应本页卡片', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=solid-state']}><FutureTrends /></MemoryRouter>)
    const search = screen.getByRole('textbox', { name: '搜索公司 / 代码' })
    fireEvent.change(search, { target: { value: '先导' } })
    expect(screen.getByRole('status').textContent).toMatch(/^显示 1 \/ /)
    const company = within(screen.getByRole('region', { name: '公司观察池：从产业格局逐条提取' })).getByRole('link', { name: '先导智能' })
    expect(company.getAttribute('href')).toBe('/future-trends/solid-state/300450-sz')
    expect(document.getElementById('solid-company-lead')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: '产业环节' }), { target: { value: '电芯制造' } })
    expect(screen.getByRole('status').textContent).toMatch(/^显示 0 \/ /)
    expect(screen.getByText(/未找到匹配公司/)).toBeTruthy()
  })
})
