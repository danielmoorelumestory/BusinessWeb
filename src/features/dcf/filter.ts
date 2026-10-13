// 按本机 DCF 记录筛选公司：已算 / 未算 / 安全边际下限。安全边际 = (合理价 − 现价) / 现价。

export type DcfFilterId = 'all' | 'done' | 'none' | 'mos0' | 'mos20'

export const DCF_FILTERS: Array<{ id: DcfFilterId; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'done', label: '已算 DCF' },
  { id: 'none', label: '未算' },
  { id: 'mos0', label: '安全边际 ≥0' },
  { id: 'mos20', label: '安全边际 ≥20%' },
]

export interface DcfSummary { price: number | null; mos: number | null }

export function matchDcfFilter(filter: DcfFilterId, dcf: DcfSummary | undefined): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return !dcf
  if (!dcf) return false
  if (filter === 'done') return true
  if (dcf.mos === null || !Number.isFinite(dcf.mos)) return false
  return dcf.mos >= (filter === 'mos20' ? 0.2 : 0)
}
