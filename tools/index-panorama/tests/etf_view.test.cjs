// 相关 ETF 区块（etf-view.js）+ 详情/首页接入回归。
// 在 node:vm 中加载真实 analytics.js / etf-view.js / detail.js / home.js；下列 ETF 条目全部是合成 fixture
// （代码、名称、链接都是虚构的，example.com 域名），只存在于本测试，不是产品目录。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = path.join(__dirname, '..');

function makeEl(tag) {
  return {
    tagName: String(tag || 'div').toUpperCase(), className: '', innerHTML: '', parentNode: null, children: [], listeners: {},
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    contains() { return false; }, getAttribute() { return null; }, focus() {}
  };
}
function loadEnv(catalog) {
  const win = { console, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} };
  win.window = win;
  win.document = { createElement: makeEl, activeElement: null };
  if (catalog !== undefined) win.PANO_ETFS = catalog;
  vm.createContext(win);
  for (const f of ['analytics.js', 'etf-view.js', 'detail.js', 'home.js']) {
    vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), win, { filename: f });
  }
  return win;
}
const XSS = '<img src=x onerror=alert(1)>';
const P = (over) => Object.assign({
  code: '510001', name: '合成直接ETF', exchange: 'SH', relationship: 'tracks', benchmarkCode: '000994', benchmarkName: '合成指数',
  sourceUrl: 'https://example.com/p/510001', sourceTitle: '基金公司产品页', verifiedAt: '2026-11-16'
}, over);
const CATALOG = {
  schemaVersion: 1, verifiedAt: '2026-11-16T09:00:00+08:00',
  indices: {
    'AAA.SH': { name: '有直接', notes: '备注 ' + XSS, products: [
      P({ benchmarkCode: 'AAA.CSI' }),
      P({ code: '159002', exchange: 'SZ', relationship: 'related_theme', benchmarkCode: '931160', benchmarkName: '合成设备指数', relationNote: '主题相近' }),
      P({ code: '159003', sourceUrl: 'http://example.com/insecure' }),
      P({ code: '159004', verifiedAt: '' }),
      P({ code: '159005', sourceUrl: 'javascript:alert(1)' }),
      P({ code: '159006', name: XSS, benchmarkCode: 'AAA' })
    ] },
    // 标了 tracks 但实际跟踪别的指数：只能当相关主题，不计入直接数
    'BBB.SH': { name: '只有相关', notes: '', products: [P({ code: '515880', benchmarkCode: '931160', benchmarkName: '合成通信设备' })] },
    'CCC.SH': { name: '空', notes: '尚无产品', products: [] },
    'DJI.US': { name: '别名', notes: '', benchmarkAliases: ['DJIA'], products: [P({ code: '513400', benchmarkCode: 'DJIA', benchmarkName: '道琼斯工业平均指数' })] }
  }
};
const W = loadEnv(CATALOG);
const E = W.PanoEtf;

test('分组：直接只认 tracks 且基准代码一致；缺来源/非 https/缺核验日期不出列表', () => {
  const g = E.groupsFor('AAA.SH');
  assert.deepEqual([...g.direct.map((p) => p.code)], ['510001', '159006']);
  assert.deepEqual([...g.related.map((p) => p.code)], ['159002']);
  assert.equal(g.hidden, 3);
  assert.equal(E.directCount('AAA.SH'), 2);
  assert.equal(g.direct[0].exchange, '上交所');
});

test('标 tracks 但跟踪其他指数 → 降为相关主题，直接数为 0，并说实话', () => {
  assert.equal(E.directCount('BBB.SH'), 0);
  const html = E.sectionHtml({ code: 'BBB.SH', name: '只有相关' });
  assert.match(html, /暂无已核实的直接跟踪 ETF：没有找到跟踪「只有相关」/);
  assert.match(html, /相关主题（跟踪其他指数）/);
  assert.match(html, /实际跟踪 合成通信设备（931160），不是本指数/);
});

test('无条目 / 空产品 / 目录未加载 都给出实话空态', () => {
  assert.match(E.sectionHtml({ code: 'CCC.SH', name: '空' }), /暂无已核实的直接跟踪/);
  assert.match(E.sectionHtml({ code: 'CCC.SH', name: '空' }), /尚无产品/);
  assert.match(E.sectionHtml({ code: 'ZZZ.SH', name: '未收录' }), /暂无已核实的直接跟踪/);
  const W2 = loadEnv(undefined);
  assert.match(W2.PanoEtf.sectionHtml({ code: 'AAA.SH', name: 'x' }), /ETF 目录未加载/);
  assert.equal(W2.PanoEtf.directCount('AAA.SH'), 0);
  const W3 = loadEnv({ schemaVersion: 2, indices: CATALOG.indices });
  assert.equal(W3.PanoEtf.directCount('AAA.SH'), 0);
});

