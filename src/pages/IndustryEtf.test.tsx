import React from 'react'
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import IndustryEtf from './IndustryEtf'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const renderPage = () => render(<MemoryRouter><IndustryEtf /></MemoryRouter>)

describe('IndustryEtf', () => {
  it('显示 7 个行业组与 59 只 ETF，总数与各组数量一致，且行业组为二级分类', () => {
    renderPage()
    expect(screen.getByText(/7 个行业组，共 59 只 ETF/)).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(8)
    const rows = screen.getAllByRole('row').filter(r => !r.closest('#broad-etf') && within(r).queryAllByRole('columnheader').length === 0)
    expect(rows).toHaveLength(59)
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
      expect(within(row).getByRole('link', { name: '基金档案 ↗' }).getAttribute('href')).toMatch(/^https:\/\/fundf10.eastmoney.com/)
      expect(within(row).getByRole('link', { name: '行情·网格' }).getAttribute('href')).toContain(`code=${row.firstElementChild!.textContent}`)
    }
  })

  it('站内参考链接用 Link 指向 /notes/<slug>', () => {
    renderPage()
    const link = screen.getByRole('link', { name: '机器人ETF对比研报：562500 vs 159530' })
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
    expect(chipLinks[2].textContent).toBe('科创芯片ETF')
    const semiconductorRow = screen.getByText('588170').closest('tr')!
    const semiconductorLinks = within(semiconductorRow).getAllByRole('link').filter(a => !a.getAttribute('href')!.startsWith('/note/'))
    expect(semiconductorLinks.map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/588170-star-semiconductor-etf-analysis'))
    expect(semiconductorLinks[2].textContent).toBe('科创半导体ETF')
    const communicationsRow = screen.getByText('515880').closest('tr')!
    const communicationsLinks = within(communicationsRow).getAllByRole('link')
    expect(communicationsLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/515880-communications-etf-analysis'))
    expect(communicationsLinks[2].textContent).toBe('通信ETF')
    const aiRow = screen.getByText('159819').closest('tr')!
    const aiLinks = within(aiRow).getAllByRole('link')
    expect(aiLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/159819-ai-etf-analysis'))
    expect(aiLinks[2].textContent).toBe('人工智能ETF')
    const softwareRow = screen.getByText('159852').closest('tr')!
    const softwareLinks = within(softwareRow).getAllByRole('link')
    expect(softwareLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/159852-software-etf-analysis'))
    expect(softwareLinks[2].textContent).toBe('软件ETF嘉实')
    const cloudRow = screen.getByText('516510').closest('tr')!
    const cloudLinks = within(cloudRow).getAllByRole('link')
    expect(cloudLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/516510-cloud-computing-etf-analysis'))
    expect(cloudLinks[2].textContent).toBe('云计算ETF易方达')
    const consumerElectronicsRow = screen.getByText('159732').closest('tr')!
    const consumerElectronicsLinks = within(consumerElectronicsRow).getAllByRole('link')
    expect(consumerElectronicsLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/159732-consumer-electronics-etf-analysis'))
    expect(consumerElectronicsLinks[2].textContent).toBe('消费电子ETF华夏')
    const mediaRow = screen.getByText('512980').closest('tr')!
    const mediaLinks = within(mediaRow).getAllByRole('link')
    expect(mediaLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/512980-media-etf-analysis'))
    expect(mediaLinks[2].textContent).toBe('传媒ETF广发')
    const gameRow = screen.getByText('159869').closest('tr')!
    const gameLinks = within(gameRow).getAllByRole('link')
    expect(gameLinks.slice(0, 3).map(a => a.getAttribute('href'))).toEqual(Array(3).fill('/notes/159869-game-etf-analysis'))
    expect(gameLinks[2].textContent).toBe('游戏ETF华夏')
  })

  it('每只 ETF 都有网格详情入口，按代码打开（整页加载的 /note/ 地址）', () => {
    renderPage()
    const links = screen.getAllByRole('link', { name: '行情·网格' }).filter(link => !link.closest('#broad-etf'))
    expect(links).toHaveLength(59)
    const row = screen.getByText('159928').closest('tr')!
    const href = within(row).getByRole('link', { name: '行情·网格' }).getAttribute('href')!
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
