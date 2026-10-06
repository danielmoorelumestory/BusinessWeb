// @ts-ignore 测试在 Node 中运行
import { readFileSync } from 'node:fs'
// @ts-ignore
import { resolve } from 'node:path'
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import IndustryLandscape from './IndustryLandscape'

const fetcher = vi.fn(async (url: string) => {
  const file = String(url).includes('semiconductor') ? 'semiconductor.json' : 'solid-state.json'
  const text = readFileSync(resolve('public/industry', file), 'utf8')
  return { json: async () => JSON.parse(text) } as Response
})
beforeAll(() => { vi.stubGlobal('fetch', fetcher) })
afterEach(() => cleanup())

describe('产业格局', () => {
  it('半导体产业链和固态电池一样以可展开、可搜索的树展示，不再是图片', async () => {
    render(<IndustryLandscape />)
    fireEvent.click(screen.getByRole('tab', { name: '半导体产业链' }))
    expect(await screen.findByText('上游：基础与工具')).toBeTruthy()
    expect(document.querySelector('img[alt="半导体产业链脑图"]')).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: '搜索节点' }), { target: { value: '安集科技' } })
    expect(screen.getByText(/安集科技/)).toBeTruthy()
  })

  it('切回已看过的页签不重复请求', async () => {
    fetcher.mockClear()
    render(<IndustryLandscape />)
    expect(await screen.findByText(/解决痛点/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '半导体产业链' }))
    await screen.findByText('上游：基础与工具')
    fireEvent.click(screen.getByRole('tab', { name: '固态电池' }))
    fireEvent.click(screen.getByRole('tab', { name: '半导体产业链' }))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('页面声明不构成投资建议，数据里没有荐股、目标价和配置建议', async () => {
    render(<IndustryLandscape />)
    expect(screen.getByRole('note').textContent).toContain('不构成投资建议')
    for (const file of ['solid-state.json', 'semiconductor.json']) {
      const text = readFileSync(resolve('public/industry', file), 'utf8')
      expect(text).not.toMatch(/先买|目标¥|优先配置|机会型配置|公司推荐|投资建议|确定性排序|唯一确定性/)
    }
  })

  it('有「主题研究卡」页签，切过去不请求产业数据', async () => {
    fetcher.mockClear()
    render(<IndustryLandscape />)
    fireEvent.click(screen.getByRole('tab', { name: '主题研究卡' }))
    expect(screen.getByRole('textbox', { name: '主题名称' })).toBeTruthy()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
