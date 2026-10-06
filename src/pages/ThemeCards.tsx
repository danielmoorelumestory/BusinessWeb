import React, { useEffect, useState } from 'react'
import { FIELDS, SUGGESTED, ThemeCard, capTotal, cardWarnings, emptyCard, filledCount } from '../features/themeCard/themeCard'

const STORE_KEY = 'theme-cards-v1'

function load(): ThemeCard[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const data = raw ? JSON.parse(raw) : null
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

const box: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: 20, marginBottom: 16 }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--system-gray4)', fontSize: '0.9rem', fontFamily: 'inherit' }

export default function ThemeCards(): JSX.Element {
  const [cards, setCards] = useState<ThemeCard[]>(load)
  const [name, setName] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const today = new Date()

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cards)) } catch { /* 无痕模式等：只在本次页面有效 */ }
  }, [cards])

  const patch = (id: string, f: (c: ThemeCard) => ThemeCard) => setCards(cs => cs.map(c => (c.id === id ? f(c) : c)))
  const add = (n: string) => {
    const t = n.trim()
    if (!t || cards.some(c => c.name === t)) return
    const id = `${Date.now()}-${cards.length}`
    setCards(cs => [...cs, emptyCard(id, t)])
    setOpenId(id)
    setName('')
  }
  const total = capTotal(cards)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 32px' }}>
      <p role="note" style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.7 }}>
        对应书第31章 31.12 的「一页纸未来产业研究卡」。这里不预设任何产业判断，每一项由你自己填，并写明依据和日期；内容只保存在这台设备的浏览器里。主题只放主动额度（第9章），每年复核一次（31.13）。不构成投资建议。
      </p>

      <div style={box}>
        <form onSubmit={e => { e.preventDefault(); add(name) }} style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="新建一张主题卡，例如：固态电池" aria-label="主题名称" style={input} />
          <button type="submit" className="seg__btn is-active" style={{ whiteSpace: 'nowrap' }}>新建</button>
        </form>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--system-gray)' }}>书里的观察方向：</span>
          {SUGGESTED.filter(s => !cards.some(c => c.name === s)).map(s => (
            <button key={s} type="button" className="seg__btn" onClick={() => add(s)}>{s}</button>
          ))}
        </div>
        {cards.length > 0 && (
          <p style={{ margin: '12px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            共 {cards.length} 张，已设仓位上限合计 {total}%。上限是占总资产的百分比，合计不应超过你的主动额度。
          </p>
        )}
      </div>

      {cards.length === 0 && <p style={{ color: 'var(--system-gray)' }}>还没有主题卡。从上面选一个方向，或自己输入。</p>}

      {cards.map(card => {
        const warns = cardWarnings(card, today)
        const open = openId === card.id
        return (
          <section key={card.id} style={box} aria-label={card.name}>
            <div onClick={() => setOpenId(open ? null : card.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
              <strong style={{ fontSize: '1.05rem' }}>{open ? '▾' : '▸'} {card.name}</strong>
              <span style={{ fontSize: '0.85rem', color: warns.length ? 'var(--system-red, #c0392b)' : 'var(--system-gray)' }}>
                已填 {filledCount(card)}/{FIELDS.length}{warns.length ? ` · ${warns.length} 条提醒` : ''}
              </span>
            </div>
            {warns.length > 0 && (
              <ul style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: '0.85rem', color: 'var(--system-red, #c0392b)', lineHeight: 1.7 }}>
                {warns.map(w => <li key={w}>{w}</li>)}
              </ul>
            )}
            {open && (
              <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ flex: 1, minWidth: 160, fontSize: '0.85rem' }}>仓位上限（% 总资产）
                    <input inputMode="decimal" value={card.cap} onChange={e => patch(card.id, c => ({ ...c, cap: e.target.value }))} style={{ ...input, marginTop: 4 }} />
                  </label>
                  <label style={{ flex: 1, minWidth: 160, fontSize: '0.85rem' }}>上次复核日期
                    <input type="date" value={card.reviewed} onChange={e => patch(card.id, c => ({ ...c, reviewed: e.target.value }))} style={{ ...input, marginTop: 4 }} />
                  </label>
                </div>
                {FIELDS.map(f => (
                  <label key={f.key} style={{ fontSize: '0.85rem' }}>
                    <strong>{f.label}</strong>
                    <span style={{ display: 'block', color: 'var(--text-secondary)', margin: '2px 0 4px' }}>{f.hint}</span>
                    <textarea rows={2} value={card.values[f.key] || ''} onChange={e => patch(card.id, c => ({ ...c, values: { ...c.values, [f.key]: e.target.value } }))} style={{ ...input, resize: 'vertical' }} />
                  </label>
                ))}
                <div>
                  <button type="button" className="seg__btn" onClick={() => { if (window.confirm(`删除「${card.name}」？删除后无法恢复。`)) setCards(cs => cs.filter(c => c.id !== card.id)) }}>删除这张卡</button>
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