test('外链：https、新窗口、noopener noreferrer；内容转义；有复制按钮与核验日期；无收益/买卖字样', () => {
  const html = E.sectionHtml({ code: 'AAA.SH', name: '有直接' });
  assert.match(html, /href="https:\/\/example\.com\/p\/510001" target="_blank" rel="noopener noreferrer external"/);
  assert.doesNotMatch(html, /http:\/\/example|javascript:/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /data-pe-copy="510001"/);
  assert.match(html, /核验于 2026-11-16/);
  assert.match(html, /3 条记录缺少官方来源或核验日期，未展示/);
  assert.doesNotMatch(html, /收益率|买入|卖出|推荐购买/);
  // 直接组在相关组之前
  assert.ok(html.indexOf('直接跟踪本指数') < html.indexOf('相关主题（跟踪其他指数）'));
});

test('搜索文本包含相关 ETF 代码与名称', () => {
  assert.ok(E.searchText('AAA.SH').includes('159002'));
  assert.equal(E.searchText('CCC.SH'), '');
});

test('详情页：ETF 区块在主图与其他侧面之后、来源与覆盖之前', () => {
  const d = ['2026-11-13', '2026-11-16'];
  const s = { code: 'AAA.SH', name: '有直接', category: '行业指数', sources: {}, warnings: [], d };
  for (const f of ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume']) s[f] = [null, null];
  s.price = [1000, 1001];
  const c = makeEl('div');
  W.PanoDetail.render(c, s, {});
  const html = c.children[0].innerHTML;
  W.PanoDetail.dispose();
  const iMain = html.indexOf('pd-main'), iEtf = html.indexOf('id="pd-etf"'), iCov = html.indexOf('pd-cov');
  assert.ok(iMain >= 0 && iEtf > iMain && iCov > iEtf, '顺序：主图 → ETF → 来源与覆盖');
  assert.ok(html.indexOf('这只指数的其他侧面') < iEtf);
});

test('首页榜单：只给有直接 ETF 的指数显示数量入口，related 不计入', () => {
  const d = ['2026-11-13', '2026-11-16'];
  const mk = (code, name) => {
    const s = { code, name, category: '行业指数', sources: {}, warnings: [], d };
    for (const f of ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume']) s[f] = [null, null];
    s.price = [1000, 1001];
    return s;
  };
  const c = makeEl('div');
  W.PanoHome.render(c, [mk('AAA.SH', '有直接'), mk('BBB.SH', '只有相关'), mk('CCC.SH', '空')], { range: '10', anchor: '2026-11-16' });
  const html = c.innerHTML;
  W.PanoHome.dispose();
  assert.match(html, /data-action="open-etf" data-code="AAA\.SH"[^>]*>ETF 2</);
  assert.doesNotMatch(html, /data-action="open-etf" data-code="BBB\.SH"/);
  assert.doesNotMatch(html, /data-action="open-etf" data-code="CCC\.SH"/);
});

test('benchmarkAliases：本地代码与官方代码不同（DJI.US ↔ DJIA）仍算直接跟踪', () => {
  assert.equal(E.directCount('DJI.US'), 1);
  assert.equal(E.directCount('CCC.SH'), 0);
});

test('产品多于 5 只时只显示前 4 只，其余折叠，保持目录顺序', () => {
  const many = { schemaVersion: 1, verifiedAt: '2026-11-16', indices: { 'M.SH': { products: Array.from({ length: 7 }, (_, i) => P({ code: '51000' + i, benchmarkCode: 'M' })) } } };
  const html = loadEnv(many).PanoEtf.sectionHtml({ code: 'M.SH', name: '多' });
  assert.match(html, /展开其余 3 只（按目录顺序，非排名）/);
  const order = [...html.matchAll(/data-pe-copy="(\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['510000', '510001', '510002', '510003', '510004', '510005', '510006']);
});

test('sameIndex 与发布脚本一致：后缀不相容不算同一指数；相关主题永不计入直接', () => {
  assert.equal(E.sameIndex('000994.SH', '000994.CSI'), true);
  assert.equal(E.sameIndex('000001.SH', '000001.HK'), false);
  assert.equal(E.sameIndex('000300.SH', '399300'), false);
  const W4 = loadEnv({ schemaVersion: 1, verifiedAt: '2026-11-16', indices: {
    '000300.SH': { benchmarkAliases: ['399300'], products: [
      P({ code: '159919', exchange: 'SZ', benchmarkCode: '399300' }),
      P({ code: '510300', benchmarkCode: '000300' }),
      P({ code: '159999', exchange: 'SZ', relationship: 'related_theme', benchmarkCode: '000300' }),
      P({ code: '510999', benchmarkCode: '000300.HK' })
    ] }
  } });
  const g = W4.PanoEtf.groupsFor('000300.SH');
  assert.deepEqual([...g.direct.map((p) => p.code)], ['159919', '510300']);
  assert.deepEqual([...g.related.map((p) => p.code)], ['159999', '510999']);
});
