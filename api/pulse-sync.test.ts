// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { review } from '../src/features/pulse/fixtures'
import { createTestD1 } from '../server/d1TestDb'
import handler from './pulse-sync'
import { auth, call, TOKEN } from './syncTestKit'

const reviews = (n: number) => ({ schemaVersion: 1, reviews: Array.from({ length: n }, (_, i) => review(`2026-02-${String(i + 1).padStart(2, '0')}`)) })
const tombstones = (n: number) => ({ schemaVersion: 1, reviews: Array.from({ length: n }, (_, i) => ({ date: `2026-02-${String(i + 1).padStart(2, '0')}`, deleted: true, updatedAt: '2026-09-30T10:00:00.000Z' })) })

describe('/api/pulse-sync（D1）', () => {
  let db: ReturnType<typeof createTestD1>
  beforeEach(() => { db = createTestD1(); process.env.PULSE_SYNC_TOKEN = TOKEN })
  afterEach(() => { delete process.env.PULSE_SYNC_TOKEN })

  const get = (headers = auth()) => call(handler, { method: 'GET', headers, env: { DB: db } })
  const put = (body: unknown, revision: number | string, extra: Record<string, string> = {}) =>
    call(handler, { method: 'PUT', headers: auth({ 'if-match': `"${revision}"`, ...extra }), body, env: { DB: db } })

  it('只支持 GET 与 PUT，其余返回 405 并带 Allow', async () => {
    const r = await call(handler, { method: 'POST', env: { DB: db } })
    expect(r.status).toBe(405)
    expect(r.headers.allow).toBe('GET, PUT')
  })

  it('没有 D1 绑定返回 503，不访问任何存储', async () => {
    expect((await call(handler, { method: 'GET', headers: auth() })).status).toBe(503)
    expect((await call(handler, { method: 'GET', headers: auth(), env: {} })).status).toBe(503)
  })

  it('令牌未配置或短于 32 字符返回 503', async () => {
    process.env.PULSE_SYNC_TOKEN = 'short'
    expect((await get()).status).toBe(503)
    delete process.env.PULSE_SYNC_TOKEN
    expect((await get()).status).toBe(503)
  })

  it('令牌无效返回 401，且先于数据库访问', async () => {
    db.failNext(new Error('不该访问数据库'))
    expect((await get({ authorization: 'Bearer wrong' })).status).toBe(401)
    expect((await call(handler, { method: 'GET', env: { DB: db } })).status).toBe(401)
    expect((await get()).status).toBe(502) // 失败标记仍在，证明前面两次没有碰数据库
  })

  it('读取空快照：200、ETag "0"、空复盘', async () => {
    const r = await get()
    expect(r.status).toBe(200)
    expect(r.headers.etag).toBe('"0"')
    expect(r.body).toEqual({ schemaVersion: 1, reviews: [] })
    expect(r.headers['cache-control']).toBe('no-store')
  })

  it('写入后再读取，ETag 加一', async () => {
    const r = await put(reviews(2), 0)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true })
    const g = await get()
    expect(g.headers.etag).toBe('"1"')
    expect(g.body).toEqual(reviews(2))
  })

  it('缺少或格式错误的 If-Match 返回 428', async () => {
    expect((await call(handler, { method: 'PUT', headers: auth(), body: reviews(1), env: { DB: db } })).status).toBe(428)
    expect((await call(handler, { method: 'PUT', headers: auth({ 'if-match': '0' }), body: reviews(1), env: { DB: db } })).status).toBe(428)
  })

  it('版本号不匹配返回 409，云端数据不变', async () => {
    await put(reviews(2), 0)
    const r = await put(reviews(3), 0)
    expect(r.status).toBe(409)
    expect((await get()).body).toEqual(reviews(2))
  })

  it('请求体超过 1,000,000 字节返回 413；结构无效或非 JSON 返回 400', async () => {
    expect((await put('x'.repeat(1_000_001), 0)).status).toBe(413)
    expect((await put('{坏的', 0)).status).toBe(400)
    expect((await put({ schemaVersion: 1, reviews: [{ date: 'bad' }] }, 0)).status).toBe(400)
    expect((await get()).headers.etag).toBe('"0"')
  })

  it('JSON 字符串形式的请求体也能解析', async () => {
    expect((await put(JSON.stringify(reviews(1)), 0)).status).toBe(200)
  })

  it('有效记录从 10 条减到 4 条被拒绝（422），带 X-Allow-Shrink 才成功并留下历史', async () => {
    await put(reviews(10), 0)
    const r = await put(reviews(4), 1)
    expect(r.status).toBe(422)
    expect((await get()).body).toEqual(reviews(10))
    expect((await put(reviews(4), 1, { 'x-allow-shrink': '1' })).status).toBe(200)
    const history = db.raw.prepare('SELECT revision FROM pulse_history ORDER BY id').all() as Array<{ revision: number }>
    expect(history.map(h => h.revision)).toEqual([0, 1])
  })

  it('墓碑记录不计入有效记录；少于 6 条时不触发缩减保护', async () => {
    await put(reviews(5), 0)
    expect((await put(reviews(1), 1)).status).toBe(200)
    await put(reviews(10), 2)
    expect((await put({ schemaVersion: 1, reviews: [...tombstones(8).reviews, ...reviews(10).reviews.slice(8)] }, 3)).status).toBe(422)
  })

  it('每次成功写入前保存旧版本到历史', async () => {
    await put(reviews(1), 0)
    await put(reviews(2), 1)
    const rows = db.raw.prepare('SELECT revision, payload FROM pulse_history ORDER BY id').all() as Array<{ revision: number; payload: string }>
    expect(rows.map(r => r.revision)).toEqual([0, 1])
    expect(JSON.parse(rows[1].payload)).toEqual(reviews(1))
  })

  it('数据库抛错返回 502，且不泄露内部细节', async () => {
    db.failNext(new Error('SQLITE_SECRET_DETAIL'))
    const r = await get()
    expect(r.status).toBe(502)
    expect(JSON.stringify(r.body)).not.toContain('SQLITE_SECRET_DETAIL')
  })

  it('没有应用 schema 或云端数据结构无效返回 502', async () => {
    expect((await call(handler, { method: 'GET', headers: auth(), env: { DB: createTestD1({ schema: false }) } })).status).toBe(502)
    db.raw.prepare("UPDATE sync_snapshot SET payload = '{\"schemaVersion\":2}' WHERE kind = 'pulse'").run()
    expect((await get()).status).toBe(502)
  })
})
