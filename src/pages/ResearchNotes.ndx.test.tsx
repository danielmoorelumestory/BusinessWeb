// @ts-ignore 测试环境在 Node 中运行，项目未安装 @types/node
import { readFileSync } from 'node:fs'
// @ts-ignore
import { resolve } from 'node:path'
import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import ResearchNotes from './ResearchNotes'
import CompanyDetail from './CompanyDetail'
import { ndxCompanies, loadCompanies } from '../data/companies'
import { NDX_CODES } from '../data/ndx100'

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

const NEW_CODES = ['ALNY', 'ALAB', 'CCEP', 'CRWV', 'FER', 'HONA', 'MSTR', 'NBIS', 'RKLB', 'TRI']
const num = (s: string): number => Number(s.replace(/[^0-9.\-]/g, ''))

describe('纳指100：单独分类', () => {
  it('新增 10 家都是 ndx 市场的手工研究页，含三情景、买入纪律与多空交锋', () => {
    expect(ndxCompanies.map(c => c.code).sort()).toEqual([...NEW_CODES].sort())
    for (const c of ndxCompanies) {
      expect(c.market).toBe('ndx')
      expect(c.scenarios?.map(s => s.name)).toEqual(['悲观', '基准', '乐观'])
      expect(c.discipline?.zone && c.discipline.invalid).toBeTruthy()
      expect(c.bullBear?.verdict).toBeTruthy()
      expect((c.segments || []).length).toBeGreaterThanOrEqual(3)
      expect((c.risk || []).length).toBeGreaterThanOrEqual(3)
      expect(c.pitfalls?.some(x => x.includes('[MISSING]'))).toBe(true)
    }
  })

  it('情景价相对现价的涨跌幅与价格锚点自洽（容差 1 个百分点）', () => {
    for (const c of ndxCompanies) {
      const anchor = c.metrics.find(([k]) => k === '价格锚点')?.[1] ?? ''
      const price = num(anchor.match(/US\$([0-9.]+)/)?.[1] ?? '')
      expect(price, c.code).toBeGreaterThan(0)
      for (const s of c.scenarios || []) {
        const p = num(s.price.replace('US$', ''))
        const pct = (p / price - 1) * 100
        expect(Math.abs(pct - num(s.change)), `${c.code} ${s.name}`).toBeLessThan(1)
      }
      const [bear, base, bull] = (c.scenarios || []).map(s => num(s.price.replace('US$', '')))
      expect(bear).toBeLessThan(base)
      expect(base).toBeLessThan(bull)
    }
  })

  it('盈亏比说明与情景价一致：P 在悲观与基准之间时按 (Base−P)/(P−Bear) 的 2:1 反推门槛价', () => {
    for (const c of ndxCompanies) {
      const price = num((c.metrics.find(([k]) => k === '价格锚点')?.[1] ?? '').match(/US\$([0-9.]+)/)?.[1] ?? '')
      const [bear, base] = (c.scenarios || []).map(s => num(s.price.replace('US$', '')))
      const pStar = (base + 2 * bear) / 3
      const stated = num((c.ratioNote ?? '').match(/约 US\$([0-9.]+)/)?.[1] ?? '')
      expect(Math.abs(stated - pStar), c.code).toBeLessThan(0.1)
      // 现价未达到 2:1 门槛的评级不得是优先关注/买入
      if (price > pStar) expect(c.rating).toMatch(/^(观察|回避)/)
    }
  })

  it('纳指100 成分名单 100 个条目无重复，且都能解析到研究页', async () => {
    expect(NDX_CODES).toHaveLength(100)
    expect(new Set(NDX_CODES).size).toBe(100)
    const [us, adr] = await Promise.all([loadCompanies('us'), loadCompanies('adr')])
    const known = new Set([...us, ...adr, ...ndxCompanies].map(c => c.code))
    expect(NDX_CODES.filter(c => !known.has(c))).toEqual([])
  })

  it('页签单独存在，列表显示 100 个条目并标明来源，新增公司不出现在标普500 列表', async () => {
    renderAt('/research-notes?tab=category&m=ndx')
    await waitFor(() => expect(screen.getAllByText(/Alnylam/).length).toBeGreaterThan(0), { timeout: 8000 })
    expect(screen.getByRole('button', { name: '纳指100' })).toBeTruthy()
    expect(screen.getAllByText('纳指新增').length).toBe(10)
    expect(screen.getAllByText('同属标普500').length).toBeGreaterThan(40)
    expect(screen.getAllByRole('button', { name: /^全部 100$/ }).length).toBeGreaterThan(0)
    cleanup()
    const us = await loadCompanies('us')
    expect(us.some(c => NEW_CODES.includes(c.code))).toBe(false)
  })

  it('新增公司详情页可打开，标注纳指100，且显示三情景与免责边界', async () => {
    renderAt('/research-notes/ndx/ALNY')
    await waitFor(() => expect(screen.getAllByText(/条件价格（研究假设）/).length).toBeGreaterThan(0), { timeout: 8000 })
    expect(screen.getAllByText(/纳指100 · ALNY/).length).toBeGreaterThan(0)
    expect(screen.queryByText('程序化研究页')).toBeNull()
    expect(screen.getAllByText(/Bear/).length).toBeGreaterThan(0)
  })
})
