// 稀疏样本 / 来源声明频率 / 来源原因 渲染回归（round2 sparse-ui）
// 在 node:vm 中以最小 DOM stub 加载真实 analytics.js + detail.js + home.js，断言渲染出的 HTML。
// 下列序列全部是测试 fixture（合成值），只存在于本测试，不写入生产 bundle。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = path.join(__dirname, '..');

function makeEl(tag) {
  return {
    tagName: String(tag || 'div').toUpperCase(), className: '', innerHTML: '', parentNode: null, children: [],
    listeners: {},
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    contains() { return false; }, getAttribute() { return null; }, focus() {}
  };
}
function loadEnv() {
  const win = { console, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} };
  win.window = win;
  win.document = { createElement: makeEl, activeElement: null };
  vm.createContext(win);
  for (const f of ['analytics.js', 'detail.js', 'home.js']) {
    vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), win, { filename: f });
  }
  return win;
}
const W = loadEnv();

const FIELDS = ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume'];
// 构造 fixture：dates 为日期轴，cols 为 {field:{date:value}}
function fixture(code, name, category, dates, cols, extra) {
  const s = Object.assign({ code, name, category, description: '', sources: {}, warnings: [], d: dates.slice() }, extra || {});
  for (const f of FIELDS) s[f] = dates.map((d) => (cols[f] && d in cols[f] ? cols[f][d] : null));
  return s;
}
function dailyDates(start, n) {
  const out = []; const t = new Date(start + 'T00:00:00Z');
  while (out.length < n) {
    const wd = t.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(t.toISOString().slice(0, 10));
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}
const DATES = dailyDates('2025-11-03', 260); // 约一年交易日
const LAST = DATES[DATES.length - 1];
function priceCol() { const o = {}; DATES.forEach((d, i) => { o[d] = 3000 + i; }); return o; }
function amtCol() { const o = {}; DATES.forEach((d, i) => { o[d] = 1000 + (i % 50) * 10; }); return o; }
const XSS = '<img src=x onerror=alert(1)>';

// count=0：pe/pb/dy/amt 全无，availability 带原因（含 HTML 特殊字符）
const S0 = fixture('000001.SH', '上证指数', '全局坐标', DATES, { price: priceCol() }, {
  availability: {
    pe: { status: 'unavailable', frequency: null, reason: 'domestic: 官方文件 403 ' + XSS + '；supplemental: 无此指数',
      candidates: [{ provider: 'domestic', status: 'rejected', count: 0, reason: '单位不符 ' + XSS }] },
    amt: { status: 'unavailable', reason: '腾讯未返回成交额' },
    componentNum: { status: 'unavailable', reason: '无带日期与来源的成分股数披露' }
  }
});
// count=1：pe/pb/dy/amt 各只有最新一期
const S1 = fixture('399001.SZ', '深证成指', '全局坐标', DATES, {
  price: priceCol(), pe: { [LAST]: 23.4 }, pb: { [LAST]: 2.6 }, dy: { [LAST]: 1.9 }, amt: { [LAST]: 5321 }
}, {
  sources: { pe: { label: 'fixture-src', url: 'https://example.com/pe', unit: '倍', method: '测试口径', frequency: 'single' } },
  availability: { pe: { status: 'ok', frequency: 'single', reason: '' } }
});
// count>=2 月频：pe 每月一期（来源声明 monthly，避免被估成日频），pb/dy/amt 日频多样本
function monthly(vals) { const o = {}; const ds = DATES.filter((d, i) => i === DATES.length - 1 || DATES[i + 1].slice(0, 7) !== d.slice(0, 7)); ds.forEach((d, i) => { o[d] = vals(i); }); return o; }
function dailyVals(fn) { const o = {}; DATES.forEach((d, i) => { o[d] = fn(i); }); return o; }
const S2 = fixture('399006.SZ', '创业板指', '全局坐标', DATES, {
  price: priceCol(), pe: monthly((i) => 30 + i), pb: dailyVals((i) => 3 + i / 1000), dy: dailyVals((i) => 1 + i / 1000), amt: amtCol()
}, {
  sources: { pe: { label: 'fixture-monthly', url: 'https://example.com/m', unit: '倍', method: '月末', frequency: 'monthly' } }
});
// 多样本但无来源频率声明：按间隔估计
const S2b = fixture('000688.SH', '科创50', '全局坐标', DATES, { price: priceCol(), pe: dailyVals((i) => 50 + i / 10) });
// 跨境：单期 PE
const HK = fixture('HSI.HK', '恒生指数', '跨境对照', DATES, { price: priceCol(), pe: { [LAST]: 10.2 } });
const REF = fixture('000300.SH', '沪深300', '核心宽基', DATES, { price: priceCol(), pe: dailyVals((i) => 12 + i / 100) });

function renderDetail(series, metric, range) {
  const c = makeEl('div');
  W.PanoDetail.render(c, series, { metric: metric || 'pe', range: range || '10' });
  const html = c.children[0].innerHTML;
  W.PanoDetail.dispose();
  return html;
}
function renderHome(list) {
  const c = makeEl('div');
  W.PanoHome.render(c, list, { range: '10', anchor: LAST });
  const html = c.innerHTML;
  W.PanoHome.dispose();
  return html;
}
function section(html, cls) {
  const i = html.indexOf('class="pd-card ' + cls);
  assert.ok(i >= 0, '找不到区块 ' + cls);
  const j = html.indexOf('</section>', i);
  return html.slice(i, j);
}
function rowOf(html, code) {
  const i = html.indexOf('data-code="' + code + '"');
  assert.ok(i >= 0, '找不到行 ' + code);
  const a = html.lastIndexOf('<tr', i), b = html.indexOf('</tr>', i);
  return html.slice(a, b);
}

// ---------- 详情 ----------
test('详情 count=0：主卡/温度计保持空态，并给出简短原因；来源原因被转义', () => {
  const html = renderDetail(S0, 'pe');
  const main = section(html, 'pd-main');
  assert.match(main, /数据源未提供市盈率 PE字段/);
  assert.match(main, /原因：domestic: 官方文件 403/);
  assert.doesNotMatch(main, /历史分位/);
  assert.doesNotMatch(html, /<img src=x/, '原因中的 HTML 必须转义');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  const thermo = section(html, 'pd-thermo');
  assert.doesNotMatch(thermo, /role="meter"/);
  const turn = section(html, 'pd-turn');
  assert.match(turn, /数据源未提供成交额。 原因：腾讯未返回成交额/);
  const cov = section(html, 'pd-cov');
  assert.match(cov, /状态 · 原因/);
  assert.match(cov, /已拒收/);                // 候选状态
  assert.match(cov, /<details class="pd-reason-more"><summary>查看原因<\/summary>/);
  assert.match(cov, /成分股数/);
  assert.match(cov, /无带日期与来源的成分股数披露/);
  // 收盘点位行仍正常：某列缺数不隐藏整表
  assert.match(cov, /收盘点位<span class="pd-muted"> price<\/span>/);
  assert.match(cov, new RegExp('>' + DATES.length + '<'));
});

test('详情 count=1：显示真实最新值/日期，但不显示 100% 分位、20/80 带、冷热与图', () => {
  for (const m of ['pe', 'pb', 'dy']) {
    const html = renderDetail(S1, m);
    const main = section(html, 'pd-main');
    assert.match(main, new RegExp('日期 ' + LAST));
    assert.match(main, /仅单期 · 历史样本不足/);
    assert.doesNotMatch(main, /100\.00%/, m + ' 主卡不得把单期 ECDF=100% 当分位');
    assert.doesNotMatch(main, /20% \/ 80% 分位/);
    assert.doesNotMatch(main, /data-pd-chart="main"/);
    assert.match(main, /区间内实际 1 个样本，覆盖 /);
  }
  const html = renderDetail(S1, 'pe');
  assert.match(section(html, 'pd-main'), /23\.40 倍/);
  assert.match(section(html, 'pd-main'), /单期（来源声明）/);
  const thermo = section(html, 'pd-thermo');
  assert.doesNotMatch(thermo, /role="meter"/);
  const rowsOnly = thermo.slice(0, thermo.indexOf('<p class="pd-foot">'));
  assert.doesNotMatch(rowsOnly, /pd-zone|偏冷|偏热|中性/);
  assert.equal((thermo.match(/不评冷热/g) || []).length, 3);
  const turn = section(html, 'pd-turn');
  assert.match(turn, /5,321\.00 亿元/);
  assert.match(turn, /成交额历史分位/);
  assert.match(turn, /仅单期 · 历史样本不足/);
  assert.doesNotMatch(turn, /100\.00%/);
  assert.doesNotMatch(turn, /data-pd-chart="turn"/);
  assert.match(section(html, 'pd-cov'), /可用 · 仅单期/);
});

test('详情 count>=2：保持原分位/20-80/温度计行为，月频按来源声明而非日频', () => {
  const html = renderDetail(S2, 'pe');
  const main = section(html, 'pd-main');
  assert.match(main, /历史分位/);
  assert.match(main, /100\.00%/);           // 单调递增 fixture，最新值确为区间最高
  assert.match(main, /20% \/ 80% 分位/);
  assert.match(main, /data-pd-chart="main"/);
  assert.match(main, /月频（来源声明）/);
  assert.doesNotMatch(main, /约日频/);
  assert.match(main, /区间内实际 1[23] 个样本/);
  assert.match(main, /所选近10年，但样本自 \d{4}-\d{2}-\d{2} 才开始/);
  const thermo = section(html, 'pd-thermo');
  assert.equal((thermo.match(/role="meter"/g) || []).length, 3);
  assert.match(thermo, /月频/);
  const turn = section(html, 'pd-turn');
  assert.match(turn, /data-pd-chart="turn"/);
  assert.match(turn, /260 个样本 · 约日频（按观测间隔估计）/);
  assert.match(section(html, 'pd-cov'), /月频（来源声明）/);
});

test('详情：无频率声明时才按间隔估计', () => {
  const html = renderDetail(S2b, 'pe');
  assert.match(section(html, 'pd-main'), /约日频（按观测间隔估计）/);
});

test('详情：availability.frequency 在 sources 无声明时生效；sources 优先', () => {
  const a = Object.assign({}, S2b, { availability: { pe: { status: 'ok', frequency: 'weekly' } } });
  assert.match(section(renderDetail(a, 'pe'), 'pd-main'), /周频（来源声明）/);
  const b = Object.assign({}, a, { sources: { pe: { label: 'x', frequency: 'quarterly' } } });
  assert.match(section(renderDetail(b, 'pe'), 'pd-main'), /季频（来源声明）/);
});

// ---------- 首页 ----------
test('首页四大盘：count0 暂无、count1 显示最新值+单期、count>=2 显示分位与频率', () => {
  const html = renderHome([S0, S1, S2, S2b, REF, HK]);
  const cards = html.slice(html.indexOf('id="hMain"'), html.indexOf('id="hRank"'));
  assert.match(cards, /PE 暂无数据/);
  assert.match(cards, new RegExp('PE 23\\.40（' + LAST + '）· 仅单期·历史样本不足'));
  assert.doesNotMatch(cards, /（n=1）/);
  assert.match(cards, /近10年分位 100\.0%（n=1[23] 月频）/);
  assert.match(cards, /近10年分位 100\.0%（n=260）/);
});

test('首页榜单：单期不画分位条/冷热色、排序置后；多样本保持', () => {
  const all = renderHome([S0, S1, S2, S2b, REF, HK]);
  const html = all.slice(all.indexOf('id="hRank"'), all.indexOf('id="hHeat"'));
  const r1 = rowOf(html, '399001.SZ');
  assert.match(r1, /仅单期·历史样本不足/);
  assert.match(r1, /n=1 单期/);
  assert.doesNotMatch(r1, /pct-bar/);
  assert.doesNotMatch(r1, /class="hot"|class="cold"/);
  const r2 = rowOf(html, '399006.SZ');
  assert.match(r2, /pct-bar/);
  assert.match(r2, /class="hot"/);
  assert.match(r2, /n=1[23] 月频 样本少/);
  const r0 = rowOf(html, '000001.SH');
  assert.doesNotMatch(r0, /pct-bar|仅单期/);
  // 跨境对照：单期 PE
  const cross = all.slice(all.indexOf('id="hCross"'), all.indexOf('id="hOverlay"'));
  const hk = rowOf(cross, 'HSI.HK');
  assert.match(hk, /10\.20/);
  assert.match(hk, /仅单期·历史样本不足/);
  assert.doesNotMatch(hk, /100\.0%/);
  const ref = rowOf(cross, '000300.SH');
  assert.match(ref, /100\.0%<span class="date">n=260<\/span>/);

  // 排序：按 PE 分位排序时单期行（无有效分位）排在有分位的行之后
  const W2 = W.PanoHome;
  const c = makeEl('div');
  W2.render(c, [S1, S2, S2b], { range: '10', anchor: LAST });
  c.contains = () => true;
  const slot = makeEl('div');
  c.querySelector = (sel) => (sel === '#rankSlot' ? slot : null);
  const btn = { getAttribute: (k) => ({ 'data-action': 'sort', 'data-key': 'pct' })[k] || null, tagName: 'BUTTON' };
  btn.closest = () => btn;
  c.listeners.click[0]({ target: btn });
  const sorted = slot.innerHTML;
  assert.match(sorted, /按PE分位 ↑/);
  W2.dispose();
  assert.ok(sorted.indexOf('data-code="399001.SZ"') > sorted.indexOf('data-code="000688.SH"') && sorted.indexOf('data-code="000688.SH"') > 0, '单期应排在后面');
});

// ---------- 市值口径 marketCapBasis（round2 mcap） ----------
// 用 echarts stub 捕获主图 option，验证系列名/tooltip 也随口径命名；fixture 市值为合成值
function renderDetailWithChart(series, metric, range) {
  const options = [];
  const origCreate = W.document.createElement;
  W.echarts = { init() { return { setOption(o) { options.push(o); }, dispose() {}, resize() {} }; } };
  W.document.createElement = function (tag) {
    const el = makeEl(tag);
    el.querySelector = function (sel) {
      const m = /data-pd-chart="(\w+)"/.exec(sel);
      return m && this.innerHTML.indexOf('data-pd-chart="' + m[1] + '"') >= 0 ? makeEl('div') : null;
    };
    return el;
  };
  try {
    const c = makeEl('div');
    W.PanoDetail.render(c, series, { metric, range: range || '10' });
    const html = c.children[0].innerHTML;
    W.PanoDetail.dispose();
    return { html, options };
  } finally {
    W.document.createElement = origCreate;
    delete W.echarts;
  }
}
function mcapSeries(basis, cols) {
  const src = { label: 'fixture-mcap', url: 'https://example.com/mcap', unit: '亿元', method: '测试', frequency: 'daily' };
  if (basis !== undefined) src.marketCapBasis = basis;
  return fixture('000905.SH', '中证500', '核心宽基', DATES,
    Object.assign({ price: priceCol(), mcap: dailyVals((i) => 80000 + i * 10) }, cols || {}), { sources: { mcap: src } });
}
function mainChartOf(options) {
  return options.find((o) => o.series && o.series[0] && o.series[0].id === 'mcap');
}
for (const [basis, label] of [['free_float', '自由流通市值'], ['total', '总市值'], [undefined, '市值（口径未注明）'], ['weird', '市值（口径未注明）']]) {
  test('mcap 口径 ' + String(basis) + ' → ' + label + '：按钮/标题/统计/图系列名/tooltip/覆盖表一致', () => {
    const { html, options } = renderDetailWithChart(mcapSeries(basis), 'mcap');
    assert.match(html, new RegExp('data-pd-metric="mcap" aria-pressed="true">' + label.replace(/[()（）]/g, '.') + '<'));
    const main = section(html, 'pd-main');
    assert.match(main, new RegExp('<h3>' + label.replace(/[()（）]/g, '.') + ' · 近10年历史</h3>'));
    assert.match(main, /历史分位/);                       // 多样本保持统计
    assert.match(main, /8\.\d{2} 万亿元/);                // 数值与单位未改（亿元→万亿元格式化）
    assert.match(main, basis === 'free_float' || basis === 'total' ? new RegExp('口径：' + label + '（来源声明）') : /来源未注明总市值\/自由流通口径，不按总市值解读/);
    const cov = section(html, 'pd-cov');
    assert.match(cov, new RegExp('<th scope="row">' + label.replace(/[()（）]/g, '.') + '<span class="pd-muted"> mcap</span>'));
    if (basis !== 'total') assert.doesNotMatch(html.replace(/来源未注明总市值\/自由流通口径，不按总市值解读/g, ''), /总市值/, '非 total 口径不得出现“总市值”标签');
    const opt = mainChartOf(options);
    assert.ok(opt, '主图 option 已生成');
    assert.equal(opt.series[0].name, label);
    const tip = opt.tooltip.formatter([{ value: [LAST, 82590], marker: '', seriesName: opt.series[0].name, seriesId: 'mcap' }]);
    assert.match(tip, new RegExp(label.replace(/[()（）]/g, '.') + '：8\\.26 万亿元'));
  });
}
test('mcap 口径：metadata.marketCapBasis 也被识别；单期 mcap 仍走单期门槛', () => {
  const s = mcapSeries(undefined, { mcap: { [LAST]: 81234 } });
  s.sources.mcap.metadata = { marketCapBasis: 'free_float' };
  const { html, options } = renderDetailWithChart(s, 'mcap');
  const main = section(html, 'pd-main');
  assert.match(main, /<h3>自由流通市值 · 近10年历史<\/h3>/);
  assert.match(main, /仅单期 · 历史样本不足/);
  assert.doesNotMatch(main, /20% \/ 80% 分位/);
  assert.equal(mainChartOf(options), undefined, '单期不画主图');
  assert.doesNotMatch(html, /总市值/);
});

// ---------- 二审：单指标温度计（较上周 / 历史位置描述） ----------
test('温度计：日频 PE 有 7–13 天前真实观测才算较上周；描述只写历史位置', () => {
  const t = section(renderDetail(S2b, 'pe'), 'pd-thermo');
  assert.match(t, /较上周/);
  assert.match(t, /\+0\.50<\/span><small>较 \d{4}-\d{2}-\d{2}<\/small>/); // fixture 每交易日 +0.1，7 天前为 5 个交易日
  assert.match(t, /处于历史高位区间（高于 80% 分位）/);              // 单调递增 fixture
  assert.doesNotMatch(t, /买入|卖出|加仓|减仓/);
});
test('温度计：月频 PE 无 7–13 天前观测 → 较上周未取得，不插值', () => {
  const t = section(renderDetail(S2, 'pe'), 'pd-thermo');
  const row2 = t.slice(t.indexOf('pd-t-row2'), t.indexOf('pd-concl'));
  assert.match(row2, /较上周<\/div><div class="pd-v2"><span class="pd-muted"[^>]*>未取得/);
  assert.match(t, /月频/);
});
test('温度计：单期 PE 不给分位、冷热与历史位置结论；无 PE 显示未取得', () => {
  const t1 = section(renderDetail(S1, 'pe'), 'pd-thermo');
  assert.match(t1, /样本不足，不作历史位置描述/);
  assert.doesNotMatch(t1, /历史高位|历史低位|历史中段|role="meter"/);
  const t0 = section(renderDetail(S0, 'pe'), 'pd-thermo');
  assert.match(t0, /没有市盈率观测，不作历史位置描述/);
  assert.match(t0, /区间分位<\/div><div class="pd-v2"><span class="pd-muted">未取得/);
});
