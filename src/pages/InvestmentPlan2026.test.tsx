import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InvestmentPlan2026 from './InvestmentPlan2026'

beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 }))) })
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })

const openAllocation = () => {
  render(<MemoryRouter><InvestmentPlan2026 /></MemoryRouter>)
  fireEvent.click(screen.getByRole('tab', { name: /配置与纪律/ }))
}
const openSection = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const names = () => (screen.getAllByRole('textbox', { name: /资产名称/ }) as HTMLInputElement[]).map(i => i.value)
const targets = () => (screen.getAllByRole('textbox', { name: /目标占比/ }) as HTMLInputElement[]).map(i => Number(i.value))

describe('再平衡检查器的示例与书第9章9.10一致', () => {
  it('默认是宽基均衡档：权益50%以A股宽基为主，不含主题指数', () => {
    openAllocation()
    expect(names()).toEqual(['A股宽基', '标普500', '红利低波', '中短债/纯债'])
    expect(targets()).toEqual([30, 15, 5, 50])
    expect(names()).not.toContain('恒生科技')
  })

  it('可切换保守、积极档与作者案例；每档目标合计100%', () => {
    openAllocation()
    fireEvent.click(screen.getByRole('button', { name: '保守档' }))
    expect(targets()).toEqual([18, 9, 3, 70])
    fireEvent.click(screen.getByRole('button', { name: '积极档' }))
    expect(targets()).toEqual([42, 21, 7, 30])
    fireEvent.click(screen.getByRole('button', { name: '作者案例' }))
    expect(names()).toContain('恒生科技')
    expect(targets().reduce((a, b) => a + b, 0)).toBe(100)
  })
})

describe('情绪工具：打开即并行获取全部读数', () => {
  it('一次请求 /api/sentiment 填入六项读数，并显示数据日期与来源', async () => {
    const snapshot = { equityPC: 0.58, spxPC: 1.15, pcDate: '2026-10-02', vix: 15.59, vix3m: 18.07, vixDate: '2026-10-05', gexBn: 7.69, gexDate: '2026-10-02', goldSilver: 67.73, goldSilverDate: '2026-10-05', warnings: [] }
    const fetcher = vi.fn(async (url: string) => (String(url).includes('/api/sentiment') ? new Response(JSON.stringify(snapshot)) : new Response('{}', { status: 500 })))
    vi.stubGlobal('fetch', fetcher)
    render(<MemoryRouter><InvestmentPlan2026 /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /情绪工具/ }))
    const value = (label: RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value
    await screen.findByText(/P\/C 2026-10-02/)
    expect([value(/Equity P\/C/), value(/SPX P\/C/), value(/VIX（30天）/), value(/VIX3M/), value(/Net GEX/), value(/金银比/)]).toEqual(['0.58', '1.15', '15.59', '18.07', '7.69', '67.73'])
    expect(fetcher.mock.calls.filter(([u]) => String(u).includes('/api/sentiment'))).toHaveLength(1)
    expect(screen.getByText(/VIX 期限结构正常/)).toBeTruthy()
  })
})

describe('再平衡检查器：风险贡献', () => {
  it('作者案例里恒生科技只占 20% 的钱，却承担约一半以上的风险，并给出提示', () => {
    openAllocation()
    fireEvent.click(screen.getByRole('button', { name: '作者案例' }))
    openSection('风险透视')
    expect(screen.getByText(/权重 vs 风险贡献（按目标占比）/)).toBeTruthy()
    expect(screen.getByText(/只占钱的 20%（占风险资产的 25%），却承担约 55%/)).toBeTruthy()
  })

  it('均衡档没有单项风险畸高，不出现提示；个股名称标为未识别', () => {
    openAllocation()
    openSection('风险透视')
    expect(screen.queryByText(/却承担约/)).toBeNull()
    expect(screen.getByText(/风险资产合计占钱的 50%，承担约 (9\d|10\d)%/)).toBeTruthy()
    openSection('修改持仓与目标')
    fireEvent.click(screen.getByRole('button', { name: /添加/ }))
    fireEvent.change(screen.getByLabelText('资产名称 新资产'), { target: { value: '某只个股' } })
    fireEvent.change(screen.getByLabelText('目标占比 某只个股'), { target: { value: '10' } })
    openSection('风险透视')
    expect(screen.getByText(/未识别并排除：某只个股/)).toBeTruthy()
  })
})

