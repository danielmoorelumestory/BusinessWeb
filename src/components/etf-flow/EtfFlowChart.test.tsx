import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EtfFlowChart, type FlowPoint } from './EtfFlowChart'

const series: FlowPoint[] = [
  { date: '2026-11-09', flow_all: 54.18, flow_broad: 40.1, index: 3700 },
  { date: '2026-11-10', flow_all: -8.73, flow_broad: -6.2, index: 3680 },
  { date: '2026-11-11', flow_all: -49.19, flow_broad: -40.0, index: 3660 },
  { date: '2026-11-12', flow_all: -248.01, flow_broad: -226.22, index: 3650 },
  { date: '2026-11-13', flow_all: -149.44, flow_broad: -131.79, index: 3634 },
  { date: '2026-11-16', flow_all: 206.57, flow_broad: 176.2, index: 3602 },
]

describe('EtfFlowChart 交互', () => {
  it('渲染主图柱 + 底部范围滑块双手柄', () => {
    const { container } = render(<EtfFlowChart series={series} scope="all" />)
    expect(container.querySelectorAll('svg').length).toBe(2)              // 主图 + 概览
    expect(container.querySelectorAll('.etf-flow__ov-handle').length).toBe(2) // 两个手柄
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(series.length)
  })

  it('指针移入出现十字光标 tooltip（日期 + 申购净流入 + 上证指数）', () => {
    const { container } = render(<EtfFlowChart series={series} scope="broad" />)
    expect(container.querySelector('.etf-flow__tip')).toBeNull()          // 初始无
    fireEvent.pointerMove(screen.getByRole('img'), { clientX: 10 })
    const tip = container.querySelector('.etf-flow__tip')
    expect(tip).not.toBeNull()
    expect(tip?.textContent).toContain('宽基ETF申购净流入')
    expect(tip?.textContent).toContain('上证指数')
    fireEvent.pointerLeave(screen.getByRole('img'))
    expect(container.querySelector('.etf-flow__tip')).toBeNull()          // 移出消失
  })

  it('空序列渲染为空', () => {
    const { container } = render(<EtfFlowChart series={[]} scope="all" />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
