import React, { useMemo, useState } from 'react'
import { Delta } from './parts'
import { MiniSpark } from './LineChart'
import { changeRate, formatPct, formatYuan } from './format'
import type { IndustryRow, NtSeries } from './types'

type SortKey = 'mv' | 'chg' | 'n' | 'ratio'

export default function IndustriesView({ industries, series, onIndustry }: {
  industries: IndustryRow[]
  series: NtSeries | null
  onIndustry(name: string): void
}): JSX.Element {
  const [sort, setSort] = useState<SortKey>('mv')
  const rows = useMemo(() => {
    const val = (i: IndustryRow): number => sort === 'mv' ? i.mv : sort === 'n' ? i.n : sort === 'ratio' ? i.ratio : (changeRate(i.mv, i.mvPrev) ?? -Infinity)
    return industries.slice().sort((a, b) => val(b) - val(a))
  }, [industries, sort])
  const th = (key: SortKey, text: string): JSX.Element => (
    <th scope="col" aria-sort={sort === key ? 'descending' : 'none'}>
      <button type="button" className="nt-sortbtn" onClick={() => setSort(key)}>{text}{sort === key ? ' ↓' : ''}</button>
    </th>
  )
  return (
    <div className="nt-stack">
      <p className="nt-note">行业按东方财富的<b>当前</b>行业分类归属，历史各期也用同一分类，所以行业走势反映的是「这些公司」而不是「当时的行业划分」。</p>
      <div className="nt-tablewrap">
        <table className="nt-table">
          <thead>
            <tr>
              <th scope="col">行业</th>
              {th('n', '个股数')}
              {th('mv', '持仓市值')}
              {th('chg', '较上期')}
              {th('ratio', '平均占流通')}
              <th scope="col">走势</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(i => (
              <tr key={i.name}>
                <th scope="row"><button type="button" className="nt-linkish" onClick={() => onIndustry(i.name)}>{i.name}</button></th>
                <td className="num">{i.n}{i.newN ? <small className="nt-muted"> +{i.newN}新</small> : null}</td>
                <td className="num">{formatYuan(i.mv)}</td>
                <td className="num"><Delta cur={i.mv} prev={i.mvPrev} /></td>
                <td className="num">{formatPct(i.ratio)}</td>
                <td>{series?.industries[i.name] ? <MiniSpark values={series.industries[i.name].mv} label={`${i.name}持仓市值走势`} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
