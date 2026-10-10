import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SolidStateCompany from './SolidStateCompany'
import FutureTrends from './FutureTrends'

function open(id: string) {
  return render(<MemoryRouter initialEntries={[`/future-trends/solid-state/${id}`]}><Routes><Route path="/future-trends/solid-state/:id" element={<SolidStateCompany />} /><Route path="/future-trends" element={<FutureTrends />} /></Routes></MemoryRouter>)
}
describe('固态电池公司二级研究页', () => {
  it('首页公司可进入独立页并返回固态 tab，实际展示财务和研究内容', () => {
    render(<MemoryRouter initialEntries={['/future-trends?tab=solid-state']}><Routes><Route path="/future-trends" element={<FutureTrends />} /><Route path="/future-trends/solid-state/:id" element={<SolidStateCompany />} /></Routes></MemoryRouter>)
    const pool = screen.getByRole('region', { name: '公司观察池：从产业格局逐条提取' })
    fireEvent.click(within(pool).getByRole('link', { name: '先导智能' }))
    expect(screen.getByRole('heading', { level: 1, name: '先导智能' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '季度趋势 · 金额为财报币种的亿' })).toBeTruthy()
    expect(screen.getAllByText('81.89 亿').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'EPS × PE 敏感性（不属于第二种独立估值）' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '下载本公司研究 JSON' })).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: '← 返回固态电池专题' }))
    expect(screen.getByRole('tab', { name: '固态电池' }).getAttribute('aria-selected')).toBe('true')
  })
  it('北交所空数据保留缺项，不把未复核旧价当新行情', () => {
    open('920185-bj')
    expect(screen.getByRole('heading', { level: 1, name: '贝特瑞' })).toBeTruthy()
    expect(screen.getByText(/可比季度报表 \[MISSING\]/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('21.82')
    expect(screen.getByRole('heading', { name: '固态业务敞口与证据边界' })).toBeTruthy()
  })
  it('非上市主体有研究页，清楚区分身份和财务缺失', () => {
    open('entity-weilan')
    expect(screen.getByRole('heading', { level: 1, name: '卫蓝新能源' })).toBeTruthy()
    expect(screen.getByText('独立发行人及证券代码未核，不使用合作方代码。')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '风险、证伪与验证日历' })).toBeTruthy()
  })
  it('海外公司分开账单与 GAAP 收入，并可打开同环节公司', () => {
    open('qs')
    expect(screen.getByRole('heading', { level: 1, name: 'QuantumScape' })).toBeTruthy()
    expect(screen.getAllByText(/账单不能当 GAAP 收入/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Solid Power' }).getAttribute('href')).toBe('/future-trends/solid-state/sldp')
    expect(screen.getByRole('link', { name: /SEC 2026 Q2 股东信/ }).getAttribute('href')).toContain('sec.gov')
  })
  it('无效深链接有明确返回入口', () => {
    open('no-such-company')
    expect(screen.getByRole('heading', { name: '未找到固态电池公司研究' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '返回固态电池专题' }).getAttribute('href')).toBe('/future-trends?tab=solid-state')
  })
})
