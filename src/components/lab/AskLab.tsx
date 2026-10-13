import React, { useEffect, useState } from 'react'
import '../../styles/ask-lab.css'

const DAILY_LIMIT = 2
const MAX_LENGTH = 500
const STORAGE_KEY = 'askLab.accessToken'
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

const readToken = (): string => { try { return sessionStorage.getItem(STORAGE_KEY) ?? '' } catch { return '' } }
const writeToken = (token: string): void => { try { token ? sessionStorage.setItem(STORAGE_KEY, token) : sessionStorage.removeItem(STORAGE_KEY) } catch { /* 隐私模式下不保存登录态 */ } }

// Supabase OAuth 回跳后 token 在 URL hash 里：取出后立即从地址栏清掉。
function takeTokenFromHash(): string {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const token = params.get('access_token') ?? ''
  if (token) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

type Phase = 'sending' | 'model' | 'thinking' | 'writing'
const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'sending', label: '校验登录与次数' },
  { phase: 'model', label: '连接模型' },
  { phase: 'thinking', label: '思考中' },
  { phase: 'writing', label: '生成回答' },
]
type StreamEvent = { type: 'phase'; phase: Phase } | { type: 'delta'; text: string } | { type: 'done'; remaining?: number | null } | { type: 'error'; error: string }

export default function AskLab(): JSX.Element | null {
  const [token, setToken] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const busy = phase !== null

  useEffect(() => {
    const fromHash = takeTokenFromHash()
    if (fromHash) writeToken(fromHash)
    setToken(fromHash || readToken())
  }, [])

  // 登录后（含刷新页面）向服务端读取今天剩余次数。
  useEffect(() => {
    if (!token || !supabaseUrl || !supabaseAnon) return
    let alive = true
    fetch(`${apiBase}/api/ask`, { headers: { authorization: `Bearer ${token}` } })
      .then(async response => {
        if (response.status === 401) { if (alive) logout(); return }
        const data = (await response.json().catch(() => ({}))) as { remaining?: number }
        if (alive && typeof data.remaining === 'number') setRemaining(data.remaining)
      })
      .catch(() => { /* 读取失败时不显示剩余次数 */ })
    return () => { alive = false }
  }, [token])

  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const started = Date.now()
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [busy])

  if (!supabaseUrl || !supabaseAnon) return null

  const login = (provider: 'google' | 'github') => {
    const back = encodeURIComponent(window.location.origin + window.location.pathname)
    window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${back}`
  }
  function logout() { writeToken(''); setToken(''); setAnswer(''); setError(''); setRemaining(null) }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || question.trim().length < 2 || remaining === 0) return
    setPhase('sending'); setError(''); setAnswer('')
    try {
      const response = await fetch(`${apiBase}/api/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      })
      if (!(response.headers.get('content-type') ?? '').includes('ndjson') || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { answer?: string; error?: string; remaining?: number }
        if (response.status === 401) logout()
        if (typeof data.remaining === 'number') setRemaining(data.remaining)
        if (!response.ok || !data.answer) throw new Error(data.error || '请求失败，请稍后再试')
        setAnswer(data.answer)
        setRemaining(left => (left === null ? null : Math.max(left - 1, 0)))
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finished = false
      const handle = (line: string) => {
        if (!line.trim()) return
        const item = JSON.parse(line) as StreamEvent
        if (item.type === 'phase') setPhase(item.phase)
        else if (item.type === 'delta') { setPhase('writing'); setAnswer(text => text + item.text) }
        else if (item.type === 'done') { finished = true; setRemaining(left => item.remaining ?? (left === null ? null : Math.max(left - 1, 0))) }
        else if (item.type === 'error') throw new Error(item.error)
      }
      for (;;) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        lines.forEach(handle)
        if (done) { handle(buffer); break }
      }
      if (!finished) throw new Error('连接中断，请稍后再试')
    } catch (e) {
      setAnswer('')
      setError(e instanceof Error ? e.message : '请求失败，请稍后再试')
    } finally {
      setPhase(null)
    }
  }

  const length = question.length
  const exhausted = remaining === 0
  const canSubmit = !busy && !exhausted && question.trim().length >= 2
  const submitOnShortcut = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
  }
  const stepIndex = phase ? STEPS.findIndex(step => step.phase === phase) : -1

  return (
    <section id="lab-ask" className="lab-section ask-lab" aria-labelledby="lab-ask-title">
      <div className="ask-lab__card">
        <div className="ask-lab__head">
          <h2 id="lab-ask-title">试问 AI</h2>
          {token && <span className="ask-lab__account">
            {remaining !== null && <span className={exhausted ? 'ask-lab__quota is-empty' : 'ask-lab__quota'} aria-live="polite">今日剩余 {remaining} / {DAILY_LIMIT}</span>}
            <button type="button" className="ask-lab__logout" onClick={logout}>退出登录</button>
          </span>}
        </div>
        <p className="ask-lab__intro">登录后每天免费问 {DAILY_LIMIT} 次，限投研方法与 AI 工具，仅供参考。<a href={`${import.meta.env.BASE_URL}ai-privacy.html`}>隐私说明</a></p>
        {token ? (
          <form onSubmit={submit} className="ask-lab__form">
            <label className="visually-hidden" htmlFor="lab-ask-input">你的问题</label>
            <textarea id="lab-ask-input" value={question} maxLength={MAX_LENGTH} rows={3} onChange={e => setQuestion(e.target.value)} onKeyDown={submitOnShortcut}
              placeholder="例如：怎样用三情景法给一家公司做估值？" aria-describedby="lab-ask-count" />
            <div className="ask-lab__actions">
              <span className="ask-lab__meta">
                <span>Ctrl / ⌘ + Enter</span>
                <span id="lab-ask-count" className={length > MAX_LENGTH - 50 ? 'ask-lab__count is-near' : 'ask-lab__count'}>{length} / {MAX_LENGTH}</span>
              </span>
              <button type="submit" className="tool-btn tool-btn--primary ask-lab__submit" disabled={!canSubmit}>{busy ? '回答中…' : exhausted ? '明天再来' : '提问'}</button>
            </div>
          </form>
        ) : (
          <div className="ask-lab__actions ask-lab__actions--login">
            <button type="button" className="tool-btn tool-btn--primary" onClick={() => login('google')}>使用 Google 登录</button>
            <button type="button" className="tool-btn" onClick={() => login('github')}>使用 GitHub 登录</button>
          </div>
        )}
        {error && <div className="ui-callout ui-callout--warn ask-lab__error" role="alert">{error}</div>}
        {(busy || answer) && <article className={busy ? 'ask-lab__answer-card is-busy' : 'ask-lab__answer-card'} aria-live="polite" aria-busy={busy}>
          {busy && <div className="ask-lab__progress">
            <ol className="ask-lab__steps">
              {STEPS.map((step, index) => (
                <li key={step.phase} className={index < stepIndex ? 'is-done' : index === stepIndex ? 'is-active' : ''}>{step.label}</li>
              ))}
            </ol>
            <span className="ask-lab__elapsed">{elapsed}s</span>
          </div>}
          {answer
            ? <p className="ask-lab__answer">{answer}{busy && <span className="ask-lab__caret" aria-hidden="true" />}</p>
            : <div className="ask-lab__skeleton" aria-label="正在思考…"><span /><span /><span /></div>}
          {!busy && <p className="ask-lab__disclaimer">仅供参考，不构成投资建议。</p>}
          {busy && elapsed >= 15 && !answer && <p className="ask-lab__hint">模型在认真想，通常 10–30 秒，请稍等。</p>}
        </article>}
      </div>
    </section>
  )
}
