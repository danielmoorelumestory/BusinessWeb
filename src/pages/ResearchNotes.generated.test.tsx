// @ts-ignore 测试环境在 Node 中运行，项目未安装 @types/node
import { readFileSync } from 'node:fs'
// @ts-ignore
import { resolve } from 'node:path'
import React from 'react'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import ResearchNotes from './ResearchNotes'
import CompanyDetail from './CompanyDetail'
import { findCompany, loadCompanies } from '../data/companies'

// 程序化补全公司（public/data/*.json）的烟雾测试：列表加载、分页、搜索、评级筛选、详情页
beforeAll(() => {
  vi.stubGlobal('scrollTo', () => {})
  vi.stubGlobal('fetch', async (url: string) => {
    const u = String(url)
    const name = u.includes('us.json') ? 'us.json' : u.includes('hk.json') ? 'hk.json' : u.includes('adr.json') ? 'adr.json' : u.includes('lynch.json') ? 'lynch.json' : 'cn.json'
    const text = readFileSync(resolve('public/data', name), 'utf8')
    return { ok: true, json: async () => JSON.parse(text) } as Response
  })
})
afterEach(() => cleanup())

const renderAt = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/research-notes" element={<ResearchNotes />} />
        <Route path="/research-notes/:market/:code" element={<CompanyDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('补全公司：研究笔记列表与详情', () => {
  it('圆桌复核同时覆盖手工与异步补全，撤回未验证的达标标签', async () => {
    expect(findCompany('us', 'PEP')?.headline).toContain('基准赔率未达标')
    const list = await loadCompanies('us')
    for (const code of ['ZTS', 'SPGI', 'CVS', 'AES', 'CINF', 'OMC', 'UHS']) {
      const company = list.find(c => c.code === code)
      expect(company?.rating).toBe('观察（待重建）')
      expect(company?.scenarios || []).toHaveLength(0)
      expect(company?.metrics.some(([key]) => key === '上轮结论（存档）')).toBe(true)
    }
    expect(list.find(c => c.code === 'PEP')?.ratioNote).toContain('0.73')
    for (const code of ['MSFT', 'NVDA', 'ORCL']) {
      expect(list.find(c => c.code === code)?.metrics.some(([key]) => key === '本轮一手现金流证据')).toBe(true)
    }
    expect(list.find(c => c.code === 'ACN')?.auto).toBe(true)
  })

  it('标普列表展示圆桌汇总入口及研究边界', async () => {
    renderAt('/research-notes?tab=category&m=us')
    expect(screen.getByText('腾讯自选股投研专家团 · 再分析汇总')).toBeTruthy()
    expect(screen.getByRole('link', { name: '完整圆桌报告' }).getAttribute('href')).toContain('sp500-roundtable-2026-09-30.html')
    expect(screen.getByText(/504 条研究记录/)).toBeTruthy()
  })

  it('补全候选详情准确区分公告复核和未认证的程序化模型', async () => {
    renderAt('/research-notes/us/CVS')
    await waitFor(() => expect(screen.getByText(/本轮已补充公司公告/)).toBeTruthy())
    expect(screen.getByRole('link', { name: '查看本轮完整报告与一手来源' })).toBeTruthy()
    expect(screen.getByText(/待补充三情景估值表/)).toBeTruthy()
  })

  it('沪深列表加载补全数据，支持搜索与评级筛选、分页', async () => {
    renderAt('/research-notes?tab=category&m=cn')
    await waitFor(() => expect(screen.getByText(/显示更多/)).toBeTruthy(), { timeout: 8000 })
    expect(screen.getByRole('link', { name: '金融、房地产、工业复核总览' }).getAttribute('href')).toContain('cn-finance-property-industrial-2026-10-07/index.md')
    const box = screen.getByPlaceholderText('搜索公司名称或代码') as HTMLInputElement
    fireEvent.change(box, { target: { value: '宁德时代' } })
    await waitFor(() => expect(screen.getAllByText(/宁德时代/).length).toBeGreaterThan(0))
    expect(screen.queryByText(/显示更多/)).toBeNull()
    fireEvent.change(box, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /^回避 \d+/ }))
    await waitFor(() => expect(screen.queryAllByText(/^回避/).length).toBeGreaterThan(0))
  })

  it('美股列表包含标普500 补全公司，并标注程序化', async () => {
    renderAt('/research-notes?tab=category&m=us')
    await waitFor(() => expect(screen.getByText(/显示更多/)).toBeTruthy(), { timeout: 8000 })
    fireEvent.change(screen.getByPlaceholderText('搜索公司名称或代码'), { target: { value: 'ACN' } })
    await waitFor(() => expect(screen.getAllByText(/埃森哲/).length).toBeGreaterThan(0))
    expect(screen.getAllByText('程序化').length).toBeGreaterThan(0)
  })

  it('补全公司详情页渲染程序化标识、三情景与买入纪律', async () => {
    renderAt('/research-notes/us/ACN')
    await waitFor(() => expect(screen.getByText('程序化研究页')).toBeTruthy(), { timeout: 8000 })
    expect(screen.getAllByText(/Bear/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/条件价格（研究假设）/).length).toBeGreaterThan(0)
  })

  it('比亚迪详情页显示本轮复核并替换程序化结论', async () => {
    renderAt('/research-notes/cn/002594')
    await waitFor(() => expect(screen.getByRole('link', { name: '查看本轮完整报告与一手来源' }).getAttribute('href')).toContain('cn-four-sectors-2026-10-07'), { timeout: 8000 })
    expect(screen.queryByText('程序化研究页')).toBeNull()
    expect(screen.getAllByText(/比亚迪/).length).toBeGreaterThan(0)
  })
})

