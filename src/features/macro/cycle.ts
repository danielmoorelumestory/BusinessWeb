import type { MacroSnapshot, SeriesData } from './indicators'

// 达利欧式周期定位：增长 × 通胀 四象限（短期），外加债务周期读数（长期，只做背景）。
// 只描述方向，不预测；方向用最近几期与更早几期的差判断，带死区，信号分歧时不硬归象限。

export type Dir = 'up' | 'down' | 'flat'
export type QuadrantKey = 'upDown' | 'upUp' | 'downDown' | 'downUp'

export interface CycleAxis { dir: Dir; label: string; detail: string }
export interface DebtRow { name: string; latest: number; prior: number | null; unit: string; note: string }
export interface CycleReadout { growth: CycleAxis; inflation: CycleAxis; quadrant: QuadrantKey | null; debt: DebtRow[] }

const hist = (s: SeriesData | undefined): [string, number][] => (s ? [...s.history.filter(([, v]) => Number.isFinite(v))] : [])
/** 倒数第 back 个点的值（0 = 最新） */
const back = (s: SeriesData | undefined, n: number): number | null => { const h = hist(s); return h.length > n ? h[h.length - 1 - n][1] : null }
const sign = (diff: number, dead: number): -1 | 0 | 1 => (diff >= dead ? 1 : diff <= -dead ? -1 : 0)

export const QUADRANTS: Record<QuadrantKey, { name: string; tag: string }> = {
  upDown: { name: '增长回升 · 通胀回落', tag: '最友好' },
  upUp: { name: '增长回升 · 通胀上行', tag: '过热' },
  downDown: { name: '增长放缓 · 通胀回落', tag: '偏弱' },
  downUp: { name: '增长放缓 · 通胀上行', tag: '滞胀' },
}

export function cycleReadout(snap: MacroSnapshot): CycleReadout {
  const s = snap.series as unknown as Record<string, SeriesData | undefined>
  // 增长：GDP 环比变化（±0.3pp 死区）+ 失业率三个月变化（±0.1pp 死区，上升为负）
  const gdpNow = s.gdp?.latest.value, gdpPrev = back(s.gdp, 1)
  const unNow = s.unrate?.latest.value, unPrev = back(s.unrate, 3)
  const g1 = gdpNow !== undefined && gdpPrev !== null ? sign(gdpNow - gdpPrev, 0.3) : 0
  const g2 = unNow !== undefined && unPrev !== null ? sign(-(unNow - unPrev), 0.1) : 0
  const gs = g1 + g2
  const growthDir: Dir = gs > 0 ? 'up' : gs < 0 ? 'down' : 'flat'
  const growth: CycleAxis = {
    dir: growthDir,
    label: growthDir === 'up' ? '回升' : growthDir === 'down' ? '放缓' : '持平或信号分歧',
    detail: `GDP 年化 ${gdpNow ?? '—'}%（上期 ${gdpPrev ?? '—'}%）；失业率 ${unNow ?? '—'}%（3 个月前 ${unPrev ?? '—'}%）`,
  }
  // 通胀：核心 PCE 同比相对 3 个月前（±0.1pp 死区）
  const piNow = s.corePce?.latest.value, piPrev = back(s.corePce, 3)
  const is = piNow !== undefined && piPrev !== null ? sign(piNow - piPrev, 0.1) : 0
  const inflDir: Dir = is > 0 ? 'up' : is < 0 ? 'down' : 'flat'
  const inflation: CycleAxis = {
    dir: inflDir,
    label: inflDir === 'up' ? '上行' : inflDir === 'down' ? '回落' : '持平',
    detail: `核心 PCE 同比 ${piNow ?? '—'}%（3 个月前 ${piPrev ?? '—'}%，目标 2%）`,
  }
  const quadrant: QuadrantKey | null = growthDir === 'flat' || inflDir === 'flat' ? null
    : growthDir === 'up' ? (inflDir === 'down' ? 'upDown' : 'upUp') : (inflDir === 'down' ? 'downDown' : 'downUp')

  // 债务周期：长期背景，对比约一年前（季度序列 4 期、月度/日度序列取约 12 个月前）
  const row = (key: string, name: string, unit: string, note: string, lag: number): DebtRow[] => {
    const d = s[key]; if (!d) return []
    return [{ name, latest: d.latest.value, prior: back(d, lag), unit, note }]
  }
  const debt: DebtRow[] = [
    ...row('debtService', '家庭债务偿付 / 可支配收入', '%', '越高，家庭对利率越敏感', 4),
    ...row('ccDelinq', '信用卡逾期率', '%', '信用质量的先行读数', 4),
    ...row('hy', '高收益债利差', 'bp', '信用市场愿不愿意给弱者融资', 12),
    ...row('realRate', '实际利率（政策利率 − 核心 PCE）', 'pp', '正且高，说明融资成本压过通胀', 12),
    ...row('marginGdp', '保证金债务 / GDP', '%', '市场杠杆水平', 12),
  ]
  return { growth, inflation, quadrant, debt }
}
