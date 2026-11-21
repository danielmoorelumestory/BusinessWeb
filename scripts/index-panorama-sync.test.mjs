import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PUBLIC_FILES, PUBLIC_DIR, check, compareBundles, directEtfCounts, publish, sameIndex, restore, sameObservations, validateBundle, validateEtfCatalog } from './index-panorama-sync.mjs'

const FIELDS = ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume', 'np']

function series(code, d, fill = 1) {
  const s = { code, d }
  for (const f of FIELDS) s[f] = d.map(() => fill)
  return s
}
const bundleText = data => `/* test */\nwindow.PANO_DATA=${JSON.stringify(data)};\n`
const etfText = cat => `/* test */\nwindow.PANO_ETFS=${JSON.stringify(cat)};\n`
// 测试 fixture：合成产品，不是真实目录
const product = (over = {}) => ({
  code: '510000', name: '测试ETF', exchange: 'SH', relationship: 'tracks', benchmarkCode: 'I0', benchmarkName: '测试指数',
  sourceUrl: 'https://example.com/fund/510000', sourceTitle: '基金公司产品页', verifiedAt: '2026-11-16', ...over,
})
const emptyCatalog = { schemaVersion: 1, verifiedAt: '2026-11-16', indices: {} }

function fakeSource(dir, data) {
  for (const f of PUBLIC_FILES) {
    mkdirSync(join(dir, f, '..'), { recursive: true })
    writeFileSync(join(dir, f), f === 'data-bundle.js' ? bundleText(data) : f === 'etf-catalog.js' ? etfText(emptyCatalog) : `/* ${f} */`)
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

test('validateEtfCatalog：合法目录无错误，直接 ETF 数不含相关主题', () => {
  const cat = { schemaVersion: 1, verifiedAt: '2026-11-16T08:00:00Z', indices: {
    'I0.SH': { name: '甲', notes: '', products: [product({ benchmarkCode: 'I0' }), product({ code: '159000', exchange: 'SZ', relationship: 'related_theme', benchmarkCode: 'X9' })] },
    'I1.SH': { name: '乙', notes: '无直接产品', products: [] },
  } }
  const { catalog, errors } = validateEtfCatalog(etfText(cat), { indexCodes: ['I0.SH', 'I1.SH'] })
  assert.deepEqual(errors, [])
  assert.deepEqual(directEtfCounts(catalog), { 'I0.SH': 1, 'I1.SH': 0 })
})

test('validateEtfCatalog：tracks 跟踪别的指数、缺来源/日期、非 https、重复、未知指数都报错', () => {
  const cat = { schemaVersion: 1, verifiedAt: '2026-11-16', indices: {
    'I0.SH': { products: [
      product({ benchmarkCode: '931160' }),
      product({ code: '159001', sourceUrl: 'http://example.com', verifiedAt: '' }),
      product({ code: '159001', sourceUrl: 'http://example.com', verifiedAt: '' }),
      product({ code: '159002', relationship: 'similar', sourceTitle: '' }),
    ] },
    'ZZ.SH': { products: [] },
  } }
  const { errors } = validateEtfCatalog(etfText(cat), { indexCodes: ['I0.SH'] })
  assert.ok(errors.some(e => e.includes('标为 tracks，但跟踪 931160')))
  assert.ok(errors.some(e => e.includes('sourceUrl 不是 https')))
  assert.ok(errors.some(e => e.includes('verifiedAt 不是 ISO')))
  assert.ok(errors.some(e => e.includes('重复产品 159001')))
  assert.ok(errors.some(e => e.includes('relationship 应为')))
  assert.ok(errors.some(e => e.includes('sourceTitle 为空')))
  assert.ok(errors.some(e => e.includes('ZZ.SH 不在数据包中')))
  assert.ok(validateEtfCatalog('window.X=1').errors[0].includes('PANO_ETFS'))
})

test('validateEtfCatalog：benchmarkAliases 让本地代码与官方代码不同的指数也能认定直接跟踪', () => {
  const cat = { schemaVersion: 1, verifiedAt: '2026-11-16', indices: {
    'DJI.US': { benchmarkAliases: ['DJIA'], products: [product({ benchmarkCode: 'DJIA' })] },
    'SPX.US': { products: [product({ benchmarkCode: 'DJIA' })] },
    'X.US': { benchmarkAliases: [''], products: [] },
  } }
  const { catalog, errors } = validateEtfCatalog(etfText(cat))
  assert.ok(!errors.some(e => e.startsWith('DJI.US')))
  assert.ok(errors.some(e => e.includes('SPX.US.products[0] 标为 tracks')))
  assert.ok(errors.some(e => e.includes('X.US.benchmarkAliases')))
  assert.equal(directEtfCounts(catalog)['DJI.US'], 1)
})

test('sameIndex：去后缀只在后缀相容时成立，不让无关市场的同号代码冲突', () => {
  assert.equal(sameIndex('000994.SH', '000994'), true)
  assert.equal(sameIndex('000994.SH', '000994.CSI'), true)
  assert.equal(sameIndex('H30184.CSI', 'H30184'), true)
  assert.equal(sameIndex('000001.SH', '000001.HK'), false)
  assert.equal(sameIndex('DJI.US', 'DJIA'), false)
  assert.equal(sameIndex('000300.SH', '399300'), false)
  assert.equal(sameIndex('', ''), false)
})

test('publish：ETF 目录无效时拒绝发布', () => {
  const root = mkdtempSync(join(tmpdir(), 'pano-etf-'))
  const source = join(root, 'src')
  const good = { asOf: '2026-11-13', generatedAt: 'x', indices: Array.from({ length: 36 }, (_, i) => series(`I${i}`, ['2026-11-13'])) }
  fakeSource(source, good)
  writeFileSync(join(source, 'etf-catalog.js'), etfText({ ...emptyCatalog, indices: { 'I0': { products: [product({ benchmarkCode: '931160' })] } } }))
  assert.throws(() => publish({ source, target: join(root, 'pub') }), /ETF 目录无效/)
  assert.equal(existsSync(join(root, 'pub', 'index.html')), false)
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