it('四分类复核在异步补全后仍保留，亏损公司不恢复旧PE价格', async () => {
  const audit = JSON.parse(readFileSync(resolve('public/research/cn-four-sectors-2026-10-07/audit.json'), 'utf8'))
  expect(audit.length).toBe(46)
  expect(audit.reduce((counts: Record<string, number>, row: { sector: string }) => {
    counts[row.sector] = (counts[row.sector] ?? 0) + 1
    return counts
  }, {})).toEqual({ '机器人链': 3, '工程机械': 1, '新能源汽车': 23, 'AI 算力': 19 })
  await loadCompanies('cn')
  for (const row of audit) {
    const company = findCompany('cn', row.code)!
    expect(company).toBeTruthy()
    expect(company.auto).toBe(false)
    expect(company.reviewed).toBe(true)
    expect(company.scenarios?.length).toBe(3)
    if (row.filing.core < 0) {
      expect(row.model).toBeNull()
      expect(company.scenarios?.every(s => s.price.includes('[MISSING]'))).toBe(true)
    }
  }
  const byCode = Object.fromEntries(audit.map((row: { code: string }) => [row.code, row]))
  // 防止千元现金流表与元主指标混用，以及现金支出的列示负号颠倒。
  expect(byCode['002594'].filing.cashCapex / 1e8).toBeCloseTo(447.03066, 4)
  expect(byCode['601138'].filing.fcfProxy / 1e8).toBeCloseTo(-17.00421, 4)
  for (const code of ['688183', '688008', '300308']) {
    expect(byCode[code].notes.eventNotes.length).toBeGreaterThan(0)
    expect(byCode[code].model.certified).toBe(false)
  }
})

