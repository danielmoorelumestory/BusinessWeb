import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildEtfDataset, classifyTheme, fetchEtfUniverse, fetchNationalTeamHolders, parseKlineClose, parseReportDates, parseSzseRow, parseUniverseRow, pickNationalTeam,
} from './lib/national-team-etf.mjs'

test('parseUniverseRow 还原价格小数位', () => {
  assert.deepEqual(parseUniverseRow({ f1: 3, f2: 1484, f12: '589990', f13: 1, f14: '科创综指ETF', f20: 169309560 }),
    { code: '589990', name: '科创综指ETF', market: 'sh', price: 1.484, scale: 169309560 })
  assert.equal(parseUniverseRow({ f12: '' }), null)
  assert.equal(parseUniverseRow({ f1: 3, f2: '-', f12: '159001', f13: 0, f14: 'x' }).price, null)
})

test('parseReportDates 去重并新到旧排序', () => {
  const html = '<option value="2024-12-31"><option value="2025-06-30"><option value="2025-06-30">'
  assert.deepEqual(parseReportDates(html), ['2025-06-30', '2024-12-31'])
})

test('pickNationalTeam 只留国家队，兼容新浪全角连字符', () => {
  const rows = [
    { cyrmc: '中央汇金资产管理有限责任公司', cyfe: '37858500000', zfeb: '42.62' },
    { cyrmc: '中央汇金投资有限责任公司', cyfe: '35654600000', zfeb: '40.14' },
    { cyrmc: '友邦人寿保险有限公司－传统', cyfe: '259346000', zfeb: '0.29' },
    { cyrmc: '', cyfe: '1', zfeb: '1' },
  ]
  const nt = pickNationalTeam(rows)
  assert.deepEqual(nt.map(r => r.g), ['汇金资管', '中央汇金'])
  assert.equal(nt[0].shares, 37858500000)
  assert.equal(nt[0].ratio, 42.62)
  assert.deepEqual(pickNationalTeam(undefined), [])
})

test('fetchNationalTeamHolders 解析接口返回', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ result: { data: [{ cyrmc: '中国证券金融股份有限公司', cyfe: '100', zfeb: '1.5' }] } }) })
  const nt = await fetchNationalTeamHolders('510300', '2025-12-31', { fetchImpl })
  assert.equal(nt[0].g, '证金公司')
})

test('classifyTheme 按名称归主题', () => {
  const cases = {
    沪深300ETF华泰柏瑞: '宽基', 券商ETF: '证券保险', 银行ETF: '银行', 半导体ETF: '半导体电子', 创新药ETF: '医药生物',
    国债ETF: '债券货币', 黄金ETF: '黄金商品', 恒生科技ETF: '港股海外', 红利低波ETF: '红利价值', 光伏ETF: '新能源电力',
    军工ETF: '军工制造', 人工智能ETF: '人工智能软件', 城投ETF: '债券货币', 有色ETF: '黄金商品', 科创ETF: '宽基', '180ETF': '宽基', 某某ETF: '其他',
  }
  for (const [name, theme] of Object.entries(cases)) assert.equal(classifyTheme(name), theme, name)
})

test('buildEtfDataset 汇总在持/退出、持有市值与较上期', () => {
  const nt = (shares, ratio) => [{ g: '中央汇金', h: 'x', shares, ratio }]
  const universe = [
    { code: '510300', name: '沪深300ETF', price: 4, scale: 1e11 },
    { code: '510500', name: '中证500ETF', price: 6, scale: 5e10 },
    { code: '159001', name: '货币ETF', price: 100, scale: 1e9 },
  ]
  const cache = {
    510300: { '2025-06-30': nt(100, 40), '2025-12-31': nt(150, 42) },
    510500: { '2025-06-30': nt(50, 20), '2025-12-31': [] },
    159001: { '2025-12-31': [] },
  }
  const d = buildEtfDataset(universe, cache, { generatedAt: 't' })
  assert.equal(d.etfs.length, 2) // 159001 从没出现过国家队，不输出
  const a = d.etfs.find(e => e.c === '510300')
  assert.equal(a.status, 'hold')
  assert.equal(a.mv, 600)
  assert.equal(a.prev.shares, 100)
  assert.equal(d.etfs.find(e => e.c === '510500').status, 'exited')
  assert.equal(d.meta.numHolding, 1)
  assert.equal(d.meta.numExited, 1)
  assert.equal(d.meta.totalMv, 600)
  assert.deepEqual(d.meta.dates, ['2025-06-30', '2025-12-31'])
  assert.equal(d.meta.themes[0].theme, '宽基')
})

