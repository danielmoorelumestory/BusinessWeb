import assert from 'node:assert/strict'

const base = new URL(process.argv[2] ?? '')
assert.equal(base.protocol, 'https:', 'Provide the deployed HTTPS site URL')
assert.equal(base.pathname, '/', 'Provide the site origin without a path')
let failures = 0
for (const path of ['/', '/grid-trading', '/grid-trading/records/check-route', '/api/not-a-route', '/api/pulse-sync', '/api/grid-market?kind=quotes&symbols=sh510300']) {
  try {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20_000) })
    const bytes = await response.arrayBuffer()
    const quote = path.includes('kind=quotes')
    const text = new TextDecoder(quote ? 'gbk' : 'utf-8').decode(bytes)
    if (path === '/api/not-a-route') assert.equal(response.status, 404)
    else if (path === '/api/pulse-sync') {
      assert.ok([401, 503].includes(response.status), `Expected unauthorized or unconfigured sync, received ${response.status}`)
      assert.equal(typeof JSON.parse(text).error, 'string')
    } else {
      assert.equal(response.status, 200)
      assert.match(text, quote ? /v_sh510300=/ : /\/assets\//)
      if (path === '/') {
        const assets = [...text.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match => match[1])
        assert.ok(assets.length > 0, 'Expected deployed assets')
        for (const asset of assets) {
          const resource = await fetch(new URL(asset, base), { signal: AbortSignal.timeout(20_000) })
          assert.equal(resource.status, 200, asset)
          assert.match(resource.headers.get('content-type') ?? '', asset.endsWith('.js') ? /javascript/ : /css/, asset)
          console.log(`PASS asset ${asset}`)
        }
      }
    }
    console.log(`PASS ${path}: HTTP ${response.status}`)
  } catch (error) {
    failures += 1
    console.error(`FAIL ${path}: ${error.message}`)
  }
}
process.exitCode = failures ? 1 : 0
