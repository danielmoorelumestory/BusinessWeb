// 在 Pages Functions 适配器下端到端检查 api/knowledge.ts，包括 MCP 的 Web 标准传输分支。
// 与 check-functions.mjs 一样先用 tsc 编译 TS，再用假的 Supabase 响应（替换全局 fetch）运行，不依赖网络和真实数据库。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const directory = await mkdtemp(join(tmpdir(), 'businessweb-edge-knowledge-'))
try {
  const compiled = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json', '--noEmit', 'false', '--outDir', directory], { encoding: 'utf8' })
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr)
  await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module' }))
  await symlink(resolve('node_modules'), join(directory, 'node_modules'))
  await mkdir(join(directory, 'server/knowledge'), { recursive: true })
  await mkdir(join(directory, 'server/edge'), { recursive: true })
  await copyFile(resolve('server/knowledge/links.mjs'), join(directory, 'server/knowledge/links.mjs'))
  await copyFile(resolve('server/edge/adapter.mjs'), join(directory, 'server/edge/adapter.mjs'))
  await writeFile(join(directory, 'check.mjs'), `
import assert from 'node:assert/strict'
import knowledge from './api/knowledge.js'
import { toPagesFunction } from './server/edge/adapter.mjs'

const READ = 'r'.repeat(32), MCP = 'm'.repeat(32), UPLOAD = 'u'.repeat(32)
const env = { SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x', KNOWLEDGE_READ_TOKEN: READ, KNOWLEDGE_MCP_TOKEN: MCP, KNOWLEDGE_UPLOAD_TOKEN: UPLOAD }
const GEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const note = { path: 'a.md', title: '甲', excerpt: '摘要', version: 'v1', updatedAt: '2026-10-07T00:00:00Z' }
const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })

// 假的 Supabase：按请求路径返回固定数据，并记录被访问的路径
const seen = []
globalThis.fetch = async (url, init = {}) => {
  const text = String(url); seen.push(text)
  assert.equal(init.redirect, 'error')
  if (text.includes('businessweb_knowledge_head')) return json([{ revision: 3, generation: GEN, vault_id: 'v'.repeat(64), graph: { nodes: [], edges: [] }, synced_at: '2026-10-07T00:00:00Z' }])
  if (text.includes('rpc/businessweb_search_knowledge')) return json([{ path: 'a.md', title: '甲' }])
  if (text.includes('select=payload')) return json([{ payload: { note: { path: 'a.md', title: '甲', content: '# 甲' }, relations: { links: [], backlinks: [] } } }])
  if (text.includes('businessweb_knowledge_notes')) return json([note])
  return new Response('not found', { status: 404 })
}

const handler = toPagesFunction(knowledge)
const call = (url, init = {}) => handler({ request: new Request('https://site.test' + url, init), env })
const bearer = token => ({ authorization: 'Bearer ' + token })
const rpc = (method, params, id = 1) => JSON.stringify({ jsonrpc: '2.0', id, method, params })
const mcp = (body, token = MCP, extra = {}) => call('/api/knowledge?action=mcp', { method: 'POST', headers: { ...bearer(token), 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...extra }, body })

// 只读动作经适配器工作
let res = await call('/api/knowledge?action=status', { headers: bearer(READ) })
assert.equal(res.status, 200); assert.equal((await res.json()).revision, 3)
res = await call('/api/knowledge?action=notes', { headers: bearer(MCP) })
assert.deepEqual((await res.json()).map(n => n.path), ['a.md'])
res = await call('/api/knowledge?action=search&q=甲', { headers: bearer(READ) })
assert.equal((await res.json())[0].path, 'a.md')
res = await call('/api/knowledge?action=note&path=a.md', { headers: bearer(READ) })
assert.equal((await res.json()).content, '# 甲')

// 鉴权、来源与参数校验
assert.equal((await call('/api/knowledge?action=status')).status, 401)
assert.equal((await call('/api/knowledge?action=status', { headers: bearer(UPLOAD) })).status, 401, '上传凭据不能读')
assert.equal((await call('/api/knowledge?action=status', { headers: { ...bearer(READ), origin: 'https://evil.example' } })).status, 403)
assert.equal((await call('/api/knowledge?action=note', { headers: bearer(READ) })).status, 400)
assert.equal((await call('/api/knowledge?action=nope', { headers: bearer(READ) })).status, 404)
res = await call('/api/knowledge?action=status', { method: 'OPTIONS', headers: { origin: 'https://businessweb-c0u.pages.dev' } })
assert.equal(res.status, 200); assert.equal(res.headers.get('access-control-allow-origin'), 'https://businessweb-c0u.pages.dev')

// MCP：走 Web 标准传输
res = await mcp(rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'check', version: '1' } }))
assert.equal(res.status, 200, await res.clone().text())
assert.equal((await res.json()).result.serverInfo.name, 'personal-brain-cloud')
res = await mcp(rpc('tools/list', {}, 2))
const tools = (await res.json()).result.tools.map(t => t.name).sort()
assert.deepEqual(tools, ['find_related_notes', 'list_notes', 'read_note', 'search_investment', 'search_knowledge'])
res = await mcp(rpc('tools/call', { name: 'list_notes', arguments: {} }, 3))
const listed = JSON.parse((await res.json()).result.content[0].text)
assert.equal(listed.notes[0].path, 'a.md'); assert.equal(listed.readOnly, true)
res = await mcp(rpc('tools/call', { name: 'search_knowledge', arguments: { query: '甲' } }, 4))
assert.equal(JSON.parse((await res.json()).result.content[0].text).notes[0].title, '甲')
res = await mcp(rpc('tools/call', { name: 'read_note', arguments: { path: '../x' } }, 5))
assert.equal((await res.json()).result.isError, true, '非法路径应返回工具错误而不是崩溃')

// MCP 的鉴权与限制
assert.equal((await mcp(rpc('tools/list', {}), UPLOAD)).status, 401, '上传凭据不能用于 MCP')
assert.equal((await mcp(rpc('tools/list', {}), 'x'.repeat(32))).status, 401)
assert.equal((await call('/api/knowledge?action=mcp', { headers: bearer(MCP) })).status, 405, 'MCP 只接受 POST')
assert.equal((await mcp('x'.repeat(70000))).status, 413)

// 未配置时不暴露细节（先清掉适配器此前写入 process.env 的变量，模拟全新的、没有配置的部署）
for (const key of Object.keys(env)) delete process.env[key]
const unconfigured = await toPagesFunction(knowledge)({ request: new Request('https://site.test/api/knowledge?action=status'), env: {} })
assert.equal(unconfigured.status, 503)
console.log('Edge knowledge (adapter + MCP web transport): passed')
`)
  // 删除而不是置空：适配器不会覆盖 process.env 里已有的键，这里要让变量只通过 Workers 的 env 传入
  const env = { ...process.env }
  for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'KNOWLEDGE_READ_TOKEN', 'KNOWLEDGE_MCP_TOKEN', 'KNOWLEDGE_UPLOAD_TOKEN']) delete env[key]
  const run = spawnSync(process.execPath, [join(directory, 'check.mjs')], { env, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  process.stdout.write(run.stdout)
} finally {
  await rm(directory, { recursive: true, force: true })
}
