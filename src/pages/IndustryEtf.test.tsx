import React from 'react'
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import IndustryEtf from './IndustryEtf'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const renderPage = () => render(<MemoryRouter><IndustryEtf /></MemoryRouter>)

describe('IndustryEtf', () => {
  it('场外债基链接自己的报告、显示净值日期且不提供网格', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '> 数据基准：2026-10-13 净值\n\n## 一、结论速览\n\n**综合判断：历史回撤有边界，按净值申赎。**' })))
    renderPage()
    const group = screen.getByRole('heading', { name: '债券基金（场外）' }).closest('section')!
    expect(within(group).getByText('风险 / 收益 由低到高')).toBeTruthy()
    expect(within(group).getByText('低波稳健 ──▶ 股债弹性')).toBeTruthy()
    expect(within(group).getByText('只买债券')).toBeTruthy()
    expect(within(group).getByText('可投可转债')).toBeTruthy()
    expect(within(group).getByText('股票 ≤20%')).toBeTruthy()
    expect(within(group).getByText('混合偏债')).toBeTruthy()
    expect(within(group).getByText('回撤约 -1%~-2%')).toBeTruthy()
    expect(within(group).getByText('回撤可 >10%')).toBeTruthy()
    expect(within(group).queryByText(/所列份额销售服务费均为0/)).toBeNull()
    expect(within(group).queryByText(/满三年采用2023-10-13至2026-10-13区间/)).toBeNull()
    expect(within(group).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['名称 / 代码', '三年收益', '五年收益', '历史最大回撤', '费用', '备注', '参考'])
    expect(within(group).getAllByRole('row').slice(1).map(row => row.querySelector('.etf-code-line')!.textContent)).toEqual(['006337', '000015', '110017', '161716', '019372', '010011', '000143'])
    const row110017 = within(group).getByRole('link', { name: '110017' }).closest('tr')!
    expect(row110017.textContent).toContain('-5.36%')
    expect(row110017.textContent).toContain('历史(2015)')
    const pureRow = within(group).getByRole('link', { name: '000015' }).closest('tr')!
    expect(pureRow.textContent).toContain('普通纯债')
    expect(pureRow.textContent).toContain('不含股票')
    expect(pureRow.textContent).toContain('+10.02%')
    expect(pureRow.textContent).toContain('+17.35%')
    expect(pureRow.textContent).toContain('近五年')
    expect(pureRow.textContent).toContain('-4.10%')
    expect(pureRow.textContent).toContain('历史(2016)')
    expect(pureRow.textContent).toContain('0.40%/年')
    expect(pureRow.textContent).toContain('管0.30+托0.10')
    expect(pureRow.textContent).toContain('赎回费：<7天 1.50% · 7–29天 0.10% · ≥30天 0%')
    const newerRow = within(group).getByRole('link', { name: '019372' }).closest('tr')!
    expect(newerRow.textContent).toContain('二级债基')
    expect(newerRow.textContent).toContain('股票增强 ~10%')
    expect(newerRow.textContent).toContain('+13.12%')
    expect(newerRow.textContent).toContain('2023-11-02')
    expect(newerRow.textContent).toContain('-0.98%')
    expect(newerRow.textContent).toContain('0.75%/年')
    expect(newerRow.textContent).toContain('管0.60+托0.15')
    expect(newerRow.textContent).toContain('赎回费：<7天 1.50% · 7–29天 0.50% · 30–179天 0.10% · ≥180天 0%')
    for (const code of ['000015', '019372', '006337', '161716', '110017', '010011', '000143']) {
      const row = within(group).getByRole('link', { name: code }).closest('tr')!
      expect(within(row).getByRole('link', { name: '分析报告' }).getAttribute('href')).toMatch(new RegExp(`/notes/${code}-.*-bond-fund-analysis$`))
      expect(within(row).queryByRole('link', { name: '行情网格' })).toBeNull()
      await waitFor(() => expect(row.textContent).toContain('2026-10-13 净值｜历史回撤有边界'))
    }
  })
  it('新增三组可导航且沿用报告备注，港股红利不重复出现', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '## 一、结论速览\n\n数据基准：2026-10-14\n\n**综合判断：短期上升趋势；核验底层资产。**' })))
    renderPage()
    for (const [title, id, codes] of [
      ['策略 ETF', 'strategy-etf', ['512890', '513630']],
      ['商品 ETF', 'commodity-etf', ['518880']],
      ['货币 ETF', 'money-etf', ['511880']],
    ] as const) {
      expect(screen.getByRole('link', { name: `${title}${codes.length}` }).getAttribute('href')).toBe(`#${id}`)
      const section = screen.getByRole('heading', { name: title }).closest('section')!
      expect(within(section).getAllByRole('row')).toHaveLength(codes.length + 1)
      expect(within(section).queryByRole('columnheader', { name: /费用/ })).toBeNull()
      for (const code of codes) {
        const row = within(section).getByRole('link', { name: code }).closest('tr')!
        expect(within(row).getByRole('link', { name: '分析报告' }).getAttribute('href')).toContain(`/notes/${code}-`)
        await waitFor(() => expect(row.textContent).toContain('2026-10-14 收盘｜短期上升趋势；核验底层资产。'))
      }
    }
    expect(screen.getAllByRole('link', { name: '513630' })).toHaveLength(1)
    const money = screen.getByRole('link', { name: '511880' }).closest('tr')!
    expect(within(money).queryByRole('link', { name: '行情网格' })).toBeNull()
    expect(within(money).getByText('不适用')).toBeTruthy()
    expect(within(money.closest('section')!).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['名称 / 代码', '标的与定位', '备注', '参考 / 网格'])
    expect(money.querySelector('.etf-technical-cell')).toBeNull()
  })
  it('显示 7 个行业组与 59 只 ETF，总数与各组数量一致，且行业组为二级分类', () => {
    renderPage()
    expect(screen.getByText(/7 个行业组，共 59 只行业 ETF/)).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(12)
    const rows = screen.getAllByRole('row').filter(r => r.closest('#industry-etf') && within(r).queryAllByRole('columnheader').length === 0)
    expect(rows).toHaveLength(59)
    const buildingMaterials = within(screen.getByRole('heading', { level: 3, name: '金融地产基建' }).closest('section')!)
      .getByRole('link', { name: '516750' }).closest('tr')!
    for (const label of ['建筑材料 67.44%', '建筑产品 28.80%', '化学制品 3.76%', '指数三级行业权重 · 2026-10-09']) {
      expect(within(buildingMaterials).getByText(label)).toBeTruthy()
    }
    // 一级分类：行业 ETF
    expect(screen.getByRole('heading', { level: 2, name: '行业 ETF' })).toBeTruthy()
    // 二级分类：TMT科技等
    expect(screen.getByRole('heading', { level: 3, name: /TMT科技/ })).toBeTruthy()
  })

  it('宽基只显示文档综合判断，不显示费用和原选择理由', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      text: async () => url.includes('510300-')
        ? '## 一、结论速览\n\n数据基准：2026-10-14\n\n**综合判断：短期震荡偏强；这是最新文档判断。**\n\n## 二、政策\n\n**综合判断：不应显示后续章节判断。**'
        : '',
    })))
    renderPage()
    const section = screen.getByRole('heading', { name: '宽基 ETF 清单' }).closest('section')!
    expect(within(section).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['名称 / 代码', '标的与定位', '日线', '周线', '月线', '备注', '参考 / 网格'])
    const a50 = within(section).getByRole('link', { name: '159593' }).closest('tr')!
    expect(a50.querySelectorAll('.etf-technical-cell')).toHaveLength(3)
    expect(within(a50).getAllByText('MA')).toHaveLength(3)
    expect(within(a50).getAllByText('MACD')).toHaveLength(3)
    expect(within(a50).getByText('26.1 超卖，仍在回落')).toBeTruthy()
    expect(a50.querySelectorAll('.etf-technical-cell')[2].getAttribute('title')).toContain('未收盘暂态')
    const rows = within(section).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(10)
    expect(within(section).queryByText('已精简的13类指数及原因')).toBeNull()
    const row = within(section).getByText('510300').closest('tr')!
    expect(within(row).getByText('沪深300')).toBeTruthy()
    expect(within(section).queryByRole('columnheader', { name: /费用/ })).toBeNull()
    expect(within(section).queryByRole('columnheader', { name: '选择理由' })).toBeNull()
    expect(within(section).getByRole('columnheader', { name: '备注' })).toBeTruthy()
    await waitFor(() => expect(row.textContent).toContain('2026-10-14 收盘｜短期震荡偏强；这是最新文档判断。'))
    expect(row.textContent).not.toContain('与510310')
    expect(row.textContent).not.toContain('不应显示后续章节判断')
    expect(within(row).getByRole('link', { name: '分析报告' }).getAttribute('href')).toBe('/notes/510300-csi300-etf-analysis')
    expect(within(row).getByRole('link', { name: '510300' }).getAttribute('href')).toBe('/notes/510300-csi300-etf-analysis')
    for (const row of rows) {
      expect(within(row).getByRole('link', { name: '基金档案' }).getAttribute('href')).toMatch(/^https:\/\/fundf10.eastmoney.com/)
      expect(within(row).getByRole('link', { name: '行情网格' }).getAttribute('href')).toContain(`code=${row.querySelector('.etf-code-line')!.textContent}`)
    }
  })

  it('站内参考链接用 Link 指向 /notes/<slug>', () => {
    renderPage()
    const link = screen.getByTitle('机器人ETF对比研报：562500 vs 159530')
    expect(link.textContent).toBe('分析报告')
    expect(link.getAttribute('href')).toBe('/notes/robotics-industry-research')
    expect(link.getAttribute('target')).toBeNull()
  })

  it('有研究笔记的 ETF，代码和名称都能点进对应笔记', () => {
    renderPage()
    const row = screen.getByText('159928').closest('tr')!
    const links = within(row).getAllByRole('link').filter(a => !a.getAttribute('href')!.startsWith('/note/'))
    expect(links.map(a => a.getAttribute('href'))).toEqual(Array(links.length).fill('/notes/159928-consumer-etf-analysis'))
    expect(links.length).toBe(3)
    expect(screen.getByRole('link', { name: '562500' }).getAttribute('href')).toBe('/notes/562500-robot-etf-analysis')
    expect(screen.getByRole('link', { name: '159865' }).getAttribute('href')).toBe('/notes/159865-livestock-etf-analysis')
    const chipRow = screen.getByText('588200').closest('tr')!
    const chipLinks = within(chipRow).getAllByRole('link').filter(a => !a.getAttribute('href')!.startsWith('/note/'))
    expect(chipLinks.map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/588200-star-chip-etf-analysis'))
    expect(chipLinks[2].textContent).toBe('分析报告')
    expect(chipLinks[2].getAttribute('title')).toBe('科创芯片ETF')
    const semiconductorRow = screen.getByText('588170').closest('tr')!
    const semiconductorLinks = within(semiconductorRow).getAllByRole('link').filter(a => !a.getAttribute('href')!.startsWith('/note/'))
    expect(semiconductorLinks.map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/588170-star-semiconductor-etf-analysis'))
    expect(semiconductorLinks[2].textContent).toBe('分析报告')
    expect(semiconductorLinks[2].getAttribute('title')).toBe('科创半导体ETF')
    const communicationsRow = screen.getByText('515880').closest('tr')!
    const communicationsLinks = within(communicationsRow).getAllByRole('link')
    expect(communicationsLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/515880-communications-etf-analysis'))
    expect(communicationsLinks[2].textContent).toBe('分析报告')
    expect(communicationsLinks[2].getAttribute('title')).toBe('通信ETF')
    const aiRow = screen.getByText('159819').closest('tr')!
    const aiLinks = within(aiRow).getAllByRole('link')
    expect(aiLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/159819-ai-etf-analysis'))
    expect(aiLinks[2].textContent).toBe('分析报告')
    expect(aiLinks[2].getAttribute('title')).toBe('人工智能ETF')
    const softwareRow = screen.getByText('159852').closest('tr')!
    const softwareLinks = within(softwareRow).getAllByRole('link')
    expect(softwareLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/159852-software-etf-analysis'))
    expect(softwareLinks[2].textContent).toBe('分析报告')
    expect(softwareLinks[2].getAttribute('title')).toBe('软件ETF嘉实')
    const cloudRow = screen.getByText('516510').closest('tr')!
    const cloudLinks = within(cloudRow).getAllByRole('link')
    expect(cloudLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/516510-cloud-computing-etf-analysis'))
    expect(cloudLinks[2].textContent).toBe('分析报告')
    expect(cloudLinks[2].getAttribute('title')).toBe('云计算ETF易方达')
    const consumerElectronicsRow = screen.getByText('159732').closest('tr')!
    const consumerElectronicsLinks = within(consumerElectronicsRow).getAllByRole('link')
    expect(consumerElectronicsLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/159732-consumer-electronics-etf-analysis'))
    expect(consumerElectronicsLinks[2].textContent).toBe('分析报告')
    expect(consumerElectronicsLinks[2].getAttribute('title')).toBe('消费电子ETF华夏')
    const mediaRow = screen.getByText('512980').closest('tr')!
    const mediaLinks = within(mediaRow).getAllByRole('link')
    expect(mediaLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/512980-media-etf-analysis'))
    expect(mediaLinks[2].textContent).toBe('分析报告')
    expect(mediaLinks[2].getAttribute('title')).toBe('传媒ETF广发')
    const gameRow = screen.getByText('159869').closest('tr')!
    const gameLinks = within(gameRow).getAllByRole('link')
    expect(gameLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/159869-game-etf-analysis'))
    expect(gameLinks[2].textContent).toBe('分析报告')
    expect(gameLinks[2].getAttribute('title')).toBe('游戏ETF华夏')
  })

  it('每只 ETF 都有网格详情入口，按代码打开（整页加载的 /note/ 地址）', () => {
    renderPage()
    const links = screen.getAllByRole('link', { name: '行情网格' }).filter(link => link.closest('#industry-etf'))
    expect(links).toHaveLength(59)
    const row = screen.getByText('159928').closest('tr')!
    const href = within(row).getByRole('link', { name: '行情网格' }).getAttribute('href')!
    expect(href.startsWith('/note/lab/grid-trading/detail/?code=159928&name=')).toBe(true)
    expect(new URL(href, 'http://x').searchParams.get('name')).toBeTruthy()
  })

  it('外部参考链接在新标签页打开并带 rel=noopener noreferrer', () => {
    renderPage()
    for (const a of screen.getAllByRole('link').filter(a => /^https?:\/\//.test(a.getAttribute('href') ?? ''))) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })
})
