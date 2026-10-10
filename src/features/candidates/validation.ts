// 候选池云同步的严格校验：服务端（api/candidates-sync.ts）与客户端共用。
export type CandidateMarket = 'us' | 'cn' | 'hk' | 'adr' | 'ndx'
export type CandidateItem = { market: CandidateMarket; code: string; addedAt: string; note?: string }
export type CandidatesPayload = { schemaVersion: 1; items: CandidateItem[] }

export const MAX_CANDIDATES = 2000
export const MAX_NOTE = 500
const MARKETS = new Set<string>(['us', 'cn', 'hk', 'adr', 'ndx'])
const ITEM_KEYS = new Set(['market', 'code', 'addedAt', 'note'])
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export const candidateKey = (item: { market: string; code: string }): string => `${item.market}:${item.code}`

export function validCandidateItem(value: unknown): value is CandidateItem {
  return object(value)
    && Object.keys(value).every(k => ITEM_KEYS.has(k))
    && typeof value.market === 'string' && MARKETS.has(value.market)
    && typeof value.code === 'string' && /^[\w.\-^=]{1,32}$/.test(value.code)
    && typeof value.addedAt === 'string' && !Number.isNaN(Date.parse(value.addedAt))
    && (value.note === undefined || (typeof value.note === 'string' && value.note.length <= MAX_NOTE))
}

export function validCandidatesPayload(value: unknown): value is CandidatesPayload {
  if (!object(value) || value.schemaVersion !== 1 || Object.keys(value).some(k => k !== 'schemaVersion' && k !== 'items')) return false
  if (!Array.isArray(value.items) || value.items.length > MAX_CANDIDATES || !value.items.every(validCandidateItem)) return false
  return new Set(value.items.map(candidateKey)).size === value.items.length
}
