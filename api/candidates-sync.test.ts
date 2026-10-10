// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestD1 } from '../server/d1TestDb'
import handler from './candidates-sync'
import { auth, call, TOKEN } from './syncTestKit'

const items = (n: number) => ({ schemaVersion: 1, items: Array.from({ length: n }, (_, i) => ({ market: 'us', code: `T${i}`, addedAt: '2026-09-30T10:00:00.000Z' })) })

describe('/api/candidates-sync（D1）', () => {
  let db: ReturnType<typeof createTestD1>
  beforeEach(() => { db = createTestD1(); process.env.PULSE_SYNC_TOKEN = TOKEN })
  afterEach(() => { delete process.env.PULSE_SYNC_TOKEN })

  const get = (headers = auth()) => call(handler, { method: 'GET', headers, env: { DB: db } })
  const put = (body: unknown, revision: number) => call(handler, { method: 'PUT', headers: auth({ 'if-match': `"${revision}"` }), body, env: { DB: db } })

  it('405、503、401 与复盘接口一致', async () => {
    expect((await call(handler, { method: 'DELETE', env: { DB: db } })).headers.allow).toBe('GET, PUT')
    expect((await call(handler, { method: 'GET', headers: auth() })).status).toBe(503)
    expect((await get({ authorization: 'Bearer wrong' })).status).toBe(401)
  })

  it('读取空快照：ETag 与 X-Revision 一致', async () => {
    const r = await get()
    expect(r.status).toBe(200)
    expect(r.headers.etag).toBe('"0"')
    expect(r.headers['x-revision']).toBe('0')
    expect(r.body).toEqual({ schemaVersion: 1, items: [] })
  })

  it('写入后再读取；旧版本号返回 409', async () => {
    expect((await put(items(3), 0)).status).toBe(200)
    const g = await get()
    expect(g.headers.etag).toBe('"1"')
    expect(g.headers['x-revision']).toBe('1')
    expect(g.body).toEqual(items(3))
    expect((await put(items(1), 0)).status).toBe(409)
    expect((await get()).body).toEqual(items(3))
  })

  it('候选池缩减不被拒绝，也不写历史', async () => {
    await put(items(10), 0)
    expect((await put(items(1), 1)).status).toBe(200)
    expect((db.raw.prepare('SELECT count(*) AS n FROM pulse_history').get() as { n: number }).n).toBe(0)
  })

  it('428、413、400：缺 If-Match、过大、重复项', async () => {
    expect((await call(handler, { method: 'PUT', headers: auth(), body: items(1), env: { DB: db } })).status).toBe(428)
    expect((await put('x'.repeat(1_000_001), 0)).status).toBe(413)
    const dup = { schemaVersion: 1, items: [items(1).items[0], items(1).items[0]] }
    expect((await put(dup, 0)).status).toBe(400)
    expect((await put('{坏的', 0)).status).toBe(400)
  })

  it('数据库抛错返回 502，且不泄露内部细节', async () => {
    db.failNext(new Error('SQLITE_SECRET_DETAIL'))
    const r = await get()
    expect(r.status).toBe(502)
    expect(JSON.stringify(r.body)).not.toContain('SQLITE_SECRET_DETAIL')
  })

  it('云端数据结构无效返回 502', async () => {
    db.raw.prepare("UPDATE sync_snapshot SET payload = '[]' WHERE kind = 'candidates'").run()
    expect((await get()).status).toBe(502)
  })
})
