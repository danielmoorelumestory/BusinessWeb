import React, { useState } from 'react'
import { Segmented } from '../../components/ui/PageTabs'
import { Delta, GroupTag, Stat } from './parts'
import { formatPct, formatShares, formatYuan } from './format'
import type { BriefStock, IndustryRow, NtChanges, NtMeta } from './types'

type ChangeKind = 'new' | 'up' | 'down' | 'out'

export default function OverviewView({ meta, industries, changes, onStock, onIndustry }: {
  meta: NtMeta
  industries: IndustryRow[]
  changes: NtChanges | null
  onStock(code: string): void
  onIndustry(name: string): void
}): JSX.Element {
  const [kind, setKind] = useState<ChangeKind>('new')
  const maxGroup = Math.max(...meta.groups.map(g => g.mv), 1)
  const topInd = industries.slice(0, 10)
  const maxInd = Math.max(...topInd.map(i => i.mv), 1)

  const rows: { c: string; n: string; ind: string; a: string; b: React.ReactNode }[] = !changes ? [] : (
    kind === 'new' ? changes.newEntries.slice().sort((x, y) => (y.mv ?? 0) - (x.mv ?? 0)).slice(0, 12).map(s => ({
      c: s.c, n: s.n, ind: s.ind, a: formatYuan(s.mv), b: `占流通 ${formatPct(s.ratio)}`,
    }))
    : kind === 'out' ? changes.exited.slice(0, 12).map(s => ({
      c: s.c, n: s.n, ind: s.ind, a: `上期 ${formatYuan(s.mvPrev)}`, b: `占流通 ${formatPct(s.ratioPrev)}`,
    }))
    : (kind === 'up' ? changes.increased : changes.decreased).slice(0, 12).map((s: BriefStock) => ({
      c: s.c, n: s.n, ind: s.ind,
      a: `${formatShares(s.numPrev)} → ${formatShares(s.num)}`,
      b: <Delta cur={s.num ?? 0} prev={s.numPrev} label="持股数变化" />,
    }))
  )

  return (
    <div className="nt-stack">
      <section aria-label="关键数字" className="nt-stats">
        <Stat label="持仓总市值" value={formatYuan(meta.totalMv)}
          sub={meta.totalMvPrev ? <>较上期 <Delta cur={meta.totalMv} prev={meta.totalMvPrev} /></> : undefined} />
        <Stat label="持仓个股" value={`${meta.numStocks} 只`} sub={`全市场覆盖 ${meta.coverage} 只`} />
        <Stat label="本期新进" value={changes ? `${changes.newEntries.length} 只` : '—'} sub="上期十大流通股东里没有" />
        <Stat label="本期退出" value={changes ? `${changes.exited.length} 只` : '—'} sub="本期不在十大流通股东里" />
      </section>

      <section aria-labelledby="nt-groups">
        <h2 id="nt-groups" className="nt-h2">按机构 <span className="nt-muted">各机构持仓市值，同一只股被多家持有会各计一份</span></h2>
        <ul className="nt-bars">
          {meta.groups.map(g => (
            <li key={g.id}>
              <span className="nt-bars__name"><GroupTag id={g.id} core={g.core} /></span>
              <span className="nt-bars__track"><i style={{ width: `${(g.mv / maxGroup) * 100}%` }} /></span>
              <span className="nt-bars__val">{formatYuan(g.mv)}</span>
              <span className="nt-bars__aux"><Delta cur={g.mv} prev={g.mvPrev} /></span>
              <span className="nt-bars__aux nt-muted">{g.n} 只</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nt-ind">
        <h2 id="nt-ind" className="nt-h2">按行业 · 前十 <span className="nt-muted">点行业看该行业的个股</span></h2>
        <ul className="nt-bars">
          {topInd.map(i => (
            <li key={i.name}>
              <button type="button" className="nt-bars__name nt-linkish" onClick={() => onIndustry(i.name)}>{i.name}</button>
              <span className="nt-bars__track"><i style={{ width: `${(i.mv / maxInd) * 100}%` }} /></span>
              <span className="nt-bars__val">{formatYuan(i.mv)}</span>
              <span className="nt-bars__aux"><Delta cur={i.mv} prev={i.mvPrev} /></span>
              <span className="nt-bars__aux nt-muted">{i.n} 只</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nt-changes">
        <h2 id="nt-changes" className="nt-h2">本期变动 <span className="nt-muted">增减持按持股数比较，不受股价涨跌影响</span></h2>
        <Segmented<ChangeKind> label="变动类型" value={kind} onChange={setKind} items={[
          { id: 'new', label: `新进${changes ? ` ${changes.newEntries.length}` : ''}` },
          { id: 'up', label: `增持${changes ? ` ${changes.increased.length}` : ''}` },
          { id: 'down', label: `减持${changes ? ` ${changes.decreased.length}` : ''}` },
          { id: 'out', label: `退出${changes ? ` ${changes.exited.length}` : ''}` },
        ]} />
        {!changes ? <p className="nt-muted">变动数据加载中…</p> : rows.length === 0 ? <p className="nt-muted">本期没有。</p> : (
          <ul className="nt-rank">
            {rows.map(r => (
              <li key={r.c}>
                <button type="button" onClick={() => onStock(r.c)}>
                  <span className="nt-rank__name"><b>{r.n}</b> <small>{r.c}</small></span>
                  <span className="nt-muted nt-rank__ind">{r.ind}</span>
                  <span className="nt-rank__a">{r.a}</span>
                  <span className="nt-rank__b">{r.b}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

