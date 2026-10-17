import React from 'react'
import { Link } from 'react-router-dom'

export default function EtfIdentityCell({ code, name, to, children }: {
  code: string; name: string; to?: string; children?: React.ReactNode
}): JSX.Element {
  return (
    <td className="etf-identity-cell">
      <div className="etf-name-line">
        {to ? <Link to={to} className="etf-name-link" title="查看分析笔记">{name}</Link> : name}
      </div>
      <div className="etf-code-line">
        {to ? <Link to={to} className="etf-code-link" title="查看分析笔记">{code}</Link> : code}
      </div>
      {children}
    </td>
  )
}