test('parseSzseRow 从深交所返回的 HTML 片段取代码与简称', () => {
  const row = {
    sys_key: "<a href='http://www.szse.cn/market/trend/index.html?code=158030'><u>158030</u></a>",
    kzjcurl: "<a href='x' title='点击简称查询公告'><u>航空航天ETF汇添富</u></a> <a href='y'><img/></a>",
  }
  assert.deepEqual(parseSzseRow(row), { code: '158030', name: '航空航天ETF汇添富', market: 'sz', price: null, scale: null })
  assert.equal(parseSzseRow({}), null)
})

test('parseKlineClose 取最后一根 K 线收盘价', () => {
  const text = "/*<script>location.href='//sina.com';</script>*/\nvar _data=([{\"day\":\"2026-10-08\",\"close\":\"4.389\"},{\"day\":\"2026-10-09\",\"close\":\"4.385\"}]);"
  assert.equal(parseKlineClose(text), 4.385)
  assert.equal(parseKlineClose('garbage'), null)
})

// 按 URL 片段返回结果；未命中的上游一律连接失败。
const universeFetch = routes => async url => {
  const hit = Object.entries(routes).find(([part]) => String(url).includes(part))
  if (!hit) throw new Error('connect ETIMEDOUT')
  return new Response(JSON.stringify(hit[1]), { status: 200 })
}
const eastmoneyPage = { data: { total: 1, diff: [{ f1: 3, f2: 1484, f12: '510300', f13: 1, f14: '沪深300ETF', f20: 100 }] } }
const ssePage = { result: [{ SEC_CODE: '510300', SEC_NAME: '沪深300ETF' }] }
const known = [{ code: '159915', name: '创业板ETF', market: 'sz', price: null, scale: 5 }]

test('fetchEtfUniverse 东方财富主域名失败时改用备用域名', async () => {
  const { list, source } = await fetchEtfUniverse({ fetchImpl: universeFetch({ 'push2delay.eastmoney.com': eastmoneyPage }), known })
  assert.equal(source, '东方财富')
  assert.deepEqual(list.map(item => item.code), ['510300'])
})

test('fetchEtfUniverse 深交所不可用时保留上交所结果，并用上次发布清单补齐', async () => {
  const { list, source } = await fetchEtfUniverse({ fetchImpl: universeFetch({ 'query.sse.com.cn': ssePage }), known })
  assert.equal(source, '交易所（部分）+上次发布清单')
  assert.deepEqual(list.map(item => item.code).sort(), ['159915', '510300'])
})

test('fetchEtfUniverse 交易所清单不覆盖已知 ETF 的全称和规模', async () => {
  const fullNames = [{ code: '510300', name: '沪深300ETF华泰柏瑞', market: 'sh', price: null, scale: 100 }]
  const { list } = await fetchEtfUniverse({ fetchImpl: universeFetch({ 'query.sse.com.cn': ssePage }), known: fullNames })
  assert.deepEqual(list, fullNames)
})

test('fetchEtfUniverse 所有上游失败时退回上次发布清单', async () => {
  const { list, source } = await fetchEtfUniverse({ fetchImpl: universeFetch({}), known })
  assert.equal(source, '上次发布清单')
  assert.deepEqual(list, known)
})

test('fetchEtfUniverse 没有上次清单时，清单不完整就报错，避免丢失深市 ETF 名称', async () => {
  await assert.rejects(fetchEtfUniverse({ fetchImpl: universeFetch({ 'query.sse.com.cn': ssePage }) }), /ETF 清单不可用/)
})
