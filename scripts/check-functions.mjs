import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const directory = await mkdtemp(join(tmpdir(), 'businessweb-functions-'))
try {
  const compiled = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json', '--noEmit', 'false', '--outDir', directory], { encoding: 'utf8' })
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr)
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  await writeFile(join(directory, 'package.json'), JSON.stringify({ type: pkg.type ?? 'commonjs' }))
  await mkdir(join(directory, 'server'), { recursive: true })
  for (const file of ['api/china-stock.js', 'api/grid-market.js', 'server/market.mjs']) await copyFile(resolve(file), join(directory, file))
  await writeFile(join(directory, 'check.mjs'), `
import assert from 'node:assert/strict';
import pulse from './api/pulse-sync.js';
import candidates from './api/candidates-sync.js';
import market from './api/grid-market.js';
import china from './api/china-stock.js';
import comments from './api/comments.js';
const res = () => ({code:200, body:null, setHeader(){}, status(code){this.code=code;return this}, json(body){this.body=body;return this}});
for (const [handler, request, code] of [[pulse,{method:'GET',headers:{}},503],[pulse,{method:'GET',headers:{},env:{}},503],[candidates,{method:'GET',headers:{},env:{}},503],[pulse,{method:'POST',headers:{}},405],[candidates,{method:'GET',headers:{}},503],[candidates,{method:'POST',headers:{}},405],[market,{method:'GET',query:{}},400],[china,{method:'GET',query:{}},400],[comments,{method:'GET',headers:{},query:{}},503],[comments,{method:'PUT',headers:{}},405]]) {
 const response=res(); await handler(request,response); assert.equal(response.code,code);
}
console.log('Native Node function loading and unconfigured/invalid requests: passed');
`)
  const env = { ...process.env, SUPABASE_URL: '', SUPABASE_SECRET_KEY: '', PULSE_SYNC_TOKEN: '' }
  const run = spawnSync(process.execPath, ['--no-experimental-detect-module', join(directory, 'check.mjs')], { env, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  process.stdout.write(run.stdout)
} finally {
  await rm(directory, { recursive: true, force: true })
}
