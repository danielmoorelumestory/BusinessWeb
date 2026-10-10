import assert from 'node:assert/strict'
import test from 'node:test'
import { populateProcessEnv, toPagesFunction, trustedClientHeaders, wrapFetch } from './adapter.mjs'

const call = (handler, url, init = {}, env = {}) => toPagesFunction(handler)({ request: new Request(url, init), env })

test('查询参数按 Vercel 的方式解析，重复的键变成数组', async () => {
  let seen
  await call((req, res) => { seen = req.query; return res.status(200).end() }, 'https://x.test/api/a?symbol=sh000001&k=1&k=2')
  assert.deepEqual(seen, { symbol: 'sh000001', k: ['1', '2'] })
})

test('请求头键名为小写，并保留 method 与 url', async () => {
  let seen
  await call((req, res) => { seen = req; return res.end() }, 'https://x.test/api/a?q=1', { headers: { Origin: 'https://o.test', Authorization: 'Bearer t' } })
  assert.equal(seen.headers.origin, 'https://o.test')
  assert.equal(seen.headers.authorization, 'Bearer t')
  assert.equal(seen.method, 'GET')
  assert.equal(seen.url, '/api/a?q=1')
})

test('JSON 请求体解析为对象，解析失败时保留原始字符串', async () => {
  const bodies = []
  const handler = (req, res) => { bodies.push(req.body); return res.end() }
  const json = { 'content-type': 'application/json' }
  await call(handler, 'https://x.test/a', { method: 'POST', headers: json, body: '{"a":1}' })
  await call(handler, 'https://x.test/a', { method: 'POST', headers: json, body: '{坏的' })
  await call(handler, 'https://x.test/a', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hello' })
  await call(handler, 'https://x.test/a', { method: 'POST' })
  assert.deepEqual(bodies, [{ a: 1 }, '{坏的', 'hello', undefined])
})

test('status、setHeader、json 可以链式调用并生成标准 Response', async () => {
  const response = await call((req, res) => { res.setHeader('X-A', '1'); return res.status(404).json({ error: '没有' }) }, 'https://x.test/a')
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('x-a'), '1')
  assert.match(response.headers.get('content-type'), /application\/json/)
  assert.deepEqual(await response.json(), { error: '没有' })
})

test('处理函数自己设置的 Content-Type 不会被 json 覆盖', async () => {
  const response = await call((req, res) => { res.setHeader('Content-Type', 'application/vnd.test+json'); return res.json({}) }, 'https://x.test/a')
  assert.equal(response.headers.get('content-type'), 'application/vnd.test+json')
})

test('send 支持字符串与二进制，且原样输出字节', async () => {
  const bytes = Uint8Array.from([0xd0, 0xc2, 0xc0, 0xcb]) // GBK 字节不能被改动
  const text = await call((req, res) => res.setHeader('Content-Type', 'text/plain').status(200).send('你好'), 'https://x.test/a')
  const binary = await call((req, res) => res.status(200).send(bytes), 'https://x.test/a')
  assert.equal(await text.text(), '你好')
  assert.deepEqual(new Uint8Array(await binary.arrayBuffer()), bytes)
})

test('end 不带内容返回空响应，OPTIONS 预检可用', async () => {
  const response = await call((req, res) => res.status(200).end(), 'https://x.test/a', { method: 'OPTIONS' })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '')
})

test('204 与 HEAD 不携带响应体', async () => {
  const noContent = await call((req, res) => res.status(204).end('不应出现'), 'https://x.test/a')
  const head = await call((req, res) => res.status(200).json({ a: 1 }), 'https://x.test/a', { method: 'HEAD' })
  assert.equal(noContent.status, 204)
  assert.equal(await head.text(), '')
})

test('处理函数抛错返回 500，且不暴露内部细节', async () => {
  const response = await call(() => { throw new Error('数据库密码 abc') }, 'https://x.test/a')
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), /abc/)
})

test('处理函数没有结束响应时返回 500，而不是空的 200', async () => {
  const response = await call(() => {}, 'https://x.test/a')
  assert.equal(response.status, 500)
})