describe('交易前检查单与冷静期', () => {
  const register = (name: string) => {
    if (!screen.queryByLabelText('登记标的或操作')) openSection('纪律与交易前检查')
    fireEvent.change(screen.getByLabelText('登记标的或操作'), { target: { value: name } })
    fireEvent.click(screen.getByRole('button', { name: /登记这个想法/ }))
  }

  it('登记后处于「检查单未通过」，勾全并写证伪条件后进入冷静期而不是直接可执行', () => {
    openAllocation()
    register('腾讯控股')
    expect(screen.getByText('检查单未通过')).toBeTruthy()
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
    fireEvent.change(screen.getByLabelText('证伪条件 腾讯控股'), { target: { value: '云业务毛利率连续两季下滑' } })
    expect(screen.getByText('冷静期中')).toBeTruthy()
    expect(screen.getByText(/还剩 (47|48) 小时|还剩 1 天 2\d 小时|还剩 2 天/)).toBeTruthy()
  })

  it('写下提前执行理由后留痕，状态变为「已提前执行」；记录刷新后仍在', () => {
    openAllocation()
    register('英伟达')
    fireEvent.change(screen.getByLabelText('提前执行理由 英伟达'), { target: { value: '财报后大幅跳空' } })
    expect(screen.getByText('已提前执行（留痕）')).toBeTruthy()
    cleanup()
    openAllocation()
    openSection('纪律与交易前检查')
    expect(screen.getByText('英伟达')).toBeTruthy()
    expect(screen.getByText('已提前执行（留痕）')).toBeTruthy()
  })

  it('空名称不登记，可删除记录', () => {
    openAllocation()
    openSection('纪律与交易前检查')
    fireEvent.click(screen.getByRole('button', { name: /登记这个想法/ }))
    expect(screen.queryByText('检查单未通过')).toBeNull()
    register('美团')
    fireEvent.click(screen.getByRole('button', { name: '删除 美团' }))
    expect(screen.queryByText('美团')).toBeNull()
  })
})

describe('历史情景压力测试', () => {
  it('作者案例列出五个情景；2008 年黄金与恒生科技当时无数据而不被替代', () => {
    openAllocation()
    fireEvent.click(screen.getByRole('button', { name: '作者案例' }))
    openSection('风险透视')
    for (const name of ['2008 全球金融危机', '2015 年夏 A 股股灾', '2020 年 3 月流动性踩踏', '2022 美联储加息：股债双杀', '2021–2022 恒生科技深跌']) {
      expect(screen.getByText(name)).toBeTruthy()
    }
    expect(screen.getAllByText(/黄金、恒生科技当时无数据|恒生科技、黄金当时无数据/).length).toBeGreaterThan(0)
  })

  it('没有任何可识别资产时不显示压力测试', () => {
    openAllocation()
    for (const input of screen.getAllByRole('textbox', { name: /资产名称/ })) fireEvent.change(input, { target: { value: '某只个股' } })
    openSection('风险透视')
    expect(screen.queryByText(/如果历史重演/)).toBeNull()
  })
})

describe('币种敞口', () => {
  it('作者案例：非人民币定价合计 60%', () => {
    openAllocation()
    fireEvent.click(screen.getByRole('button', { name: '作者案例' }))
    openSection('风险透视')
    expect(screen.getByText('币种敞口：资产的价格由哪种货币决定')).toBeTruthy()
    expect(screen.getByText(/非人民币定价的资产合计约 60%/)).toBeTruthy()
  })
})

describe('自由生活覆盖率', () => {
  it('填入金额、股息率与开支后，给出两把尺子的覆盖率与备用金月数', () => {
    openAllocation()
    fireEvent.click(screen.getByRole('button', { name: '作者案例' }))
    const amounts = screen.getAllByPlaceholderText('万元')
    amounts.forEach(a => fireEvent.change(a, { target: { value: '20' } })) // 五项各 20，共 100
    openSection('现金流')
    fireEvent.change(screen.getByLabelText('股息率 红利低波'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('股息率 纯债基金'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText(/年必要生活开支/), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText(/备用金/), { target: { value: '4' } })
    // 年现金流 20*5%+20*3% = 1.6；覆盖率 1.6/8 = 20%；4% 提款 4/8 = 50%；备用金 4/(8/12) = 6 个月
    const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent
    expect(valueOf('股息利息覆盖率')).toBe('20%')
    expect(valueOf('4% 提款覆盖率')).toBe('50%')
    expect(valueOf('备用金可撑')).toBe('6.0 个月')
    expect(screen.getByText(/还差约 100 万元/)).toBeTruthy()
  })

  it('没填开支时不给覆盖率', () => {
    openAllocation()
    openSection('现金流')
    expect(screen.queryByText('股息利息覆盖率')).toBeNull()
  })
})

describe('配置与纪律的小节导航', () => {
  it('默认显示再平衡检查；切换小节只显示对应内容，并写入 URL', () => {
    render(<MemoryRouter><InvestmentPlan2026 /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /配置与纪律/ }))
    expect(screen.getByText('再平衡检查器')).toBeTruthy()
    expect(screen.queryByText('风险透视', { selector: 'h3' })).toBeNull()
    openSection('纪律与交易前检查')
    expect(screen.queryByText('再平衡检查器')).toBeNull()
    expect(screen.getByText('交易前检查单与冷静期')).toBeTruthy()
    expect(screen.getByText('不可越过的红线')).toBeTruthy()
    expect(screen.getByRole('button', { name: '纪律与交易前检查' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('URL 带 sec 参数时直接打开对应小节', () => {
    render(<MemoryRouter initialEntries={['/?tab=allocation&sec=cashflow']}><InvestmentPlan2026 /></MemoryRouter>)
    expect(screen.getByText(/自由生活覆盖率/)).toBeTruthy()
  })
})
