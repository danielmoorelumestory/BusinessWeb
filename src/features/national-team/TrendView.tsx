import React, { useMemo, useState } from 'react'
import { Segmented } from '../../components/ui/PageTabs'
import LineChart, { PALETTE, type LineSeries } from './LineChart'
import { formatYuan, shortPeriod } from './format'
import type { NtMeta, NtSeries } from './types'

type Mode = 'total' | 'group' | 'industry'

const zeroToNull = (a: number[]): (number | null)[] => a.map(v => (v ? v : null))

export default function TrendView({ series, meta }: { series: NtSeries; meta: NtMeta }): JSX.Element {
  const [mode, setMode] = useState<Mode>('total')
  const ranked = useMemo(() => Object.entries(series.industries)
    .map(([name, c]) => ({ name, latest: c.mv[c.mv.length - 1] }))
    .sort((a, b) => b.latest - a.latest), [series])
  const [picked, setPicked] = useState<string[]>(() => ranked.slice(0, 5).map(r => r.name))

  const lines: LineSeries[] = mode === 'total'
    ? [{ key: 'total', label: '国家队持仓总市值', color: 'var(--accent)', values: zeroToNull(series.total.mv) }]
    : mode === 'group'
      ? meta.groupDefs.filter(g => series.groups[g.id]?.mv.some(Boolean)).map((g, i) => ({ key: g.id, label: g.id, color: PALETTE[i % PALETTE.length], values: zeroToNull(series.groups[g.id].mv) }))
      : picked.filter(n => series.industries[n]).map((n, i) => ({ key: n, label: n, color: PALETTE[i % PALETTE.length], values: zeroToNull(series.industries[n].mv) }))

  const toggle = (name: string): void => setPicked(p => (p.includes(name) ? p.filter(x => x !== name) : [...p, name].slice(-10)))
  const stride = Math.max(1, Math.ceil(series.periods.length / 12))

  return (
    <div className="nt-stack">
      <Segmented<Mode> label="走势维度" value={mode} onChange={setMode} items={[
        { id: 'total', label: '总量' }, { id: 'group', label: '按机构' }, { id: 'industry', label: '按行业' },
      ]} />
      {mode === 'industry' && (
        <ul className="nt-chips" aria-label="选择行业，最多同时显示 10 个">
          {ranked.map(r => (
            <li key={r.name}>
              <button type="button" aria-pressed={picked.includes(r.name)} onClick={() => toggle(r.name)}>{r.name}</button>
            </li>
          ))}
        </ul>
      )}
      <LineChart key={mode + picked.join()} periods={series.periods} series={lines} format={v => formatYuan(v)}
        label={mode === 'total' ? '国家队持仓总市值走势' : mode === 'group' ? '各机构持仓市值走势' : '各行业持仓市值走势'} />
      <p className="nt-note">每期只统计<b>当期</b>实际持有的个股（点位口径），已退出的股票在当时仍计入，不会被事后低估。市值按各报告期末股价计算。</p>
      <details className="nt-data">
        <summary>查看数据表</summary>
        <div className="nt-tablewrap">
          <table className="nt-table nt-table--tight">
            <thead><tr><th scope="col">报告期</th>{lines.map(l => <th key={l.key} scope="col">{l.label}</th>)}</tr></thead>
            <tbody>
              {series.periods.map((p, i) => (i % stride === 0 || i === series.periods.length - 1) && (
                <tr key={p}><th scope="row">{p} <small className="nt-muted">{shortPeriod(p)}</small></th>{lines.map(l => <td key={l.key} className="num">{l.values[i] === null ? '—' : formatYuan(l.values[i] as number)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