test('populateProcessEnv 写入字符串变量，但不覆盖已有值，也忽略非字符串绑定', () => {
  process.env.EDGE_TEST_KEEP = '原值'
  delete process.env.EDGE_TEST_NEW
  delete process.env.EDGE_TEST_BINDING
  try {
    populateProcessEnv({ EDGE_TEST_KEEP: '新值', EDGE_TEST_NEW: 'abc', EDGE_TEST_BINDING: { fetch() {} } })
    assert.equal(process.env.EDGE_TEST_KEEP, '原值')
    assert.equal(process.env.EDGE_TEST_NEW, 'abc')
    assert.equal(process.env.EDGE_TEST_BINDING, undefined)
    assert.doesNotThrow(() => populateProcessEnv(undefined))
  } finally {
    delete process.env.EDGE_TEST_KEEP
    delete process.env.EDGE_TEST_NEW
  }
})

test('适配器能运行现有的真实处理函数（china-stock 参数校验）', async () => {
  const { default: handler } = await import('../../api/china-stock.js')
  const bad = await call(handler, 'https://x.test/api/china-stock?symbol=bad')
  assert.equal(bad.status, 400)
  assert.match((await bad.json()).error, /symbol/)
  assert.equal(bad.headers.get('access-control-allow-origin'), '*')
  const post = await call(handler, 'https://x.test/api/china-stock', { method: 'POST' })
  assert.equal(post.status, 405)
  assert.equal(post.headers.get('allow'), 'GET, OPTIONS')
})

test('wrapFetch：redirect:error 改用 manual，遇到 3xx 抛错，正常响应原样返回', async () => {
  const seen = []
  const fake = async (url, init) => { seen.push(init); return new Response('x', { status: String(url).includes('redir') ? 302 : 200 }) }
  const safe = wrapFetch(fake)
  assert.equal((await safe('https://a.test/ok', { redirect: 'error', headers: { A: '1' } })).status, 200)
  assert.equal(seen[0].redirect, 'manual')
  assert.deepEqual(seen[0].headers, { A: '1' })
  await assert.rejects(() => safe('https://a.test/redir', { redirect: 'error' }), TypeError)
})

test('wrapFetch：其他调用保持不变，包装是幂等的', async () => {
  const calls = []
  const fake = async (url, init) => { calls.push(init); return new Response('x', { status: 302 }) }
  const safe = wrapFetch(fake)
  assert.equal(wrapFetch(safe), safe)
  assert.equal((await safe('https://a.test/', { redirect: 'follow' })).status, 302) // 非 error 不拦截
  assert.equal((await safe('https://a.test/')).status, 302)
  assert.deepEqual(calls, [{ redirect: 'follow' }, undefined])
})

test('所有函数响应都带 X-Robots-Tag: noindex, nofollow，处理函数自己设置的值不被覆盖', async () => {
  const normal = await call((req, res) => res.status(200).json({ a: 1 }), 'https://x.test/api/a')
  const error = await call(() => { throw new Error('x') }, 'https://x.test/api/a')
  const own = await call((req, res) => { res.setHeader('X-Robots-Tag', 'all'); return res.end() }, 'https://x.test/api/a')
  assert.equal(normal.headers.get('x-robots-tag'), 'noindex, nofollow')
  assert.equal(error.headers.get('x-robots-tag'), 'noindex, nofollow')
  assert.equal(own.headers.get('x-robots-tag'), 'all')
  assert.deepEqual(await normal.json(), { a: 1 })
})

test('trustedClientHeaders：有 cf-connecting-ip 时覆盖客户端伪造的 x-real-ip 与 x-forwarded-for', () => {
  const out = trustedClientHeaders({ 'cf-connecting-ip': '203.0.113.9', 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2, 3.3.3.3', accept: '*/*' })
  assert.equal(out['x-real-ip'], '203.0.113.9')
  assert.equal(out['x-forwarded-for'], '203.0.113.9')
  assert.equal(out.accept, '*/*')
})

test('trustedClientHeaders：非 Workers 环境且没有 cf-connecting-ip 时保持原样', () => {
  const input = { 'x-real-ip': '1.1.1.1' }
  assert.deepEqual(trustedClientHeaders(input), input)
})

test('适配后的处理函数看到的是可信 IP，而不是伪造值（经 cf-connecting-ip）', async () => {
  let seen
  await call((req, res) => { seen = { real: req.headers['x-real-ip'], fwd: req.headers['x-forwarded-for'] }; return res.end() }, 'https://x.test/api/a', { headers: { 'cf-connecting-ip': '198.51.100.7', 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '8.8.8.8' } })
  assert.deepEqual(seen, { real: '198.51.100.7', fwd: '198.51.100.7' })
})
