import React, { useEffect, useMemo, useState } from 'react'
import { Delta, GroupTag } from './parts'
import LineChart from './LineChart'
import { useNt } from './data'
import { changeRate, formatPct, formatShares, formatYuan } from './format'
import type { NtHistory, NtMeta, NtTop10, StockRow } from './types'

type SortKey = 'mv' | 'ratio' | 'chg' | 'shares'
const PAGE = 50

export interface StockFilters {
  q: string
  group: string
  industry: string
  onlyNew: boolean
}

function StockDetail({ stock, meta }: { stock: StockRow; meta: NtMeta }): JSX.Element {
  const top10 = useNt<NtTop10>('top10.json')
  const hist = useNt<NtHistory>('history.json')
  const h = hist.data?.[stock.c]
  const list = top10.data?.[stock.c]
  return (
    <div className="nt-detail">
      <div>
        <h4>国家队持有人 · {meta.reportDate}</h4>
        <table className="nt-table nt-table--tight">
          <thead><tr><th scope="col">机构</th><th scope="col">持有人</th><th scope="col">持股</th><th scope="col">占流通</th><th scope="col">市值</th></tr></thead>
          <tbody>
            {stock.holders.map(x => (
              <tr key={x.h}>
                <td><GroupTag id={x.g} /></td><td className="nt-wrap">{x.h}</td>
                <td className="num">{formatShares(x.num)}</td><td className="num">{formatPct(x.ratio)}</td><td className="num">{formatYuan(x.mv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h4>完整十大流通股东</h4>
        {top10.error ? <p className="nt-muted">加载失败，请刷新重试。</p> : !list ? <p className="nt-muted">加载中…</p> : (
          <ol className="nt-top10">
            {list.map(x => (
              <li key={x.rank} className={x.group ? 'is-nt' : ''}>
                <span className="nt-wrap">{x.holder}</span>
                <span className="num">{formatPct(x.ratio)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="nt-detail__chart">
        <h4>历史持仓市值</h4>
        {hist.error ? <p className="nt-muted">加载失败，请刷新重试。</p> : !h ? <p className="nt-muted">加载中…</p> : (
          <LineChart periods={meta.periods} format={v => formatYuan(v)} label={`${stock.n}国家队持仓市值历史`}
            series={[{ key: 'mv', label: '持仓市值', color: 'var(--accent)', values: h.mv.map(v => (v ? v : null)) }]} />
        )}
      </div>
    </div>
  )
}

export default function StocksView({ stocks, meta, filters, onFilters }: {
  stocks: StockRow[]
  meta: NtMeta
  filters: StockFilters
  onFilters(patch: Partial<StockFilters>): void
}): JSX.Element {
  const [sort, setSort] = useState<SortKey>('mv')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<string | null>(null)
  const industries = useMemo(() => [...new Set(stocks.map(s => s.ind))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [stocks])

  const rows = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    const val = (s: StockRow): number => sort === 'mv' ? s.mv : sort === 'ratio' ? s.ratio : sort === 'shares' ? s.num : (changeRate(s.num, s.numPrev) ?? -Infinity)
    return stocks
      .filter(s => (!q || s.c.includes(q) || s.n.toLowerCase().includes(q))
        && (!filters.group || s.groups.includes(filters.group))
        && (!filters.industry || s.ind === filters.industry)
        && (!filters.onlyNew || s.isNew))
      .sort((a, b) => val(b) - val(a))
  }, [stocks, filters, sort])

  useEffect(() => { setLimit(PAGE) }, [filters, sort])
  // 精确搜到一只时自动展开，从总览的榜单跳过来就直接看到详情
  useEffect(() => {
    if (rows.length === 1 && filters.q.trim() === rows[0].c) setOpen(rows[0].c)
  }, [rows, filters.q])

  const th = (key: SortKey, text: string): JSX.Element => (
    <th scope="col" aria-sort={sort === key ? 'descending' : 'none'}>
      <button type="button" className="nt-sortbtn" onClick={() => setSort(key)}>{text}{sort === key ? ' ↓' : ''}</button>
    </th>
  )

  return (
    <div className="nt-stack">
      <div className="nt-filters" role="search">
        <label>搜索<input type="search" placeholder="代码或名称" value={filters.q} onChange={e => onFilters({ q: e.target.value })} /></label>
        <label>机构
          <select value={filters.group} onChange={e => onFilters({ group: e.target.value })}>
            <option value="">全部</option>
            {meta.groups.map(g => <option key={g.id} value={g.id}>{g.id}{g.core ? '' : '（扩展）'}</option>)}
          </select>
        </label>
        <label>行业
          <select value={filters.industry} onChange={e => onFilters({ industry: e.target.value })}>
            <option value="">全部</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
        <label className="nt-check"><input type="checkbox" checked={filters.onlyNew} onChange={e => onFilters({ onlyNew: e.target.checked })} />仅看本期新进</label>
        <span className="nt-muted nt-filters__count" aria-live="polite">{rows.length} / {stocks.length} 只</span>
      </div>

      <div className="nt-tablewrap">
        <table className="nt-table nt-table--stocks">
          <thead>
            <tr>
              <th scope="col">个股</th>
              <th scope="col">行业</th>
              <th scope="col">机构</th>
              {th('mv', '持仓市值')}
              {th('ratio', '占流通')}
              {th('chg', '持股较上期')}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map(s => {
              const expanded = open === s.c
              return (
                <React.Fragment key={s.c}>
                  <tr className={expanded ? 'is-open' : ''}>
                    <th scope="row">
                      <button type="button" className="nt-linkish" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : s.c)}>
                        <b>{s.n}</b> <small>{s.c}</small>
                      </button>
                      {s.isNew && <span className="nt-tag nt-tag--new">新进</span>}
                    </th>
                    <td>{s.ind}</td>
                    <td>{s.groups.map(g => <GroupTag key={g} id={g} />)}</td>
                    <td className="num">{formatYuan(s.mv)}</td>
                    <td className="num">{formatPct(s.ratio)}</td>
                    <td className="num">{s.numPrev ? <Delta cur={s.num} prev={s.numPrev} label={`${formatShares(s.numPrev)} → ${formatShares(s.num)}`} /> : '—'}</td>
                  </tr>
                  {expanded && <tr className="nt-detailrow"><td colSpan={6}><StockDetail stock={s} meta={meta} /></td></tr>}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="nt-muted">没有符合条件的个股。</p>}
      {rows.length > limit && (
        <button type="button" className="nt-more" onClick={() => setLimit(l => l + PAGE)}>再显示 {Math.min(PAGE, rows.length - limit)} 只（还剩 {rows.length - limit}）</button>
      )}
    </div>
  )
}
