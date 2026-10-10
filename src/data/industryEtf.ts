import rawData from './industryEtf.json'

// 行业 ETF 清单（来自 notes，7 个行业组）。referenceUrl 以 notes/ 开头的是主站笔记（/notes/<slug>），否则是外部链接。
export type EtfItem = {
  code: string; name: string; market: string; subTheme: string; remark: string
  referenceUrl?: string; referenceTitle?: string
}
export type IndustryGroup = { id: string; index: string; name: string; count: number; items: EtfItem[] }

export const INDUSTRY_GROUPS: IndustryGroup[] = rawData as IndustryGroup[]
export const TOTAL_ETF_COUNT = INDUSTRY_GROUPS.reduce((sum, g) => sum + g.items.length, 0)
export const INDUSTRY_ETF_DISCLAIMER = '以下清单只用于研究参考，规模、收益与备注是整理时的快照，会过期，不构成投资建议；买入前请以基金公司和交易所公告为准。'

export const internalNoteSlug = (referenceUrl: string | undefined): string | null => {
  const m = referenceUrl?.match(/^notes\/([\w-]+)\/?$/)
  return m ? m[1] : null
}
