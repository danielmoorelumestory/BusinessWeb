import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDataset, classifyHolder, disclosureOpen, fetchPeriodRows, findUnclassified,
  matureEnds, quarterEnds, summarizePeriod,
} from './lib/national-team.mjs'

test('classifyHolder 识别真实国家队名称', () => {
  const cases = {
    中央汇金投资有限责任公司: '中央汇金',
    中央汇金资产管理有限责任公司: '汇金资管',
    '华夏基金-中央汇金资产管理有限责任公司-华夏基金-汇金资管单一资产管理计划': '汇金资管',
    中国证券金融股份有限公司: '证金公司',
    全国社保基金四一三组合: '社保基金',
    全国社保一一零组合: '社保基金',
    '招商基金管理有限公司-社保基金1903组合': '社保基金',
    全国社会保障基金理事会: '社保基金',
    全国社会保障基金理事会转持一户: '社保基金',
    基本养老保险基金八零二组合: '养老基金',
    国新投资有限公司: '国新投资',
    国家集成电路产业投资基金股份有限公司: '大基金',
    '华芯投资管理有限责任公司-国家集成电路产业投资基金二期股份有限公司': '大基金',
    国家集成电路产业投资基金二期股份有限公司: '大基金',
  }
  for (const [name, group] of Object.entries(cases)) assert.equal(classifyHolder(name), group, name)
})

test('classifyHolder 兼容全角连字符（新浪口径）', () => {
  assert.equal(classifyHolder('华夏基金－中央汇金资产管理有限责任公司－华夏基金－汇金资管单一资产管理计划'), '汇金资管')
  assert.equal(classifyHolder('招商基金管理有限公司－社保基金1903组合'), '社保基金')
})

test('classifyHolder 不误伤名称含相近字样的非国家队（实测出现过的名称）', () => {
  const notNt = [
    '中国建设银行股份有限公司-华宝中证金融科技主题交易型开放式指数证券投资基金',
    '嘉实基金-农业银行-嘉实中证金融资产管理计划',
    '深圳证金投资管理有限公司-证金私客尊享二期私募证券投资基金',
    '国新宏盛投资(北京)有限公司',
    '徐国新',
    '国新证券股份有限公司',
    '中国工商银行股份有限公司-广发中证国新央企股东回报交易型开放式指数证券投资基金',
    '陕西省集成电路产业投资基金(有限合伙)',
    '上海集成电路产业投资基金股份有限公司',
    '海南致衍私募基金管理合伙企业(有限合伙)-致衍梧桐树2号私募证券投资基金',
    '杭州博海汇金资产管理有限公司-博海汇金增盈36号证券私募投资基金',
    '平安养老保险股份有限公司-传统-普通保险产品',
    '国泰佳泰股票专项型养老金产品-招商银行股份有限公司',
    '上海国有资本投资有限公司-委托管理划转社保国有股权基金专户',
    '',
    null,
  ]
  for (const name of notNt) assert.equal(classifyHolder(name), '', String(name))
})

test('quarterEnds 与 disclosureOpen', () => {
  assert.deepEqual(quarterEnds('2025-06-30', '2026-04-10'), ['2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31'])
  assert.equal(disclosureOpen('2026-09-30', '2026-10-10'), false)
  assert.equal(disclosureOpen('2026-06-30', '2026-10-10'), true)
})

const row = (code, name, holder, rank, num, ratio, mv, type = '其他') => ({
  SECURITY_CODE: code, SECURITY_NAME_ABBR: name, HOLDER_NAME: holder, HOLDER_RANK: rank,
  HOLD_NUM: num, HOLD_RATIO: ratio, HOLDER_MARKET_CAP: mv, HOLDER_NEWTYPE: type,
})

test('summarizePeriod 汇总国家队行并保留命中股的完整十大', () => {
  const rows = [
    row('000001', '平安银行', '中央汇金资产管理有限责任公司', 1, 100, 1.5, 1000),
    row('000001', '平安银行', '某某私募', 2, 50, 0.7, 500),
    row('000002', '万科', '某某私募', 1, 10, 0.1, 10),
  ]
  const s = summarizePeriod('2026-06-30', rows)
  assert.equal(s.coverage, 2)
  assert.equal(s.nt.length, 1)
  assert.equal(s.nt[0].group, '汇金资管')
  assert.equal(s.top10['000001'].length, 2)
  assert.equal(s.top10['000002'], undefined)
})

test('findUnclassified 列出东财标为国家队但规则未识别的名称', () => {
  const rows = [
    row('1', 'a', '全国社保基金一一四组合', 1, 1, 1, 1, '社保'),
    row('2', 'b', '某新国家队机构', 1, 1, 1, 1, '国家队'),
    row('3', 'c', '普通基金', 1, 1, 1, 1, '基金'),
  ]
  assert.deepEqual(findUnclassified(rows), [{ holder: '某新国家队机构', count: 1 }])
})

