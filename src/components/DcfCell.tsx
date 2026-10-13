import React from 'react'
import { Link } from 'react-router-dom'
import { dcfLink, toolProgress, type ToolSources } from '../features/candidates/links'
import type { CandidateMarket } from '../features/candidates/validation'
import { DCF_FILTERS, type DcfFilterId } from '../features/dcf/filter'
import '../styles/research.css'

/** 列表里的 DCF 单元格：算过的显示安全边际并可重算，没算过的给「算 DCF」入口（自动带代码、名称、现价） */
export function DcfCell({ market, code, name, price, tools }: { market: CandidateMarket; code: string; name: string; price?: number | null; tools: ToolSources }): JSX.Element {
  const dcf = toolProgress(market, code, tools).dcf
  const to = dcfLink(market, code, name, price)
  if (!dcf) return <Link className="rn-dcf" to={to} aria-label={`算 DCF ${code}`}>算 DCF</Link>
  if (dcf.mos === null) return <Link className="rn-dcf" to={to} aria-label={`重算 DCF ${code}`}>已算，未得安全边际</Link>
  return (
    <Link className={`rn-dcf ${dcf.mos >= 0 ? 'is-good' : 'is-bad'}`} to={to} aria-label={`DCF ${code} 安全边际 ${(dcf.mos * 100).toFixed(0)}%`}>
      安全边际 {dcf.mos >= 0 ? '+' : ''}{(dcf.mos * 100).toFixed(0)}%
    </Link>
  )
}

export function DcfFilterChips({ value, onChange, className }: { value: DcfFilterId; onChange: (id: DcfFilterId) => void; className?: string }): JSX.Element {
  return (
    <span className={className} role="group" aria-label="DCF 筛选">
      {DCF_FILTERS.map(f => (
        <button key={f.id} type="button" aria-pressed={value === f.id} onClick={() => onChange(f.id)} className={value === f.id ? 'tool-btn tool-btn--primary' : 'tool-btn'}>
          {f.id === 'all' ? 'DCF：全部' : f.label}
        </button>
      ))}
    </span>
  )
}
