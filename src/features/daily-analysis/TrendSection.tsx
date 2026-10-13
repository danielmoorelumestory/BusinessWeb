import { useEffect, useMemo, useState } from 'react'
import { Card, EmptyState, TableWrap } from '../../components/ui'
import { fetchHistory } from '../../components/pulse/chinaHistory'
import { backfillBoards, loadBoardCache, type BoardBackfill } from './backfill'
import { buildTrend, candlesToChanges, deltaOf, type IndexChanges, type TrendMetric, type TrendRow, type TrendSymbol } from './trend'
import { valueText } from './Panels'
import type { DailySnapshot } from './types'

const RANGES = [5, 10, 20] as const
const SYMBOLS: TrendSymbol[] = ['sh000001', 'sz399001', 'sz399006']
const tone = (value: number | null) => value === null || value === 0 ? '' : value > 0 ? 'daily-up' : 'daily-down'
const signed = (value: number | null, suffix = '') => value === null ? '—' : `${value > 0 ? '+' : ''}${valueText(value, suffix)}`

/** 回补近期指数日涨跌；失败时静默跳过，只显示已归档快照。 */
function useIndexBackfill(): IndexChanges {
  const [changes, setChanges] = useState<IndexChanges>({})
  useEffect(() => {
    const controller = new AbortController()
    Promise.allSettled(SYMBOLS.map(symbol => fetchHistory(symbol, 'day', controller.signal))).then(results => {
      if (controller.signal.aborted) return
      const next: IndexChanges = {}
      results.forEach((result, i) => {
        if (result.status !== 'fulfilled') return
        for (const [date, change] of Object.entries(candlesToChanges(result.value.rows))) (next[date] ??= {})[SYMBOLS[i]] = change
      })
      setChanges(next)
    })
    return () => controller.abort()
  }, [])
  return changes
}

/** 回补没有快照的交易日的连板数与最高板（财联社，历史不再变化，已请求过的日期读本机缓存）。 */
function useBoardBackfill(dates: string[]): BoardBackfill {
  const [boards, setBoards] = useState<BoardBackfill>(loadBoardCache)
  const key = dates.join(',')
  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    backfillBoards(key.split(','), loadBoardCache(), controller.signal, next => { if (!controller.signal.aborted) setBoards(next) })
    return () => controller.abort()
  }, [key])
  return boards
}

type SparkKey = { key: TrendMetric; cls: string; name?: string }

