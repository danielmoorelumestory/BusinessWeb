import React, { useEffect, useState } from 'react'

type Comment = { id: string; nickname: string; content: string; created_at: string; status?: string }
const TOKEN_KEY = 'comments-admin-token'
const STATUS_LABEL: Record<string, string> = { pending: '待审核', approved: '已显示', rejected: '已驳回' }

function storedToken(): string {
  try { return sessionStorage.getItem(TOKEN_KEY) ?? '' } catch { return '' }
}
function saveToken(value: string): void {
  try { value ? sessionStorage.setItem(TOKEN_KEY, value) : sessionStorage.removeItem(TOKEN_KEY) } catch { /* 隐私模式下忽略 */ }
}
type Notice = { kind: 'ok' | 'error'; text: string }

const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid var(--border, #d9d9d9)', background: 'transparent', color: 'inherit', font: 'inherit',
}

const linkButton: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit' }

/** 章节评论：匿名提交，经审核后显示。后端为 /api/comments。 */
export default function ChapterComments({ slug }: { slug: string }): JSX.Element {
  const [comments, setComments] = useState<Comment[]>([])
  const [disabled, setDisabled] = useState(false)
  const [nickname, setNickname] = useState('')
  const [content, setContent] = useState('')
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [token, setToken] = useState(storedToken)
  const [tokenInput, setTokenInput] = useState('')
  const [loginOpen, setLoginOpen] = useState(false)
  const [reload, setReload] = useState(0)
  const admin = token !== ''
  const authHeader = { authorization: `Bearer ${token}` }

  function logout(text?: string) {
    saveToken('')
    setToken('')
    if (text) setNotice({ kind: 'error', text })
  }

  useEffect(() => {
    let alive = true
    setComments([])
    setDisabled(false)
    fetch(`/api/comments?slug=${encodeURIComponent(slug)}`, admin ? { headers: authHeader } : undefined)
      .then(async r => {
        if (r.status === 401 && alive) return logout('管理员 token 无效，已退出管理')
        if (r.status === 503) return alive && (admin ? logout('管理员 token 尚未在服务端配置') : setDisabled(true))
        if (!r.ok) return
        const data: unknown = await r.json()
        const list = (data as { comments?: unknown })?.comments
        if (alive && Array.isArray(list)) setComments(list as Comment[])
      })
      .catch(() => undefined)
    return () => { alive = false }
  }, [slug, token, reload]) // eslint-disable-line react-hooks/exhaustive-deps

  if (disabled) return <></>

  async function moderate(id: string, action: 'approve' | 'reject' | 'delete') {
    setNotice(null)
    try {
      const r = action === 'delete'
        ? await fetch(`/api/comments?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeader })
        : await fetch('/api/comments', {
          method: 'PATCH', headers: { ...authHeader, 'content-type': 'application/json' },
          body: JSON.stringify({ id, status: action === 'approve' ? 'approved' : 'rejected' }),
        })
      if (r.status === 401) return logout('管理员 token 无效，已退出管理')
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string }
        return setNotice({ kind: 'error', text: data.error ?? '操作失败，请稍后重试' })
      }
      setReload(n => n + 1)
    } catch {
      setNotice({ kind: 'error', text: '网络异常，请稍后重试' })
    }
  }

  function login(event: React.FormEvent) {
    event.preventDefault()
    const value = tokenInput.trim()
    if (!value) return
    saveToken(value)
    setToken(value)
    setTokenInput('')
    setLoginOpen(false)
    setNotice(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setNotice(null)
    try {
      const r = await fetch('/api/comments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, nickname, content, website }),
      })
      const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string }
      if (r.ok) {
        setContent('')
        setNotice({ kind: 'ok', text: data.message ?? '已提交，审核通过后显示' })
      } else {
        setNotice({ kind: 'error', text: data.error ?? '提交失败，请稍后重试' })
      }
    } catch {
      setNotice({ kind: 'error', text: '网络异常，请稍后重试' })
    } finally {
      setSending(false)
    }
  }

  return (
    <section aria-label="读者评论" className="book-comments" style={{ marginBottom: '28px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem' }}>读者评论{comments.length > 0 && `（${comments.length}）`}</h3>
      {comments.length === 0 && <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>还没有评论，欢迎留下你的想法。</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'grid', gap: '12px' }}>
        {comments.map(c => (
          <li key={c.id} style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border, #e5e5e5)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {c.nickname} · {new Date(c.created_at).toLocaleDateString('zh-CN')}
              {admin && c.status && ` · ${STATUS_LABEL[c.status] ?? c.status}`}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</div>
            {admin && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {c.status !== 'approved' && <button type="button" onClick={() => moderate(c.id, 'approve')} style={linkButton}>通过</button>}
                {c.status !== 'rejected' && <button type="button" onClick={() => moderate(c.id, 'reject')} style={linkButton}>驳回</button>}
                <button type="button" onClick={() => moderate(c.id, 'delete')} style={{ ...linkButton, color: 'var(--up)' }}>删除</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} style={{ display: 'grid', gap: '10px' }}>
        <input aria-label="昵称（可不填）" placeholder="昵称（可不填）" maxLength={20} value={nickname} onChange={e => setNickname(e.target.value)} style={field} />
        <textarea aria-label="评论内容" placeholder="写下你的想法或疑问（2–1000 字，审核后显示）" required minLength={2} maxLength={1000} rows={4} value={content} onChange={e => setContent(e.target.value)} style={{ ...field, resize: 'vertical' }} />
        {/* 蜜罐：对真人隐藏 */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={e => setWebsite(e.target.value)} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button type="submit" disabled={sending} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: sending ? 'wait' : 'pointer' }}>
            {sending ? '提交中…' : '提交评论'}
          </button>
          {notice && <span role="status" style={{ color: notice.kind === 'ok' ? 'var(--accent)' : 'var(--up)', fontSize: '0.9rem' }}>{notice.text}</span>}
        </div>
      </form>
      <div style={{ marginTop: '16px', fontSize: '0.85rem' }}>
        {admin ? (
          <button type="button" onClick={() => logout()} style={linkButton}>退出管理</button>
        ) : loginOpen ? (
          <form onSubmit={login} style={{ display: 'flex', gap: '8px' }}>
            <input type="password" aria-label="管理员 token" placeholder="管理员 token" autoComplete="off" value={tokenInput} onChange={e => setTokenInput(e.target.value)} style={{ ...field, flex: 1 }} />
            <button type="submit" style={linkButton}>进入</button>
          </form>
        ) : (
          <button type="button" onClick={() => setLoginOpen(true)} style={{ ...linkButton, color: 'var(--text-secondary)' }}>管理</button>
        )}
      </div>
    </section>
  )
}