test('matureEnds 过滤覆盖骤降的未披露完整期', () => {
  const p = (end, coverage, n = 1) => ({ end, coverage, nt: Array(n).fill({}) })
  assert.deepEqual(matureEnds([p('a', 5000), p('b', 5100), p('c', 300), p('d', 5200)]), ['a', 'b', 'd'])
  assert.deepEqual(matureEnds([p('a', 5000), p('b', 5100, 0)]), ['a'])
})

test('fetchPeriodRows 校验行数与唯一性', async () => {
  const mk = (data, count = 3, pages = 1) => async () => ({
    ok: true, json: async () => ({ success: true, result: { count, pages, data } }),
  })
  const good = [row('1', 'a', 'x', 1, 1, 1, 1), row('1', 'a', 'y', 2, 1, 1, 1), row('2', 'b', 'x', 1, 1, 1, 1)]
  assert.equal((await fetchPeriodRows('2026-06-30', { fetchImpl: mk(good) })).length, 3)
  await assert.rejects(fetchPeriodRows('2026-06-30', { fetchImpl: mk(good.slice(0, 2)) }), /行数不符/)
  // 少量源数据重复：去重后通过
  const few = [good[0], good[0], good[2]]
  assert.equal((await fetchPeriodRows('2026-06-30', { fetchImpl: mk(few) })).length, 2)
  // 大量重复（分页错乱的特征）：拒绝
  const many = Array.from({ length: 60 }, () => good[0])
  await assert.rejects(fetchPeriodRows('2026-06-30', { fetchImpl: mk(many, 60) }), /大量重复/)
})

test('buildDataset 点位聚合、较上期、退出个股只留历史', () => {
  const nt = (code, name, group, mv, ratio = 1) => ({ code, name, holder: group, group, rank: 1, num: 10, ratio, mv })
  const periods = [
    { end: '2026-03-31', coverage: 5000, nt: [nt('A', '甲', '中央汇金', 100), nt('B', '乙', '社保基金', 40)], top10: {} },
    { end: '2026-06-30', coverage: 5000, nt: [nt('A', '甲', '中央汇金', 150, 2), nt('A', '甲', '证金公司', 50, 1), nt('C', '丙', '养老基金', 10)], top10: { A: [{ rank: 1 }] } },
  ]
  const industry = { A: { primary: '银行' }, B: { primary: '食品' } }
  const d = buildDataset(periods, industry, { generatedAt: 't' })
  assert.equal(d.meta.reportDate, '2026-06-30')
  assert.equal(d.stocks.length, 2) // B 已退出，不进快照
  const a = d.stocks.find(s => s.c === 'A')
  assert.equal(a.mv, 200)
  assert.equal(a.mvPrev, 100)
  assert.equal(a.ratio, 3)
  assert.deepEqual(a.groups.sort(), ['中央汇金', '证金公司'])
  assert.equal(d.stocks.find(s => s.c === 'C').isNew, true)
  assert.equal(d.history.B.mv[0], 40) // 退出个股历史保留
  assert.equal(d.series.industries['食品'].mv[0], 40)
  assert.equal(d.series.industries['食品'].mv[1], 0)
  assert.equal(d.series.industries['未分类'].mv[1], 10)
  assert.equal(d.series.groups['中央汇金'].n[1], 1)
  assert.deepEqual(d.top10.A, [{ rank: 1 }])
  assert.equal(a.numPrev, 10)
  assert.deepEqual(d.changes.newEntries.map(x => x.c), ['C'])
  assert.deepEqual(d.changes.exited.map(x => x.c), ['B'])
  assert.deepEqual(d.changes.increased.map(x => x.c), ['A']) // 持股数 10 → 20
})

test('buildDataset 可只保留核心机构', () => {
  const nt = (code, group, mv) => ({ code, name: code, holder: group, group, rank: 1, num: 1, ratio: 1, mv })
  const periods = [{ end: '2026-06-30', coverage: 5000, nt: [nt('A', '中央汇金', 100), nt('B', '养老基金', 50)], top10: {} }]
  const d = buildDataset(periods, {}, { generatedAt: 't', includeExtended: false })
  assert.deepEqual(d.stocks.map(s => s.c), ['A'])
})

test('已发布数据不含误伤持有人且口径自洽', async () => {
  const { readFileSync, existsSync } = await import('node:fs')
  const file = new URL('../public/data/national-team/stocks.json', import.meta.url)
  if (!existsSync(file)) return
  const stocks = JSON.parse(readFileSync(file, 'utf8'))
  assert.ok(stocks.length > 300, '个股数量异常偏少')
  for (const s of stocks) {
    for (const h of s.holders) assert.notEqual(classifyHolder(h.h), '', `${s.c} ${h.h} 不应被认作国家队`)
  }
})
