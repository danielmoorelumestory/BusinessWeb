import { describe, expect, it } from 'vitest'
import { TRENDS, companyIdentity, trendCoverage } from './futureTrends'
import { SECTOR_PICKS, US_PICKS } from './futureTrendsSectorPicks'
import { POOL, parseGap, parseGrowth } from './futureTrendsPool'
import { CORE } from './futureTrendsCore'

const companies = TRENDS.flatMap(t => t.chain.flatMap(l => [...l.cn, ...l.us]))

describe('九赛道研究观察池', () => {
  it('每条业务关联说明敞口与证据边界，来源链接仅使用 HTTPS', () => {
    for (const company of companies) {
      expect(['直接业务', '多元业务', '研发验证', '间接配套']).toContain(company.exposure)
      expect(company.evidence, company.name).toMatch(/候选待核|已查阅/)
      expect(company.sourceTitle, company.name).toBeTruthy()
      if (company.sourceUrl) expect(new URL(company.sourceUrl).protocol).toBe('https:')
    }
    for (const t of TRENDS) {
      expect(new Set(t.chain.map(l => l.link)).size).toBe(t.chain.length)
      for (const link of t.chain) {
        expect(link.verify, `${t.id}/${link.link}`).toBeTruthy()
        const rows = [...link.cn, ...link.us]
        expect(new Set(rows.map(companyIdentity)).size, `${t.id}/${link.link}`).toBe(rows.length)
      }
    }
  })

  it('纠正不同公司代码混淆，保留更名与分拆后的证券主体', () => {
    expect(companies.filter(c => c.name === '凯赛生物').every(c => c.code === '688065')).toBe(true)
    expect(companies.find(c => c.name === '中科飞测')?.code).toBe('688361')
    expect(companies.filter(c => c.name.includes('百济神州')).every(c => c.code.startsWith('ONC'))).toBe(true)
    expect(companies.some(c => c.name === '韦尔股份' || c.code.includes('BGNE'))).toBe(false)
    expect(companies.filter(c => c.name === 'Qnity Electronics').every(c => c.code === 'Q')).toBe(true)
    expect(companies.find(c => c.name === 'Versigent')?.code).toBe('VGNT')
  })

  it('去重公司计数区分发行人和不同业务关联', () => {
    const nvidia = companies.filter(c => c.code === 'NVDA')
    expect(nvidia.length).toBeGreaterThan(1)
    expect(new Set(nvidia.map(companyIdentity)).size).toBe(1)
    const privateCompanies = companies.filter(c => c.code === '上市状态待核')
    expect(new Set(privateCompanies.map(companyIdentity)).size).toBeGreaterThan(1)
    expect(trendCoverage().companies).toBeLessThan(trendCoverage().entries)
  })
})

describe('赛道综合排序数据', () => {
  it('每家公司都有价位记录，代码不重复', () => {
    for (const [id, s] of [...Object.entries(SECTOR_PICKS), ...Object.entries(US_PICKS).map(([k, v]) => [`us:${k}`, v] as const)]) {
      const codes = s.picks.map(p => p.code)
      expect(new Set(codes).size, id).toBe(codes.length)
      for (const p of s.picks) expect(s.levels.some(l => l.code === p.code), `${id}/${p.name}`).toBe(true)
    }
  })
})

describe('候选池', () => {
  it('跨赛道去重，分数在 0–100，可现在投资的都有模型买点', () => {
    expect(new Set(POOL.map(x => x.key)).size).toBe(POOL.length)
    for (const x of POOL) {
      expect(x.score).toBeGreaterThanOrEqual(0)
      expect(x.score).toBeLessThanOrEqual(100)
      if (x.status === '可现在投资') expect(x.level?.buy.startsWith('≤'), x.pick.name).toBe(true)
    }
  })
  it('解析增速与买点距离', () => {
    expect(parseGrowth('营收 +54% / 归母 −21%（2026H1）')).toEqual([54, -21])
    expect(parseGap('现价附近')).toBe(0)
    expect(parseGap('−21%')).toBe(-21)
    expect(parseGap('重估价约 66 元')).toBeNull()
  })
})

describe('核心 8', () => {
  it('8 家都在候选池中、不重复；估值未认证不升级买入，单一赛道最多 2 家', () => {
    expect(CORE).toHaveLength(8)
    expect(new Set(CORE.map(x => x.key)).size).toBe(8)
    for (const x of CORE) expect(x.item.status, x.key).toBe('估值待认证')
    const trends = CORE.reduce<Record<string, number>>((m, x) => ({ ...m, [x.research.primaryTrend]: (m[x.research.primaryTrend] ?? 0) + 1 }), {})
    for (const [c, n] of Object.entries(trends)) expect(n, c).toBeLessThanOrEqual(2)
  })
})

describe('候选池分桶', () => {
  it('可买卖都满足盈亏比≥0.75 且期望≥20%，其余已分析公司归入价格太贵', async () => {
    const { poolBucket } = await import('./futureTrendsPresentation')
    const { RESEARCH_INDEX } = await import('./futureTrendsResearch')
    const buy = RESEARCH_INDEX.filter(r => poolBucket(r) === 'buy')
    expect(buy).toHaveLength(12)
    for (const r of buy) { expect(r.ratio!, r.key).toBeGreaterThanOrEqual(0.75); expect(r.expected!, r.key).toBeGreaterThanOrEqual(0.2) }
    expect(RESEARCH_INDEX.filter(r => poolBucket(r) === 'rich')).toHaveLength(37)
  })
})
