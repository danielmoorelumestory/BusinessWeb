import { MAX_NOTE, candidateKey, validCandidatesPayload } from './validation'
import type { CandidateItem, CandidateMarket } from './validation'

export const CANDIDATES_KEY = 'rn-candidates'
export const CANDIDATES_TOKEN_KEY = 'rn-candidates-token'
const PULSE_CONFIG_KEY = 'pulse_sync_config'
type FetchLike = typeof fetch

// ── 纯函数：列表操作，顺序即用户排序 ──
export const hasCandidate = (list: CandidateItem[], market: string, code: string): boolean => list.some(i => i.market === market && i.code === code)

export function toggleCandidate(list: CandidateItem[], market: CandidateMarket, code: string, now = new Date().toISOString()): CandidateItem[] {
  return hasCandidate(list, market, code) ? list.filter(i => candidateKey(i) !== `${market}:${code}`) : [...list, { market, code, addedAt: now }]
}

export function moveCandidate(list: CandidateItem[], from: number, to: number): CandidateItem[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

// 备注：去掉首尾空白，空备注直接删除字段；超长截断
export function setCandidateNote(list: CandidateItem[], market: string, code: string, note: string): CandidateItem[] {
  const text = note.trim().slice(0, MAX_NOTE)
  return list.map(i => {
    if (i.market !== market || i.code !== code) return i
    const { note: _old, ...rest } = i
    return text ? { ...rest, note: text } : rest
  })
}

// 首次连接云端：以云端顺序为准，本机独有的追加在后面
export function mergeCandidates(cloud: CandidateItem[], local: CandidateItem[]): CandidateItem[] {
  const seen = new Set(cloud.map(candidateKey))
  return [...cloud, ...local.filter(i => !seen.has(candidateKey(i)))]
}

// ── 本机缓存 ──
export function loadLocal(): CandidateItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CANDIDATES_KEY) ?? 'null')
    return validCandidatesPayload({ schemaVersion: 1, items: parsed }) ? (parsed as CandidateItem[]) : []
  } catch { return [] }
}
export function saveLocal(list: CandidateItem[]): void {
  try { localStorage.setItem(CANDIDATES_KEY, JSON.stringify(list)) } catch { /* 隐私模式下忽略 */ }
}

// 身份：只需校验一次。优先用本页保存的 token，其次沿用「每日复盘」已保存的同一把 token（PULSE_SYNC_TOKEN）
export function loadToken(): string | null {
  try {
    const own = localStorage.getItem(CANDIDATES_TOKEN_KEY)
    if (own && own.length >= 32) return own
    const pulse = JSON.parse(localStorage.getItem(PULSE_CONFIG_KEY) ?? 'null') as { token?: unknown } | null
    return typeof pulse?.token === 'string' && pulse.token.length >= 32 ? pulse.token : null
  } catch { return null }
}
export function saveToken(token: string): boolean {
  const t = token.trim()
  if (t.length < 32) return false
  try { localStorage.setItem(CANDIDATES_TOKEN_KEY, t); return true } catch { return false }
}
export function clearToken(): void {
  try { localStorage.removeItem(CANDIDATES_TOKEN_KEY) } catch { /* 忽略 */ }
}

// ── 云端 ──
export function candidatesEndpoint(): string {
  const base = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE ?? '').replace(/\/$/, '')
  return `${base}/api/candidates-sync`
}

export type CloudError = { kind: 'auth' | 'conflict' | 'unavailable'; message: string }
export type CloudRead = { items: CandidateItem[]; revision: number }

async function parseError(res: Response): Promise<CloudError> {
  let message = '同步失败'
  try { message = ((await res.json()) as { error?: string }).error ?? message } catch { /* 忽略 */ }
  return { kind: res.status === 401 ? 'auth' : res.status === 409 ? 'conflict' : 'unavailable', message }
}

export async function readCloud(token: string, fetchImpl: FetchLike = fetch, endpoint = candidatesEndpoint()): Promise<CloudRead> {
  let res: Response
  try { res = await fetchImpl(endpoint, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }) } catch { throw { kind: 'unavailable', message: '无法连接云端' } satisfies CloudError }
  if (!res.ok) throw await parseError(res)
  let body: unknown
  try { body = await res.json() } catch { throw { kind: 'unavailable', message: '云端接口不可用（未部署，或本地开发环境没有后端），数据暂存本机' } satisfies CloudError }
  // CDN 压缩响应时会把强 ETag 改成弱 ETag（W/"3"），所以优先读不会被改写的 X-Revision，ETag 兼容弱校验写法
  const revision = Number(/^(?:W\/)?"?(\d+)"?$/.exec(res.headers.get('X-Revision') ?? res.headers.get('ETag') ?? '')?.[1])
  if (!Number.isSafeInteger(revision)) throw { kind: 'unavailable', message: '云端响应缺少版本号，请稍后重试' } satisfies CloudError
  if (!validCandidatesPayload(body)) throw { kind: 'unavailable', message: '云端数据无效（结构校验失败，可能含重复或不合规条目）' } satisfies CloudError
  return { items: body.items, revision }
}

export async function writeCloud(token: string, items: CandidateItem[], revision: number, fetchImpl: FetchLike = fetch, endpoint = candidatesEndpoint()): Promise<void> {
  let res: Response
  try {
    res = await fetchImpl(endpoint, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'If-Match': `"${revision}"` },
      body: JSON.stringify({ schemaVersion: 1, items }),
    })
  } catch { throw { kind: 'unavailable', message: '无法连接云端' } satisfies CloudError }
  if (!res.ok) throw await parseError(res)
}
