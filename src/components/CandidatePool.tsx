import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Company } from '../data/companies'
import type { SyncState } from '../features/candidates/useCandidates'
import { MAX_NOTE } from '../features/candidates/validation'
import type { CandidateItem } from '../features/candidates/validation'

const MARKET_LABEL: Record<string, string> = { us: '标普500', cn: '沪深500', hk: '港股', adr: '美股非标普', ndx: '纳指100' }
const cell: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', verticalAlign: 'top', borderBottom: '1px solid var(--border-primary)' }
const btn: React.CSSProperties = { fontFamily: 'inherit', fontSize: '12px', padding: '4px 10px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer' }

interface Props {
  items: CandidateItem[]
  companies: Company[]
  state: SyncState
  message: string
  onMove: (from: number, to: number) => void
  onRemove: (item: CandidateItem) => void
  onNote: (item: CandidateItem, note: string) => void
  onClear: () => void
  onConnect: (token: string) => boolean
  onRetry: () => void
}

function NoteEditor({ code, value, onSave }: { code: string; value: string; onSave: (text: string) => void }): JSX.Element {
  const [draft, setDraft] = useState(value)
  const discard = useRef(false)
  const commit = (): void => { if (discard.current) { discard.current = false; return }; if (draft.trim() !== value) onSave(draft) }
  return (
    <textarea aria-label={`备注 ${code}`} value={draft} rows={2} maxLength={MAX_NOTE} placeholder="写下你对这家公司的看法…"
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } else if (e.key === 'Escape') { discard.current = true; setDraft(value); e.currentTarget.blur() } }}
      style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.6, padding: '6px 8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
  )
}

export default function CandidatePool({ items, companies, state, message, onMove, onRemove, onNote, onClear, onConnect, onRetry }: Props): JSX.Element {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const [token, setToken] = useState('')
  const [tokenError, setTokenError] = useState(false)
  const byKey = new Map(companies.map(c => [`${c.market}:${c.code}`, c]))

  const exportJson = (): void => {
    const rows = items.map((i, n) => { const c = byKey.get(`${i.market}:${i.code}`); return { 序号: n + 1, 市场: MARKET_LABEL[i.market], 代码: i.code, 公司: c?.name ?? '', 备注: i.note ?? '', 评级: c?.rating ?? '', 结论: c?.headline ?? '', 加入时间: i.addedAt } })
    const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `候选池-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const drop = (to: number): void => { if (dragFrom !== null) onMove(dragFrom, to); setDragFrom(null); setOver(null) }

  const status = state === 'synced' ? '☁ 已同步到云端' : state === 'syncing' ? '☁ 同步中…' : state === 'error' ? '⚠ 云端同步失败，数据暂存本机' : '未验证身份：数据仅保存在本机'
  return (
    <section aria-label="候选池" style={{ padding: '20px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', marginBottom: '16px' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>候选池 · {items.length} 家</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 12px' }}>
        在分类数据的公司列表里点「加入候选」即可收录。可拖动 ⠿ 序号或用 ↑ ↓ / 置顶调整优先级，顺序即你的排序；备注框可直接编辑，Enter 或点击别处保存（Shift+Enter 换行，Esc 放弃修改）。仅为个人研究清单，不构成投资建议。
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', fontSize: '13px' }}>
        <span aria-live="polite" style={{ color: state === 'error' ? 'var(--system-red)' : 'var(--text-secondary)' }}>{status}</span>
        {message && <span style={{ color: 'var(--system-orange)' }}>{message}</span>}
        {state === 'error' && <button style={btn} onClick={onRetry}>重试</button>}
        <span style={{ flex: 1 }} />
        <button style={btn} disabled={!items.length} onClick={exportJson}>⬇ 导出 JSON</button>
        <button style={btn} disabled={!items.length} onClick={() => { if (window.confirm(`清空全部 ${items.length} 家候选？此操作会同步到云端。`)) onClear() }}>清空</button>
      </div>
      {state === 'no-token' && (
        <form onSubmit={e => { e.preventDefault(); setTokenError(!onConnect(token)); setToken('') }} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <input type="password" aria-label="同步 Token" autoComplete="new-password" value={token} onChange={e => setToken(e.target.value)} placeholder="输入同步 Token（同每日复盘的 PULSE_SYNC_TOKEN），仅需一次"
            style={{ flex: '1 1 260px', fontSize: '13px', padding: '8px 12px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
          <button type="submit" style={{ ...btn, background: 'var(--system-blue)', color: '#fff', border: 'none' }}>验证并同步</button>
          {tokenError && <span style={{ fontSize: '12px', color: 'var(--system-red)', alignSelf: 'center' }}>Token 至少 32 位</span>}
        </form>
      )}
      {!items.length ? <p style={{ fontSize: '13px', textAlign: 'center', color: 'var(--text-tertiary)' }}>候选池还是空的。</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ background: 'var(--bg-secondary)' }}>{['#', '公司', '我的备注', '市场', '评级', '一句话结论', '排序 / 操作'].map(h => <th key={h} scope="col" style={{ ...cell, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>{items.map((i, n) => {
              const c = byKey.get(`${i.market}:${i.code}`)
              return (
                <tr key={`${i.market}:${i.code}`} onDragOver={e => { e.preventDefault(); setOver(n) }} onDrop={() => drop(n)}
                  style={{ opacity: dragFrom === n ? 0.4 : 1, outline: over === n && dragFrom !== null && dragFrom !== n ? '2px solid var(--system-blue)' : 'none' }}>
                  <td style={{ ...cell, cursor: 'grab', whiteSpace: 'nowrap', userSelect: 'none' }} draggable title="拖动调整顺序" onDragStart={() => setDragFrom(n)} onDragEnd={() => { setDragFrom(null); setOver(null) }}>⠿ {n + 1}</td>
                  <td style={cell}>{c ? <Link to={`/research-notes/${i.market}/${encodeURIComponent(i.code)}`} style={{ color: 'var(--system-blue)', whiteSpace: 'nowrap' }}>{c.name} {c.code}</Link> : <span style={{ whiteSpace: 'nowrap' }}>{i.code}</span>}</td>
                  <td style={{ ...cell, minWidth: '220px' }}><NoteEditor key={`${i.note ?? ''}`} code={i.code} value={i.note ?? ''} onSave={text => onNote(i, text)} /></td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{MARKET_LABEL[i.market]}</td>
                  <td style={{ ...cell, minWidth: '90px' }}>{c?.rating ?? '—'}</td>
                  <td style={{ ...cell, minWidth: '220px' }}>{c?.headline ?? '公司数据加载中或已不在列表'}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <button style={btn} aria-label={`上移 ${i.code}`} disabled={n === 0} onClick={() => onMove(n, n - 1)}>↑</button>{' '}
                    <button style={btn} aria-label={`下移 ${i.code}`} disabled={n === items.length - 1} onClick={() => onMove(n, n + 1)}>↓</button>{' '}
                    <button style={btn} aria-label={`置顶 ${i.code}`} disabled={n === 0} onClick={() => onMove(n, 0)}>置顶</button>{' '}
                    <button style={btn} aria-label={`移除 ${i.code}`} onClick={() => onRemove(i)}>移除</button>
                  </td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
