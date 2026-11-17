import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { EtfFlowView, type EtfFlowData } from './EtfFlow'

const sample: EtfFlowData = {
  series: [
    { date: '2026-11-13', flow_all: -170.58, flow_broad: -102.25, index: 3634.35 },
    { date: '2026-11-14', flow_all: 12.3, flow_broad: 5.1, index: 3650 },
  ],
  kpi: { all: { yesterday: 12.3, cum60: -158.3 }, broad: { yesterday: 5.1, cum60: -97.1 } },
  note: '市价估算（份额差×市价），非同花顺原口径。',
  updated: '2026-11-14T14:30:00Z',
  sample: false,
}
const renderView = (data = sample) =>
  render(<MemoryRouter><EtfFlowView data={data} /></MemoryRouter>)

describe('EtfFlowView', () => {
  it('渲染标题、KPI 与红绿柱，可切到宽基', () => {
    renderView()
    expect(screen.getByText('ETF 资金净流入')).toBeTruthy()
    expect(screen.getByText('+12.30')).toBeTruthy()              // 全A 昨日 KPI（精确，避开柱 tooltip）
    expect(document.querySelectorAll('svg rect').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: '宽基' }))
    expect(screen.getByText('+5.10')).toBeTruthy()               // 宽基 昨日 KPI
  })

  it('宽基未接入（flow_broad 全 null）：切到宽基显示待接入占位，全A 正常', () => {
    renderView({
      series: [
        { date: '2026-11-13', flow_all: -149.44, flow_broad: null, index: null },
        { date: '2026-11-16', flow_all: 206.57, flow_broad: null, index: 3602.57 },
      ],
      kpi: { all: { yesterday: 206.57, cum60: 57.13 }, broad: { yesterday: 0, cum60: 0 } },
      note: '同花顺原口径', updated: '2026-11-17T14:30:00Z', sample: false,
    })
    expect(screen.getByText('+206.57')).toBeTruthy()               // 全A 昨日 KPI
    fireEvent.click(screen.getByRole('tab', { name: '宽基' }))
    expect(screen.getByText(/待接入/)).toBeTruthy()                // 宽基占位
  })

  it('空数据不崩，显示占位', () => {
    render(<MemoryRouter><EtfFlowView data={{
      series: [], kpi: { all: { yesterday: 0, cum60: 0 }, broad: { yesterday: 0, cum60: 0 } }, note: '', updated: '',
    }} /></MemoryRouter>)
    expect(screen.getByText(/暂无数据/)).toBeTruthy()
  })
})