describe('林奇分组、港股、导出', () => {
  it('林奇分组视图：类型筛选与护城河证据', async () => {
    renderAt('/research-notes?tab=category&m=cn&v=lynch')
    await waitFor(() => expect(screen.getAllByText('快速增长型').length).toBeGreaterThan(1), { timeout: 8000 })
    fireEvent.click(screen.getByRole('button', { name: /^周期型 \d+/ }))
    await waitFor(() => expect(screen.queryAllByText('周期型').length).toBeGreaterThan(1))
    expect(screen.getByText(/导出当前/)).toBeTruthy()
  })

  it('港股标签页列表可加载并搜索腾讯', async () => {
    renderAt('/research-notes?tab=category&m=hk')
    await waitFor(() => expect(screen.getByPlaceholderText('搜索公司名称或代码')).toBeTruthy(), { timeout: 8000 })
    fireEvent.change(screen.getByPlaceholderText('搜索公司名称或代码'), { target: { value: '腾讯' } })
    await waitFor(() => expect(screen.getAllByText(/腾讯控股/).length).toBeGreaterThan(0), { timeout: 8000 })
  })

  it('详情页渲染林奇分类卡与护城河证据', async () => {
    renderAt('/research-notes/us/ACN')
    await waitFor(() => expect(screen.getByText(/林奇分类：/)).toBeTruthy(), { timeout: 8000 })
    expect(screen.getAllByText('定价权').length).toBeGreaterThan(0)
  })

  it('全部公司列表有导出按钮', async () => {
    renderAt('/research-notes?tab=category&m=us')
    await waitFor(() => expect(screen.getByText(/导出当前筛选/)).toBeTruthy(), { timeout: 8000 })
    expect(screen.getByText(/导出该市场全部/)).toBeTruthy()
  })

  it('美股非标普标签：四组分类', async () => {
    renderAt('/research-notes?tab=category&m=adr')
    await waitFor(() => expect(screen.getAllByText(/台积电/).length).toBeGreaterThan(0), { timeout: 8000 })
    expect(screen.getAllByText(/^中概 \d+/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^新上市\/热门 \d+/).length).toBeGreaterThan(0)
  })

  it('切换市场后筛选被重置：沪深选「优先关注」再切到美股非标普仍有公司', async () => {
    renderAt('/research-notes?tab=category&m=cn')
    await waitFor(() => expect(screen.getByText(/显示更多/)).toBeTruthy(), { timeout: 8000 })
    fireEvent.click(screen.getByRole('button', { name: /^优先关注 \d+/ }))
    fireEvent.click(screen.getByRole('button', { name: '美股非标普' }))
    await waitFor(() => expect(screen.getAllByText(/台积电/).length).toBeGreaterThan(0), { timeout: 8000 })
  })

  it('美股非标普原件复核页：台积电列明估值缺口与完整来源，隐藏旧筛选卡', async () => {
    renderAt('/research-notes/adr/TSM')
    await waitFor(() => expect(screen.getAllByText(/条件价格（研究假设）/).length).toBeGreaterThan(0), { timeout: 8000 })
    expect(screen.queryByText('程序化研究页')).toBeNull()
    expect(screen.getAllByText(/Bear/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '查看本轮完整报告与一手来源' }).getAttribute('href')).toContain('adr-2026-10-07/TSM.html')
    expect(screen.queryByText(/林奇分类：/)).toBeNull()
  })

  it('港股手工研究页：建设银行详情页有三情景与买入区，且不再标程序化', async () => {
    renderAt('/research-notes/hk/00939')
    await waitFor(() => expect(screen.getAllByText(/条件价格（研究假设）/).length).toBeGreaterThan(0), { timeout: 8000 })
    expect(screen.queryByText('程序化研究页')).toBeNull()
    expect(screen.getAllByText(/Bear/).length).toBeGreaterThan(0)
  })

  it('补充覆盖的公司：必和必拓使用本轮原件证据，历史第三方结论不覆盖', async () => {
    renderAt('/research-notes/adr/BHP')
    await waitFor(() => expect(screen.getAllByText(/条件价格（研究假设）/).length).toBeGreaterThan(0), { timeout: 8000 })
    expect(screen.queryByText('程序化研究页')).toBeNull()
    expect(screen.getAllByText(/原件财务核读/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '查看本轮完整报告与一手来源' }).getAttribute('href')).toContain('adr-2026-10-07/BHP.html')
  })

  it('补充覆盖的港股：药明康德详情页可打开', async () => {
    renderAt('/research-notes/hk/02359')
    await waitFor(() => expect(screen.getAllByText(/条件价格（研究假设）/).length).toBeGreaterThan(0), { timeout: 8000 })
    expect(screen.queryByText('程序化研究页')).toBeNull()
  })
})

it('沪深复核保留未重建公司；伯特利使用最新未认证研究初稿', async () => {
  const manual = findCompany('cn', '603596')!
  expect(manual.scenarios).toHaveLength(3)
  expect(manual.ratioNote).toContain('不认证')
  expect(manual.metrics.some(([k]) => k === '研究复核')).toBe(true)
  expect(manual.discipline?.position).toContain('不提供个人仓位指令')
  const rows = await loadCompanies('cn')
  const dp = rows.find(c => c.code === '605499')!
  // 东鹏饮料已由 2026-10-07 逐家复核页取代 09-30 圆桌结论：有三情景，且标注为未认证
  expect(dp.scenarios).toHaveLength(3)
  expect(dp.auto).toBe(false)
  expect(dp.researchReport).toContain('cn-itucd-2026-10-07')
  expect(dp.ratioNote).toContain('不认证')
  expect(rows.find(c => c.code === '601138')!.ratioNote).toContain('本轮不认证')
})

it('两分类40家公司在初始与异步数据都显示原件复核，亏损公司不恢复旧PE', async () => {
  const rows = (await loadCompanies('cn')).filter(c => ['自动驾驶', '新材料'].includes(c.sector))
  expect(rows.filter(c => c.sector === '自动驾驶')).toHaveLength(21)
  expect(rows.filter(c => c.sector === '新材料')).toHaveLength(19)
  for (const company of rows) {
    expect(company.auto).toBe(false)
    expect(company.asOf).toContain('2026-10-07')
    expect(company.metrics.some(([key]) => key === '估值认证')).toBe(true)
    expect(company.scenarios).toHaveLength(3)
    expect(findCompany('cn', company.code)?.headline).toBe(company.headline)
  }
  for (const code of ['688326', '002036', '688048', '688052', '688126']) {
    expect(rows.find(c => c.code === code)?.scenarios?.every(s => s.price.includes('[MISSING]'))).toBe(true)
  }
  expect(rows.find(c => c.code === '603501')?.name).toBe('豪威集团')
  expect(rows.find(c => c.code === '688779')?.name).toBe('五矿新能')
})

