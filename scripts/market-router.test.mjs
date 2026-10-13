import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/market-data/[marketRoute].js'

const response = () => ({ code: 200, headers: {}, body: null,
  setHeader(key, value) { this.headers[key] = value },
  status(code) { this.code = code; return this },
  end() { return this }, json(body) { this.body = body; return this },
})
for (const route of ['macro', 'indexes', 'sentiment', 'daily-analysis']) {
  test(`${route}: 保留跨域预检和禁止写入请求的行为`, async () => {
    const preflight = response()
    await handler({ method: 'OPTIONS', query: { marketRoute: route }, headers: {} }, preflight)
    assert.equal(preflight.code, route === 'daily-analysis' ? 204 : 200)
    assert.equal(preflight.headers['Access-Control-Allow-Origin'], '*')
    const post = response()
    await handler({ method: 'POST', query: { marketRoute: route }, headers: {} }, post)
    assert.equal(post.code, 405)
  })
}
test('未知及重复路由参数返回 404', async () => {
  for (const route of ['unknown', ['macro', 'indexes'], '__proto__']) {
    const res = response()
    await handler({ method: 'GET', query: { marketRoute: route }, headers: {} }, res)
    assert.equal(res.code, 404)
  }
})
