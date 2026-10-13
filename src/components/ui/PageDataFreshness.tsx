import React from 'react'

interface PageDataFreshnessProps {
  checkedAt?: string | null
  dataLabel?: string
  dataDates?: Array<string | null | undefined>
  researchAsOf?: string | null
  note?: string
}

const dateText = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined
  const match = value.match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0]
}

export function PageDataFreshness({ checkedAt, dataLabel = '数据日期', dataDates = [], researchAsOf, note }: PageDataFreshnessProps): JSX.Element | null {
  const checked = dateText(checkedAt)
  const dates = [...new Set(dataDates.map(dateText).filter((date): date is string => !!date))].sort()
  const research = dateText(researchAsOf)
  if (!checked && !dates.length && !research && !note) return null
  return <div className="page-data-freshness" role="note" aria-label="数据更新时间">
    {checked && <span><strong>核验日期</strong> {checked}</span>}
    {!!dates.length && <span><strong>{dataLabel}</strong> {dates.join('、')}</span>}
    {research && <span><strong>原研究日期</strong> {research}</span>}
    {note && <span className="page-data-freshness__note">{note}</span>}
  </div>
}