function Spark({ label, rows, keys, unit }: { label: string; rows: TrendRow[]; keys: SparkKey[]; unit: string }): JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const ordered = [...rows].reverse()
  if (keys.every(({ key }) => ordered.filter(row => row[key] !== null).length < 2)) return <></>
  const last = ordered.length - 1
  const active = Math.min(hover ?? last, last)
  const values = ordered.flatMap(row => keys.map(({ key }) => row[key])).filter((v): v is number => v !== null)
  const max = Math.max(...values, 1), w = 240, h = 64, step = ordered.length > 1 ? w / (ordered.length - 1) : 0
  const x = (i: number) => ordered.length > 1 ? i * step : w / 2
  const y = (v: number) => h - 4 - (v / max) * (h - 12)
  const lines = keys.map(({ key, cls }) => {
    const segments: string[] = []
    let open = ''
    ordered.forEach((row, i) => {
      const v = row[key]
      if (v === null) { if (open) segments.push(open); open = ''; return }
      open += `${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    if (open) segments.push(open)
    return { cls, key, path: segments.join(' '), dots: ordered.flatMap((row, i) => row[key] === null ? [] : [{ i, x: x(i), y: y(row[key]!) }]) }
  })
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width > 0 && last > 0) setHover(Math.max(0, Math.min(last, Math.round((event.clientX - box.left) / box.width * last))))
  }
  const press = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setHover(Math.max(0, active - 1)) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); setHover(Math.min(last, active + 1)) }
    else if (event.key === 'Escape') setHover(null)
  }
  const row = ordered[active], newestIndex = last - active
  return <figure className="daily-spark"><figcaption>{label}<small>{unit}</small></figcaption>
    <p className="daily-spark__readout" aria-live="polite"><time dateTime={row.date}>{row.date.slice(5)}</time>
      {keys.map(({ key, cls, name }) => {
        const delta = deltaOf(rows, newestIndex, key)
        return <span key={key} className={cls}>{name ? `${name} ` : ''}<strong>{valueText(row[key])}</strong>{delta !== null && delta !== 0 && <small className={delta > 0 ? 'daily-up' : 'daily-down'}>{delta > 0 ? '▲' : '▼'}{valueText(Math.abs(delta))}</small>}</span>
      })}</p>
    <div className="daily-spark__plot" tabIndex={0} role="group" aria-label={`${label}趋势，左右方向键查看每个交易日`}
      onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)} onKeyDown={press}>
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true" preserveAspectRatio="none">
        <line className="daily-spark__guide" x1={x(active)} x2={x(active)} y1="0" y2={h} />
        {lines.map(line => <g key={line.key} className={line.cls}><path d={line.path} fill="none" />{line.dots.map(dot => <circle key={dot.i} cx={dot.x} cy={dot.y} r={dot.i === active ? 4 : 2.5} />)}</g>)}
      </svg>
    </div></figure>
}

/** 收起时只显示前五里上涨/下跌只数；点击展开看每只股票的涨跌幅与成交额/换手率。 */
function RankCell({ picks, unit, label }: { picks: TrendRow['amountTop']; unit: string; label: string }): JSX.Element {
  const [open, setOpen] = useState(false)
  if (!picks.length) return <td className="daily-trend__ranks">—</td>
  const up = picks.filter(stock => stock.change > 0).length, down = picks.filter(stock => stock.change < 0).length, flat = picks.length - up - down
  return <td className="daily-trend__ranks">
    <button type="button" className="daily-trend__rank-toggle" aria-expanded={open} aria-label={`${label}明细`} onClick={() => setOpen(value => !value)}>
      <span className="daily-up">{up}涨</span>{flat > 0 && <span>{flat}平</span>}<span className="daily-down">{down}跌</span><span aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
    {open && <ol>{picks.map(stock => <li key={stock.code} title={stock.code}>
      <span>{stock.name}</span><span className={tone(stock.change)}>{signed(stock.change, '%')}</span><small>{valueText(stock.value, unit)}</small>
    </li>)}</ol>}
  </td>
}

function Delta({ rows, index, k }: { rows: TrendRow[]; index: number; k: TrendMetric }): JSX.Element | null {
  const d = deltaOf(rows, index, k)
  return d === null || d === 0 ? null : <small className={d > 0 ? 'daily-up' : 'daily-down'}>{d > 0 ? '▲' : '▼'}{valueText(Math.abs(d))}</small>
}

export function TrendSection({ snapshots, selected, onSelect }: { snapshots: DailySnapshot[]; selected: string; onSelect: (date: string) => void }): JSX.Element {
  const [days, setDays] = useState<(typeof RANGES)[number]>(10)
  const backfill = useIndexBackfill()
  const archivedDates = useMemo(() => new Set(snapshots.map(snapshot => snapshot.dataDate)), [snapshots])
  const missing = useMemo(() => buildTrend(snapshots, backfill, days).filter(row => !archivedDates.has(row.date)).map(row => row.date), [snapshots, backfill, days, archivedDates])
  const boards = useBoardBackfill(missing)
  const rows = useMemo(() => buildTrend(snapshots, backfill, days, boards), [snapshots, backfill, days, boards])
  const enough = (key: TrendMetric) => rows.filter(row => row[key] !== null).length >= 2
  const cell = (row: TrendRow, i: number, k: TrendMetric, suffix = '') => <td>{valueText(row[k], suffix)}<Delta rows={rows} index={i} k={k} /></td>
  return <Card as="section" title="多日对比" description="每个交易日一行，▲▼ 为较前一交易日的变化。历史日期由东方财富股池按日期回补（已用财联社交叉核验），之后每天收盘自动归档。量能暂无可靠历史来源，显示 —；标「回补」的日期只有指数涨跌与连板数、最高板。">
    <div className="daily-trend__toolbar" role="group" aria-label="对比天数">{RANGES.map(range => <button key={range} type="button" aria-pressed={days === range} onClick={() => setDays(range)}>近 {range} 日</button>)}</div>
    {enough('maxBoard') || enough('ztCount')
      ? <div className="daily-sparks">
        <Spark label="沪深成交额" unit="亿元" rows={rows} keys={[{ key: 'volume', cls: 'daily-line--accent' }]} />
        <Spark label="涨停 / 跌停" unit="只" rows={rows} keys={[{ key: 'ztCount', cls: 'daily-line--up', name: '涨停' }, { key: 'dtCount', cls: 'daily-line--down', name: '跌停' }]} />
        <Spark label="封板率" unit="%" rows={rows} keys={[{ key: 'ztSealRate', cls: 'daily-line--accent' }]} />
        <Spark label="连板数" unit="只" rows={rows} keys={[{ key: 'lbCount', cls: 'daily-line--accent' }]} />
        <Spark label="最高连板" unit="板" rows={rows} keys={[{ key: 'maxBoard', cls: 'daily-line--up' }]} />
      </div>
      : <EmptyState title={`已归档 ${snapshots.length} 天`}>满 2 个交易日的归档后显示涨停、量能等趋势；每个交易日收盘后会自动新增一天。</EmptyState>}
    <TableWrap label="多日对比"><table className="ui-table daily-table daily-trend"><thead><tr>
      <th scope="col">交易日</th><th scope="col">涨停</th><th scope="col">封板率</th><th scope="col">炸板</th><th scope="col">跌停</th><th scope="col">量能(亿)</th>
      <th scope="col">连板</th><th scope="col">最高板</th><th scope="col">晋级率</th><th scope="col">上证</th><th scope="col">深成</th><th scope="col">创业板</th><th scope="col">成交额前五</th><th scope="col">换手率前五</th><th scope="col">流入</th><th scope="col">流出</th>
    </tr></thead><tbody>{rows.map((row, i) => <tr key={row.date} className={selected === row.date ? 'is-selected' : ''}>
      <th scope="row">{row.backfilled ? <>{row.date}<small>回补</small></> : <button type="button" className="daily-trend__date" aria-label={`查看 ${row.date} 复盘`} onClick={() => onSelect(row.date)}>{row.date}</button>}</th>
      {cell(row, i, 'ztCount')}{cell(row, i, 'ztSealRate', '%')}{cell(row, i, 'ztOpen')}{cell(row, i, 'dtCount')}{cell(row, i, 'volume')}
      {cell(row, i, 'lbCount')}{cell(row, i, 'maxBoard')}{cell(row, i, 'lbRate', '%')}
      {(['sh', 'sz', 'cy'] as const).map(k => <td key={k} className={tone(row.index[k])}>{signed(row.index[k], '%')}</td>)}
      <RankCell picks={row.amountTop} unit="亿" label="成交额前五" /><RankCell picks={row.turnoverTop} unit="%" label="换手率前五" />
      <td className="daily-trend__names">{row.inflow.join('、') || '—'}</td><td className="daily-trend__names">{row.outflow.join('、') || '—'}</td>
    </tr>)}</tbody></table></TableWrap>
  </Card>
}
