import { describe, expect, it } from 'vitest'
import { cycleReadout } from './cycle'
import type { MacroSnapshot } from './indicators'

const ser = (hist: number[]) => ({ unit: '', latest: { date: '2026-10-01', value: hist[hist.length - 1] }, history: hist.map((v, i) => [`2026-${String(i + 1).padStart(2, '0')}-01`, v] as [string, number]) })
const snap = (o: Record<string, number[]>): MacroSnapshot => ({ generatedAt: '2026-10-13', source: 't', series: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ser(v)])) } as unknown as MacroSnapshot)

describe('周期定位', () => {
  it('增长回升 + 通胀回落 = 最友好象限', () => {
    const r = cycleReadout(snap({ gdp: [1.5, 2.5], unrate: [4.5, 4.4, 4.3, 4.2], corePce: [3.2, 3.1, 3.0, 2.8] }))
    expect(r.growth.dir).toBe('up'); expect(r.inflation.dir).toBe('down'); expect(r.quadrant).toBe('upDown')
  })
  it('增长放缓 + 通胀上行 = 滞胀', () => {
    const r = cycleReadout(snap({ gdp: [3, 2], unrate: [4.0, 4.1, 4.2, 4.4], corePce: [2.5, 2.7, 2.9, 3.2] }))
    expect(r.quadrant).toBe('downUp')
  })
  it('信号分歧或持平时不硬归象限', () => {
    const r = cycleReadout(snap({ gdp: [2.0, 2.2], unrate: [4.1, 4.1, 4.2, 4.1], corePce: [3.0, 3.0, 3.0, 3.01] }))
    expect(r.quadrant).toBeNull()
  })
  it('缺数据不报错', () => {
    expect(cycleReadout(snap({})).quadrant).toBeNull()
  })
  it('债务周期读数带一年前对比', () => {
    const r = cycleReadout(snap({ ccDelinq: [2, 2.1, 2.2, 2.3, 2.5], hy: [300] }))
    expect(r.debt.find(d => d.name.includes('逾期'))?.prior).toBe(2)
  })
})
