import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import FpeChart from './FpeChart'
import LongHistoryChart from './LongHistoryChart'
import { ToneBadge } from './MacroViews'
import { estimateFpe, mergeLive, pctTone, statsOf, type IndexData, type IndexSnapshot, type Member } from './valuation'
import './macro.css'

const GROUPS = ['美股', '港股', 'A 股']
const num = (v: number, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const pe = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}x`)
const signed = (v: number | undefined, d = 1) => (v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`)

/** 成分股表：按市值排序，相对指数 Forward PE 高低一眼可见 */
function Members({ members, indexFwd }: { members: Member[]; indexFwd: number }): JSX.Element {
  const total = members.reduce((a, m) => a + m.mcap, 0)
  return (
    <div className="macro-table-wrap">
      <table className="macro-table macro-val">
        <thead><tr><th>成分股</th><th>市值（十亿美元）</th><th>占比</th><th>Forward PE</th><th>相对指数</th><th>滚动 PE</th></tr></thead>
        <tbody>
          {members.map(m => {
            const rel = m.fwd && m.fwd > 0 ? m.fwd / indexFwd - 1 : undefined
            return (
              <tr key={m.code}>
                <td><b>{m.code}</b> <span className="macro-muted">{m.name}</span></td>
                <td className="macro-val__n">{num(m.mcap, 0)}</td>
                <td className="macro-val__n">{((m.mcap / total) * 100).toFixed(1)}%</td>
                <td className="macro-val__n">{m.fwd && m.fwd > 0 ? pe(m.fwd) : '亏损/无预期'}</td>
                <td className="macro-val__n">{rel === undefined ? '—' : signed(rel * 100, 0)}</td>
                <td className="macro-val__n">{m.ttm && m.ttm > 0 ? pe(m.ttm) : '亏损'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Row({ id, ix, open, onToggle }: { id: string; ix: IndexData; open: boolean; onToggle: () => void }): JSX.Element {
  const est = useMemo(() => (ix.ref && !ix.ref.proxy && ix.ref.points.length <= 24 ? estimateFpe(ix.daily ?? ix.monthly, ix.ref.points) : undefined), [ix])
  const s = statsOf(ix, est)
  const detail = useRef<HTMLTableRowElement>(null)
  // 展开后把内容滚到可视区：点最下面的行时，展开的图表不会掉在屏幕外
  useEffect(() => { if (open) detail.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) }, [open])
  const f = s.fpe
  return (
    <>
      <tr className={`macro-val__row${open ? ' is-open' : ''}`} onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td>
          <button type="button" className="macro-val__name" aria-expanded={open} aria-controls={`val-${id}`} onClick={e => { e.stopPropagation(); onToggle() }}><ChevronRight size={16} className={`macro-val__chev${open ? ' is-open' : ''}`} aria-hidden="true" />{ix.name}</button>
          <div className="macro-muted">{ix.symbol}</div>
        </td>
        <td className="macro-val__n">{num(ix.latest.value, ix.latest.value < 1000 ? 2 : 0)}</td>
        <td className="macro-val__n">{signed(s.drawdown)}</td>
        <td className="macro-val__n">{signed(s.ret1y)}</td>
        <td className="macro-val__n">{s.pricePct === undefined ? '—' : <ToneBadge tone="gray" label={`${s.pricePct}%`} />}</td>
        <td className="macro-val__n">{f ? f.value.toFixed(1) : '—'}{f && <div className="macro-muted">{f.date.slice(0, 7)}</div>}</td>
        <td className="macro-val__n">{ix.agg ? pe(ix.agg.ttm) : '—'}</td>
        <td className="macro-val__n">{f ? (f.pct === undefined ? <span className="macro-muted">仅 {f.count} 个月</span> : <ToneBadge tone={pctTone(f.pct)} label={`${f.pct}%`} />) : '—'}</td>
        <td className="macro-val__n">{f ? `${f.min.toFixed(1)} – ${f.max.toFixed(1)}` : '—'}{f && <div className="macro-muted">中位 {f.median.toFixed(1)}</div>}</td>
      </tr>
      {open && (
        <tr id={`val-${id}`} ref={detail}>
          <td colSpan={9} className="macro-val__detail">
            {ix.note && <p className="macro-muted">{ix.note}</p>}
            {ix.links && ix.links.length > 0 && <p className="macro-muted">外部查看：{ix.links.map((l, i) => <React.Fragment key={l.url}>{i > 0 && ' · '}<a href={l.url} target="_blank" rel="noreferrer noopener">{l.label}</a></React.Fragment>)}</p>}
            {(ix.ref || ix.fpe.length > 0) && <h4>{ix.ref?.kind === 'trailing' ? '滚动 PE（TTM）走势' : 'Forward PE 走势'}</h4>}
            {(ix.ref || ix.fpe.length > 0) && <FpeChart own={ix.fpe} refPoints={ix.ref?.points} est={est} refSource={ix.ref?.source} label={`${ix.name} ${ix.ref?.kind === 'trailing' ? '滚动 PE' : 'Forward PE'}`} />}
            {ix.agg && ix.members && (
              <>
                <h4>成分股 PE</h4>
                <p className="macro-muted">
                  指数 Forward PE {ix.agg.fwd.toFixed(1)}x 是 {ix.agg.fwdCount} 只成分股按市值加权的调和平均（相当于总市值 ÷ 总预期盈利，覆盖市值 {(ix.agg.fwdCovered * 100).toFixed(0)}%）；
                  成分股中位数 {pe(ix.agg.medianFwd)}。中位数远高于加权值，说明估值被少数大市值低 PE 公司拉低，多数公司并不便宜。
                </p>
                <Members members={ix.members} indexFwd={ix.agg.fwd} />
              </>
            )}
            <h4>价格走势（月收盘）</h4>
            <LongHistoryChart points={ix.monthly} digits={0} label={`${ix.name}价格`} />
            <p className="macro-muted">历史最高月收盘 {num(s.peak.value)}（{s.peak.date.slice(0, 7)}）。</p>
          </td>
        </tr>
      )}
    </>
  )
}

// 本地开发由 Vite 中间件在本机拉取；Vercel 走同源函数；GitHub Pages 通过 VITE_API_BASE 调 Vercel
const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const timeText = (iso: string) => new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export function ValuationView({ data: initial, onData }: { data: IndexSnapshot; onData?: (d: IndexSnapshot) => void }): JSX.Element {
  const [open, setOpen] = useState<string | null>(null)
  const [data, setData] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const refresh = async (): Promise<void> => {
    setBusy(true); setNotice('')
    try {
      const res = await fetch(`${apiBase}/api/indexes`, { cache: 'no-store' })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.indexes) throw new Error(body?.error || '数据源暂时不可用')
      const merged = mergeLive(data, body as IndexSnapshot)
      setData(merged); onData?.(merged)
      const miss = (body.warnings as string[] | undefined)?.length ?? 0
      setNotice(`已刷新：实时数据拉取于 ${timeText(body.fetchedAt)}${miss ? `；${miss} 项没拉到，沿用旧数据` : ''}`)
    } catch (e) {
      setNotice(`刷新失败：${e instanceof Error ? e.message : '数据源暂时不可用'}，仍显示快照数据`)
    } finally { setBusy(false) }
  }
  const entries = Object.entries(data.indexes)
  return (
    <div className="macro-stack">
      <section className="macro-card macro-card--note" role="note">
        <h3>怎么读这一页</h3>
        <p>一张表看各大指数<b>现在站在历史的什么位置</b>：离最高点多远、价格在近十年里的分位、Forward PE 在自己历史里的分位。分位高说明相对自己的过去偏贵，<b>不是卖出信号</b>——高估值可以持续很久，它只用来调整长期回报预期和仓位预算。点指数名展开长历史图。</p>
      </section>
      <div className="page-toolbar">
        <span className="page-toolbar__note" role="status">{notice || `快照更新于 ${data.generatedAt}，可刷新获取实时价格与成分股 PE`}</span>
        <button type="button" className="tool-btn tool-btn--primary" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} aria-hidden="true" />{busy ? '正在拉取…' : '刷新最新数据'}
        </button>
      </div>
      <h2 className="macro-h2">价格位置</h2>
      {GROUPS.map(g => {
        const rows = entries.filter(([, ix]) => ix.group === g)
        if (!rows.length) return null
        return (
          <section key={g} aria-label={`${g}指数`}>
            <h3 className="macro-h3">{g}</h3>
            <div className="macro-table-wrap">
              <table className="macro-table macro-val">
                <thead><tr><th>指数</th><th>现价</th><th>距历史高点</th><th>近 1 年</th><th>价格 10 年分位</th><th>Forward PE</th><th>滚动 PE</th><th>PE 历史分位</th><th>PE 区间</th></tr></thead>
                <tbody>{rows.map(([id, ix]) => <Row key={id} id={id} ix={ix} open={open === id} onToggle={() => setOpen(open === id ? null : id)} />)}</tbody>
              </table>
            </div>
          </section>
        )
      })}
      <section className="macro-card">
        <h3>数据说明与录入</h3>
        <ul>
          <li>价格：{data.source.split('；')[0]}，月收盘，更新于 {data.generatedAt}；GitHub Action 每月 8 日随宏观数据一起更新。</li>
          <li>NDX、SOX 的 PE：没有免费的指数 PE 接口，所以逐只取成分股的 Forward PE（未来 12 个月预期）和市值，按市值加权汇总。成分股名单是近似的，未与官方名单核对，权重也不是指数的实际权重，读数与官方或 FactSet 口径会有出入，适合和自己的历史比。历史从第一次更新起每月记一个点，满 24 个月才显示分位。</li>
          <li>标普 500、NDX、SOX 的历史线：来自 <a href="https://historyofmarket.com/" target="_blank" rel="noreferrer">History of Market</a>（CC BY 4.0）的 12 个月一致预期 Forward PE 周度序列。标普 500 取 1990 年起的全部读数；NDX、SOX 取 2011 年起（SOX 在 2011 年前盈利接近零或为负，PE 失真，所以不取，且剔除超过 50 倍的值；NDX 2001 年有互联网泡沫的极端值，也不取）。该来源更新有滞后，最后一个读数可能早于今天。</li>
          <li>恒生、上证只有 Siblis Research 免费版的 8 个半年快照（2023-12 至 2026-06），再用每日价格估算成逐日线，图上标明是估算。想要 2008 年起的完整历史，请导出 CSV 后用 npm run index:ref-import 导入。</li>
          <li>其他指数没有成分股名单，Forward PE 可手动录入：<code>npm run index:fpe -- spx 22.5 2026-09</code>（指数代号：{Object.keys(data.indexes).join('、')}），来源自己定，同一指数固定一个来源。</li>
          <li>批量补录历史：准备 CSV（表头 <code>month,ndx,sox</code>，每行一个月，如 <code>2024-06,26.1,24.3</code>），运行 <code>npm run index:fpe-import -- 文件.csv</code>。</li>
          <li>局限：指数月线不含分红；分位只和自己的历史比，样本里的利率环境各不相同；不同来源的 Forward PE 口径（盈利预期的算法）不能混用。</li>
        </ul>
      </section>
    </div>
  )
}
