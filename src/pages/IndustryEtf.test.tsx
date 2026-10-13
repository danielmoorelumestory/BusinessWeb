import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import IndustryEtf from './IndustryEtf'

afterEach(cleanup)
const renderPage = () => render(<MemoryRouter><IndustryEtf /></MemoryRouter>)

describe('IndustryEtf', () => {
  it('显示 7 个行业组与 59 只 ETF，总数与各组数量一致', () => {
    renderPage()
    expect(screen.getByText(/7 个行业组，共 59 只 ETF/)).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(7)
    const rows = screen.getAllByRole('row').filter(r => within(r).queryAllByRole('columnheader').length === 0)
    expect(rows).toHaveLength(59)
    expect(screen.getByRole('heading', { name: /TMT科技/ })).toBeTruthy()
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
    const links = screen.getAllByRole('link', { name: '行情·网格' })
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
