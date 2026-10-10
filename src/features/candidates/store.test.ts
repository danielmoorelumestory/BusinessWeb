import { describe, expect, it, vi } from 'vitest'
import { mergeCandidates, moveCandidate, readCloud, setCandidateNote, toggleCandidate, writeCloud } from './store'
import { validCandidatesPayload } from './validation'
import type { CandidateItem } from './validation'

const item = (code: string, market: CandidateItem['market'] = 'us'): CandidateItem => ({ market, code, addedAt: '2026-10-02T00:00:00.000Z' })
const codes = (l: CandidateItem[]): string[] => l.map(i => i.code)

describe('candidate list operations', () => {
  it('toggle adds to the end, removes on second call, keys by market+code', () => {
    let l = toggleCandidate([], 'us', 'AAPL')
    l = toggleCandidate(l, 'hk', 'AAPL')
    expect(l.map(i => `${i.market}:${i.code}`)).toEqual(['us:AAPL', 'hk:AAPL'])
    expect(codes(toggleCandidate(l, 'us', 'AAPL'))).toEqual(['AAPL'])
  })
  it('move reorders and ignores out-of-range', () => {
    const l = [item('A'), item('B'), item('C')]
    expect(codes(moveCandidate(l, 2, 0))).toEqual(['C', 'A', 'B'])
    expect(codes(moveCandidate(l, 0, 1))).toEqual(['B', 'A', 'C'])
    expect(moveCandidate(l, 0, 5)).toBe(l)
  })
  it('merge keeps cloud order and appends local-only items', () => {
    expect(codes(mergeCandidates([item('B'), item('A')], [item('A'), item('C')]))).toEqual(['B', 'A', 'C'])
  })
})

describe('notes', () => {
  it('sets, trims, truncates and removes a note without touching other items', () => {
    const l = [item('A'), item('B')]
    const withNote = setCandidateNote(l, 'us', 'A', '  hi  ')
    expect(withNote[0].note).toBe('hi'); expect(withNote[1]).toBe(l[1])
    expect(setCandidateNote(withNote, 'us', 'A', ' ')[0]).not.toHaveProperty('note')
    expect(setCandidateNote(l, 'us', 'A', 'x'.repeat(900))[0].note).toHaveLength(500)
  })
  it('validation accepts a note up to 500 chars only', () => {
    expect(validCandidatesPayload({ schemaVersion: 1, items: [{ ...item('A'), note: 'ok' }] })).toBe(true)
    expect(validCandidatesPayload({ schemaVersion: 1, items: [{ ...item('A'), note: 'x'.repeat(501) }] })).toBe(false)
    expect(validCandidatesPayload({ schemaVersion: 1, items: [{ ...item('A'), note: 5 }] })).toBe(false)
  })
})

describe('payload validation', () => {
  it('rejects duplicates, unknown markets, extra fields', () => {
    expect(validCandidatesPayload({ schemaVersion: 1, items: [item('A')] })).toBe(true)
    expect(validCandidatesPayload({ schemaVersion: 1, items: [item('A'), item('A')] })).toBe(false)
    expect(validCandidatesPayload({ schemaVersion: 1, items: [{ ...item('A'), market: 'jp' }] })).toBe(false)
    expect(validCandidatesPayload({ schemaVersion: 1, items: [{ ...item('A'), x: 1 }] })).toBe(false)
  })
})

describe('cloud client', () => {
  it('弱 ETag（CDN 压缩改写）和 X-Revision 都能读出版本号', async () => {
    const body = JSON.stringify({ schemaVersion: 1, items: [item('A')] })
    const weak = vi.fn(async () => new Response(body, { status: 200, headers: { ETag: 'W/"7"' } }))
    expect((await readCloud('t'.repeat(32), weak as never, '/x')).revision).toBe(7)
    const custom = vi.fn(async () => new Response(body, { status: 200, headers: { ETag: 'W/"1"', 'X-Revision': '9' } }))
    expect((await readCloud('t'.repeat(32), custom as never, '/x')).revision).toBe(9)
  })

  it('reads revision from ETag and sends bearer token', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ schemaVersion: 1, items: [item('A')] }), { status: 200, headers: { ETag: '"4"' } }))
    const r = await readCloud('t'.repeat(32), f as unknown as typeof fetch, 'https://x/api')
    expect(r.revision).toBe(4)
    expect((f.mock.calls[0] as unknown[])[1]).toMatchObject({ headers: { Authorization: `Bearer ${'t'.repeat(32)}` } })
  })
  it('non-JSON success body (e.g. dev server returning source) becomes an unavailable error', async () => {
    const f = (async () => new Response('import __vite', { status: 200 })) as unknown as typeof fetch
    await expect(readCloud('t', f, 'https://x')).rejects.toMatchObject({ kind: 'unavailable' })
  })
  it('maps 401 to auth and 409 to conflict', async () => {
    const mk = (status: number) => (async () => new Response(JSON.stringify({ error: 'e' }), { status })) as unknown as typeof fetch
    await expect(readCloud('t', mk(401), 'https://x')).rejects.toMatchObject({ kind: 'auth' })
    await expect(writeCloud('t', [], 1, mk(409), 'https://x')).rejects.toMatchObject({ kind: 'conflict' })
  })
})
