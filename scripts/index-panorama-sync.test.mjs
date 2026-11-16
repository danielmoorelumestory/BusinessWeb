import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PUBLIC_FILES, PUBLIC_DIR, check, compareBundles, publish, restore, sameObservations, validateBundle } from './index-panorama-sync.mjs'

const FIELDS = ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume']

function series(code, d, fill = 1) {
  const s = { code, d }
  for (const f of FIELDS) s[f] = d.map(() => fill)
  return s
}
const bundleText = data => `/* test */\nwindow.PANO_DATA=${JSON.stringify(data)};\n`

function fakeSource(dir, data) {
  for (const f of PUBLIC_FILES) {
    mkdirSync(join(dir, f, '..'), { recursive: true })
    writeFileSync(join(dir, f), f === 'data-bundle.js' ? bundleText(data) : `/* ${f} */`)
  }
}

test('validateBundle：合法数据包无错误', () => {
  const { errors } = validateBundle(bundleText({ asOf: '2026-11-13', indices: [series('A', ['2026-11-12', '2026-11-13'])] }), { minIndices: 1 })
  assert.deepEqual(errors, [])
})

test('validateBundle：日期乱序、长度不齐、非有限数、指数太少都报错', () => {
  const bad = series('A', ['2026-11-13', '2026-11-12'])
  bad.pe = [1]
  bad.pb = [1, 'x']
  const { errors } = validateBundle(bundleText({ asOf: '2026-11-13', indices: [bad] }), { minIndices: 2 })
  assert.ok(errors.some(e => e.includes('少于 2')))
  assert.ok(errors.some(e => e.includes('严格升序')))
  assert.ok(errors.some(e => e.includes('A.pe 长度')))
  assert.ok(errors.some(e => e.includes('A.pb 含非有限数')))
})

test('validateBundle：末日晚于 asOf（造未来观测）报错', () => {
  const { errors } = validateBundle(bundleText({ asOf: '2026-11-12', indices: [series('A', ['2026-11-12', '2026-11-13'])] }), { minIndices: 1 })
  assert.ok(errors.some(e => e.includes('晚于 asOf')))
})

test('compareBundles：字段末日回退、整列消失、指数消失', () => {
  const prev = { indices: [series('A', ['2026-11-12', '2026-11-13']), series('B', ['2026-11-13'])] }
  const next = { indices: [series('A', ['2026-11-12', '2026-11-13'])] }
  next.indices[0].pe = [1, null]
  next.indices[0].eps = [null, null]
  const p = compareBundles(prev, next)
  assert.ok(p.some(x => x.includes('A.pe 末日回退')))
  assert.ok(p.some(x => x.includes('A.eps 原有数据')))
  assert.ok(p.some(x => x.includes('B 在新数据包中消失')))
})

test('sameObservations：只看观测，不看生成时间', () => {
  const a = { asOf: '2026-11-13', generatedAt: 'x', indices: [series('A', ['2026-11-13'])] }
  assert.equal(sameObservations(a, { ...a, generatedAt: 'y', warnings: ['新'] }), true)
  const b = structuredClone(a)
  b.indices[0].pe = [2]
  assert.equal(sameObservations(a, b), false)
})

test('publish/check/restore：白名单复制、删除多余文件、拒绝退化、取回上一版', () => {
  const root = mkdtempSync(join(tmpdir(), 'pano-'))
  const source = join(root, 'src')
  const target = join(root, 'pub')
  const good = { asOf: '2026-11-13', generatedAt: 'x', indices: Array.from({ length: 36 }, (_, i) => series(`I${i}`, ['2026-11-12', '2026-11-13'])) }
  fakeSource(source, good)
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'stale.png'), 'x')
  const r = publish({ source, target })
  assert.equal(r.indices, 36)
  assert.equal(r.unchanged, false)
  assert.equal(publish({ source, target }).unchanged, true)
  assert.deepEqual(r.removed, ['stale.png'])
  assert.deepEqual(check({ source, target }), [])

  const worse = structuredClone(good)
  worse.indices[0].pe = [1, null]
  writeFileSync(join(source, 'data-bundle.js'), bundleText(worse))
  assert.throws(() => publish({ source, target }), /退化/)
  assert.match(readFileSync(join(target, 'data-bundle.js'), 'utf8'), /"pe":\[1,1\]/, '退化时保留旧数据包')

  writeFileSync(join(source, 'app.js'), '/* changed */')
  assert.ok(check({ source, target }).some(p => p.includes('app.js 与源目录不一致')))

  const fresh = join(root, 'fresh')
  mkdirSync(fresh)
  assert.equal(restore({ source: fresh, target }).restored, true)
  assert.ok(existsSync(join(fresh, 'data-bundle.js')))
  assert.equal(restore({ source: fresh, target }).restored, false)
})

test('仓库内的发布目录与源目录一致，数据包有效', () => {
  assert.ok(existsSync(join(PUBLIC_DIR, 'index.html')), 'public/index-panorama/index.html 存在')
  assert.deepEqual(check(), [])
})
