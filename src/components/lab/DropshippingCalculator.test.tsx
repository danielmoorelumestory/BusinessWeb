import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import DropshippingCalculator from './DropshippingCalculator'

afterEach(cleanup)
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

it('区分单笔贡献、月结余和实际工时，不把销售差价当净利润', () => {
  render(<DropshippingCalculator />)
  expect(screen.getByLabelText('单笔贡献利润').textContent).toBe('¥20.00')
  expect(screen.getByLabelText('贡献率').textContent).toBe('30.8%')
  expect(screen.getByLabelText('税前经营结余（月）').textContent).toBe('¥100.00')
  expect(screen.getByLabelText('税前每小时收益').textContent).toBe('¥3.33')
  expect(screen.getByLabelText('覆盖固定支出所需订单').textContent).toBe('25 单')
  expect(screen.getByLabelText('推广费盈亏线／单').textContent).toBe('¥28.00')
})

it('推广和售后同时上升时显示亏损，恢复示例可重新计算', () => {
  render(<DropshippingCalculator />)
  change('分摊推广费用（元／单）', '16')
  change('售后净损耗（元／单）', '8')
  expect(screen.getByLabelText('单笔贡献利润').textContent).toBe('¥7.00')
  expect(screen.getByLabelText('税前经营结余（月）').textContent).toBe('-¥290.00')
  expect(screen.getByLabelText('覆盖固定支出所需订单').textContent).toBe('72 单')
  fireEvent.click(screen.getByRole('button', { name: '恢复示例' }))
  expect(screen.getByLabelText('单笔贡献利润').textContent).toBe('¥20.00')
})

it('贡献为零或负数时不产生无限的盈亏平衡单量', () => {
  render(<DropshippingCalculator />)
  change('分摊推广费用（元／单）', '28')
  expect(screen.getByLabelText('覆盖固定支出所需订单').textContent).toBe('单笔无正贡献')
  expect(screen.getByLabelText('税前经营结余（月）').textContent).toBe('-¥500.00')
  expect(screen.getByText(/增加订单无法改善经营结果/)).toBeTruthy()
  change('分摊推广费用（元／单）', '30')
  expect(screen.getByLabelText('单笔贡献利润').textContent).toBe('-¥2.00')
  expect(screen.getByLabelText('覆盖固定支出所需订单').textContent).toBe('单笔无正贡献')
})

it('零收入与零工时不产生 NaN 或 Infinity；零订单仍扣当月固定支出', () => {
  const { container } = render(<DropshippingCalculator />)
  change('本月全部经营工时', '0')
  change('实际售价（元／单）', '0')
  change('预计完成订单（月）', '0')
  expect(screen.getByLabelText('贡献率').textContent).toBe('—')
  expect(screen.getByLabelText('税前每小时收益').textContent).toBe('—（需记录工时）')
  expect(screen.getByLabelText('税前经营结余（月）').textContent).toBe('-¥500.00')
  expect(container.textContent).not.toMatch(/NaN|Infinity/)
})

it.each([['实际售价（元／单）', ''], ['采购成本（元／单）', '-1'], ['预计完成订单（月）', '1.5']])('无效输入不展示误导的利润结果：%s = %s', (label, value) => {
  render(<DropshippingCalculator />)
  change(label, value)
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(screen.queryByLabelText('单笔贡献利润')).toBeNull()
})
