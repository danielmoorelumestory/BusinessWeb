import type { MacroSnapshot, SeriesData } from './indicators'
import type { CnKey } from './china'
import type { HkKey } from './hk'

// 数据体检：判断每项读数能不能拿来下结论。规则写死，不依赖模型。
export type Quality = 'ok' | 'stale' | 'invalid' | 'missing'

interface Rule {
  /** 观测日期距今最多多少天仍算新鲜（按各指标的发布节奏 + 公布滞后） */
  maxAge: number
  /** 合理范围：超出说明数据源出错或单位错位 */
  range: [number, number]
}

// 月度宏观数据通常滞后 1–2 个月公布；季度 GDP 下一季度末才出，所以上限放宽
const US: Record<string, Rule> = {
  gdp: { maxAge: 220, range: [-35, 35] },
  unrate: { maxAge: 70, range: [1, 25] },
  sahm: { maxAge: 70, range: [-2, 6] },
  claims: { maxAge: 14, range: [10, 700] },
  corePce: { maxAge: 95, range: [-3, 15] },
  realRate: { maxAge: 95, range: [-10, 10] },
  curve: { maxAge: 7, range: [-4, 5] },
  hy: { maxAge: 7, range: [150, 2500] },
  nfci: { maxAge: 14, range: [-2, 6] },
  vix: { maxAge: 7, range: [5, 90] },
  dd: { maxAge: 7, range: [0, 90] },
  kre: { maxAge: 14, range: [0, 52] },
  // FINRA 次月中旬公布上月数据
  marginGdp: { maxAge: 80, range: [0, 15] },
  cashDebt: { maxAge: 80, range: [0, 500] },
  // 美联储资金流量表季度公布，滞后约三个月
  equityShare: { maxAge: 220, range: [10, 80] },
  buffett: { maxAge: 220, range: [20, 600] },
  debtService: { maxAge: 220, range: [5, 20] },
  ccDelinq: { maxAge: 220, range: [0, 15] },
  tenYear: { maxAge: 7, range: [0, 20] },
  saving: { maxAge: 70, range: [-5, 40] },
  dxy: { maxAge: 7, range: [60, 160] },
  gold: { maxAge: 7, range: [300, 30000] },
  silver: { maxAge: 7, range: [3, 500] },
  wti: { maxAge: 7, range: [10, 250] },
}
const CN: Record<CnKey, Rule> = {
  gdp: { maxAge: 220, range: [-10, 20] },
  pmi: { maxAge: 50, range: [30, 70] },
  nmpmi: { maxAge: 50, range: [30, 70] },
  cpi: { maxAge: 80, range: [-5, 15] },
  ppi: { maxAge: 80, range: [-15, 25] },
  ip: { maxAge: 80, range: [-30, 40] },
  m1m2: { maxAge: 80, range: [-30, 30] },
  lpr: { maxAge: 45, range: [1, 10] },
  marginGdp: { maxAge: 10, range: [0, 8] },
  marginMcap: { maxAge: 10, range: [0, 10] },
}

const HK: Record<HkKey, Rule> = {
  hsiDd: { maxAge: 14, range: [0, 90] },
  hsi12m: { maxAge: 14, range: [-80, 200] },
  hkd: { maxAge: 10, range: [7.6, 8] },
  fed: { maxAge: 95, range: [0, 12] },
  south: { maxAge: 10, range: [-3000, 3000] },
}

export interface QualityResult {
  key: string
  quality: Quality
  reason: string
}

const DAY = 86_400_000

export function checkSeries(key: string, d: SeriesData | undefined, rule: Rule | undefined, today = new Date()): QualityResult {
  if (!d || !d.latest || !Number.isFinite(d.latest.value)) return { key, quality: 'missing', reason: '这次没有拉到数据' }
  if (!rule) return { key, quality: 'ok', reason: '' }
  const [lo, hi] = rule.range
  if (d.latest.value < lo || d.latest.value > hi) return { key, quality: 'invalid', reason: `读数 ${d.latest.value} 超出合理范围 ${lo}～${hi}，疑似数据源出错` }
  const age = Math.floor((today.getTime() - new Date(d.latest.date).getTime()) / DAY)
  if (Number.isNaN(age) || age < -3) return { key, quality: 'invalid', reason: `日期 ${d.latest.date} 无效` }
  if (age > rule.maxAge) return { key, quality: 'stale', reason: `最新读数停在 ${d.latest.date}（${age} 天前），超过该指标正常的 ${rule.maxAge} 天更新周期` }
  return { key, quality: 'ok', reason: '' }
}

export interface QualityReport {
  us: Record<string, QualityResult>
  cn: Record<string, QualityResult>
  counts: Record<Quality, number>
  /** 有过期、异常或缺失的项 */
  issues: (QualityResult & { country: '美国' | '中国' })[]
  /** 阶段信号里有不可靠的项：阶段结论本身也要打折 */
  stageAffected: string[]
}

export function checkQuality(us: MacroSnapshot, cn: MacroSnapshot<CnKey> | null, today = new Date()): QualityReport {
  const usResults = Object.fromEntries(Object.keys(US).map(k => [k, checkSeries(k, us.series[k as keyof typeof us.series], US[k], today)]))
  const cnResults = Object.fromEntries((Object.keys(CN) as CnKey[]).map(k => [k, checkSeries(k, cn?.series[k], CN[k], today)]))
  const counts: Record<Quality, number> = { ok: 0, stale: 0, invalid: 0, missing: 0 }
  const issues: QualityReport['issues'] = []
  for (const [country, set] of [['美国', usResults], ['中国', cnResults]] as const) {
    for (const r of Object.values(set)) {
      counts[r.quality]++
      if (r.quality !== 'ok') issues.push({ ...r, country })
    }
  }
  const stageAffected = ['sahm', 'claims', 'hy', 'vix', 'dd', 'kre'].filter(k => usResults[k].quality !== 'ok')
  return { us: usResults, cn: cnResults, counts, issues, stageAffected }
}

export const QUALITY_LABEL: Record<Quality, string> = { ok: '正常', stale: '过期', invalid: '异常', missing: '缺失' }

/** 港股数据体检：单独成表，不计入总览的体检计数（港股不参与阶段打分） */
export function checkHkQuality(hk: MacroSnapshot<HkKey>, today = new Date()): Record<string, QualityResult> {
  return Object.fromEntries((Object.keys(HK) as HkKey[]).map(k => [k, checkSeries(k, hk.series[k], HK[k], today)]))
}
