import { useEffect, useMemo, useState } from 'react'
import { RESEARCH_INDEX, researchPath } from './futureTrendsResearch'
import { MCP } from './solidState/mcpResearch'
import { solidCompanyPath } from './solidState/companyResearch'
import { loadCompanies, type Market } from './companies'

/** 节点标题里的公司名：取括号、冒号、顿号之前的部分 */
export const companyNameOf = (text: string): string =>
  text.split('\n')[0].split(/[（(：:、]/)[0].replace(/[.\s]+$/, '').trim()

const NOTE_MARKETS: Market[] = ['cn', 'us', 'hk']

/** 公司名 → 站内公司分析页。优先级：固态电池专题 > 未来趋势研究 > 公司研究笔记 */
export function useCompanyLinks(): (text: string) => string | undefined {
  const [notes, setNotes] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let alive = true
    Promise.all(NOTE_MARKETS.map((m) => loadCompanies(m).catch(() => []))).then((lists) => {
      if (!alive) return
      const map = new Map<string, string>()
      lists.forEach((list, i) => {
        for (const c of list) {
          if (!map.has(c.name)) map.set(c.name, `/research-notes/${NOTE_MARKETS[i]}/${encodeURIComponent(c.code)}`)
        }
      })
      setNotes(map)
    })
    return () => {
      alive = false
    }
  }, [])
  const base = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of RESEARCH_INDEX) map.set(c.name, researchPath(c.key))
    for (const c of MCP.companies) map.set(c.name, solidCompanyPath(c))
    return map
  }, [])
  return useMemo(
    () => (text: string) => {
      const name = companyNameOf(text)
      return name ? base.get(name) ?? notes.get(name) : undefined
    },
    [base, notes],
  )
}
