import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { loadCompanies, type Company } from './companies'
import { cnFinancePropertyIndustrialResearch } from './details/cnFinancePropertyIndustrialResearch'

const directory = 'public/research/cn-finance-property-industrial-2026-10-07'
const read = (name: string) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'))
let loaded: Company[] = []
const findCompany = (_market: string, code: string) => loaded.find(c => c.code === code)
beforeAll(async () => {
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => JSON.parse(readFileSync(resolve('public/data/cn.json'), 'utf8')) }))
  loaded = await loadCompanies('cn')
})

describe('金融、房地产、工业复核的证据边界', () => {
  it('异步补全后仍覆盖270家旧模型，分类数量与报告一致', async () => {
    const list = await loadCompanies('cn')
    const audit = read('audit.json')
    expect(audit.counts).toEqual({ 金融: 82, 房地产: 9, 工业: 179 })
    expect(Object.keys(cnFinancePropertyIndustrialResearch)).toHaveLength(270)
    for (const row of audit.companies) {
      const company = list.find(c => c.code === row.code)!
      expect(company.sector).toBe(row.sector)
      expect(company.headline).toBe(cnFinancePropertyIndustrialResearch[row.code].headline)
      expect(company.researchReport).toBe(`research/cn-finance-property-industrial-2026-10-07/${row.code}.md`)
      expect(company.scenarios).toHaveLength(3)
      expect(company.discipline?.zone).toContain('[MISSING]')
      if (!row.numericDraft) expect(company.scenarios?.every(s => s.price.includes('[MISSING]'))).toBe(true)
      expect(row.certified).toBe(false)
    }
    expect(read('batches.json')).toHaveLength(55)
    expect(read('batches.json').every((b: { codes: string[] }) => b.codes.length >= 3 && b.codes.length <= 5)).toBe(true)
  })

  it('银行普通股PB和金融现金流不被工业FCF或总归母权益替代', async () => {
    await loadCompanies('cn')
    const models = read('models.json')
    expect(models['601916'].bvps).toBe(6.61)
    expect(models['601229'].bvps).toBe(18.12)
    expect(models['601328'].bvps).toBe(13.22)
    expect(models['601128'].independentMethodsClosed).toBe(false)
    expect(findCompany('cn', '000001')?.metrics.find(([k]) => k === '现金流口径')?.[1]).toContain('禁止将金融OCF')
    expect(findCompany('cn', '000001')?.ratioNote).toContain('不认证')
    expect(findCompany('cn', '601628')?.metrics.find(([k]) => k === '原件专项核读')?.[1]).toContain('228.6%不等于承保')
  })

  it('保留关键跨页、单位与已完成注销修正，不复活地产旧价格', async () => {
    await loadCompanies('cn')
    const input = read('input.json')
    const facts = Object.fromEntries(input.filings.map((r: { code: string }) => [r.code, r])) as Record<string, any>
    expect(facts['601825'].fields.equity.value).toBe(133099212000)
    expect(facts['600233'].fields.revenue.value).toBe(38893318800)
    expect(facts['601319'].fields.net.value).toBe(36745000000)
    expect(facts['601668'].fields.eps.value).toBe(.55)
    expect(facts['002966'].fields.npl.value).toBe(.81)
    expect(read('models.json')['002352'].referenceShares).toBe(5105148078)
    expect(findCompany('cn', '600606')?.rating).toBe('回避')
    expect(findCompany('cn', '600606')?.metrics.find(([k]) => k === '原件专项核读')?.[1]).toContain('338.42')
    expect(findCompany('cn', '000002')?.scenarios?.every(s => s.price.includes('[MISSING]'))).toBe(true)
    expect(findCompany('cn', '601059')?.metrics.find(([k]) => k === '价格锚点')?.[1]).toContain('可交易性未认证')
  })
})