it('沪深研究池提供汇总报告入口', async () => {
  renderAt('/research-notes?tab=category&m=cn')
  await waitFor(() => expect(screen.getByText('沪深研究池 · 2026-09-30 圆桌复核')).toBeTruthy())
  expect(screen.getByRole('link', { name: '沪深完整圆桌报告' }).getAttribute('href')).toContain('cn-roundtable')
})

it('沪深复核详情不会从历史指标重建被撤回的三情景', async () => {
  renderAt('/research-notes/cn/605499')
  await waitFor(() => expect(screen.getAllByText(/饮料类假设/).length).toBeGreaterThan(0))
  expect(screen.getByRole('link', { name: '查看本轮完整报告与一手来源' }).getAttribute('href')).toContain('cn-itucd-2026-10-07')
})

describe('额外综合分类视图', () => {
  it.each(['us', 'cn', 'hk', 'adr'])('%s保留原入口并新增综合分类', async market => {
    renderAt(`/research-notes?tab=category&m=${market}`)
    fireEvent.click(screen.getByRole('button', { name: '综合筛选' }))
    expect(screen.getByRole('button', { name: '评级列表' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '林奇分类' })).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('columnheader', { name: '林奇类型' })).toBeTruthy())
    expect(screen.getByRole('columnheader', { name: '研究评级' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: '行业' })).toBeTruthy()
  })

  it('综合分类允许公司搜索并显示两套结论，原分类视图不增加列', async () => {
    renderAt('/research-notes?tab=category&m=us&v=combined')
    await waitFor(() => expect(screen.getByRole('textbox', { name: '搜索综合分类' })).toBeTruthy())
    fireEvent.change(screen.getByRole('textbox', { name: '搜索综合分类' }), { target: { value: 'CVS' } })
    await waitFor(() => expect(screen.getByRole('link', { name: '西维斯健康 CVS' })).toBeTruthy())
    expect(screen.getByRole('columnheader', { name: '林奇判断' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '评级列表' }))
    expect(screen.queryByRole('columnheader', { name: '林奇类型' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: '一句话结论' })).toBeTruthy()
  })
})

describe('页面结构：公司库优先，旧链接可用', () => {
  it('默认进入公司库，页签顺序固定', () => {
    renderAt('/research-notes')
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(b => b.textContent)).toEqual(['公司库', '候选池', '研究方法', '配置笔记', '工具设想', '历史价位（存档）'])
    expect(screen.getByRole('group', { name: '市场' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '沪深' })).toBeTruthy()
  })

  it('旧链接映射到新页签', () => {
    renderAt('/research-notes?tab=category&m=watch')
    expect(screen.getByText(/交易观察清单/)).toBeTruthy()
    cleanup()
    renderAt('/research-notes?tab=standard')
    expect(screen.getByText('研究方法 · 适用于所有公司')).toBeTruthy()
    cleanup()
    renderAt('/research-notes?tab=strategy')
    expect(screen.getByText('配置表（300 万示例）')).toBeTruthy()
  })

  it('配置笔记在投资框架与家庭组合之间切换', () => {
    renderAt('/research-notes?tab=notes')
    expect(screen.getByText('被动层 · 压舱石（五格等权）')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '家庭组合 v6' }))
    expect(screen.getByText('配置表（300 万示例）')).toBeTruthy()
    expect(screen.queryByText('被动层 · 压舱石（五格等权）')).toBeNull()
  })
})

describe('研究页不构成买卖建议（与书的立场一致）', () => {
  it('公司库与公司详情页都有固定说明，条件价格标为研究假设', async () => {
    renderAt('/research-notes?tab=category&m=us')
    expect(screen.getAllByRole('note').some(n => /不是买卖建议/.test(n.textContent ?? ''))).toBe(true)
    cleanup()
    renderAt('/research-notes/adr/TSM')
    await waitFor(() => expect(screen.getAllByText(/条件价格（研究假设）/).length).toBeGreaterThan(0), { timeout: 8000 })
    expect(screen.getAllByRole('note').some(n => /盈亏比只比较情景价差/.test(n.textContent ?? ''))).toBe(true)
    expect(screen.queryByText(/小仓位/)).toBeNull()
  })

  it('历史价位与家庭组合 v6 标为已舍弃', () => {
    renderAt('/research-notes?tab=watch')
    expect(screen.getAllByRole('note').some(n => /^已舍弃/.test(n.textContent ?? ''))).toBe(true)
    cleanup()
    renderAt('/research-notes?tab=notes&n=v6')
    expect(screen.getAllByRole('note').some(n => /^已舍弃.*9\.10/.test(n.textContent ?? ''))).toBe(true)
  })
})
