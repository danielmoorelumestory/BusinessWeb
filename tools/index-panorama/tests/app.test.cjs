const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const DIR = path.join(__dirname, '..');
const A = require(path.join(DIR, 'app.js'));

const H = A.CSV_COLUMNS.join(',');
const base = [{ code: '000300.SH', name: '沪深300', category: '核心宽基', sources: { price: { label: '腾讯证券' } }, warnings: [],
  d: ['2026-11-10', '2026-11-11'], price: [4059.11, 4075.71], chg: [null, 0.41], pe: [13.1, 13.14], pb: [null, null], dy: [null, null],
  mcap: [null, null], amt: [null, 4421.28], turn: [null, null], eps: [null, null], roe: [null, null], bps: [null, null], volume: [null, 16119926200] }];
const snapshot = JSON.stringify(base);

test('BOM + 引号 + 引号内逗号/换行 + CRLF', () => {
  const t = '﻿' + H + '\r\n"X1","名,称""A""\n第二行",,2026-01-05,"1,0",,,,,,,,,,,\r\n';
  const p = A.parseCSVText(t);
  assert.equal(p.error, null);
  assert.equal(p.rows[1].cells[1], '名,称"A"\n第二行');
  const v = A.validateImport(t, []);
  assert.equal(v.ok, false); // "1,0" 不是有效数字
  assert.match(v.errors.join(), /price/);
});

test('空串不当 0；至少一个有效数字', () => {
  const v = A.validateImport(H + '\nX1,甲,,2026-01-05,,,,,,,,,,,,\n', []);
  assert.equal(v.ok, false);
  assert.match(v.errors[0], /没有任何有效数字/);
  const v2 = A.validateImport(H + '\nX1,甲,,2026-01-05,,,12.5,,,,,,,,,\n', []);
  assert.equal(v2.ok, true);
  const g = v2.groups.X1.byDate['2026-01-05'];
  assert.equal(g.pe, 12.5); assert.equal(g.price, null); assert.equal(g.chg, null);
});

test('日期校验：非法/闰年/格式归一', () => {
  assert.equal(A.normalizeDate('2024-02-29'), '2024-02-29');
  assert.equal(A.normalizeDate('2023-02-29'), null);
  assert.equal(A.normalizeDate('2026/1/5'), '2026-01-05');
  assert.equal(A.normalizeDate('20260105'), '2026-01-05');
  assert.equal(A.normalizeDate('2026-13-01'), null);
  assert.equal(A.normalizeDate('05/01/2026'), null);
  const v = A.validateImport(H + '\nX1,甲,,2023-02-29,100,,,,,,,,,,,\n', []);
  assert.equal(v.ok, false); assert.match(v.errors[0], /date/);
});

test('有限数校验：Infinity/NaN字串/百分号/负价', () => {
  assert.equal(A.parseNumber('Infinity').ok, false);
  assert.equal(A.parseNumber('1e999').ok, false);
  assert.deepEqual(A.parseNumber(' -1.5e2 '), { ok: true, value: -150 });
  assert.deepEqual(A.parseNumber('--'), { ok: true, value: null });
  assert.equal(A.parseNumber('3%').ok, false);
  assert.equal(A.parseNumber('0x10').ok, false);
  const v = A.validateImport(H + '\nX1,甲,,2026-01-05,-3,,,,,,,,,,,\n', []);
  assert.equal(v.ok, false);
  const v2 = A.validateImport(H + '\nX1,甲,,2026-01-05,,,-5,,,,,,,,,\n', []); // 负PE允许（亏损）
  assert.equal(v2.ok, true);
});

test('必填列/必填值/未知分类/列数过多/引号未闭合', () => {
  assert.equal(A.validateImport('code,date,price\nX,2026-01-01,1\n', []).ok, false);
  assert.match(A.validateImport(H + '\n,甲,,2026-01-05,1,,,,,,,,,,,\n', []).errors[0], /code 为空/);
  assert.match(A.validateImport(H + '\nX,,,2026-01-05,1,,,,,,,,,,,\n', []).errors[0], /name 为空/);
  assert.match(A.validateImport(H + '\nX,甲,外星,2026-01-05,1,,,,,,,,,,,\n', []).errors[0], /category/);
  assert.match(A.validateImport(H + '\nX,甲,,2026-01-05,1,,,,,,,,,,,,9\n', []).errors[0], /列数/);
  assert.match(A.validateImport(H + '\n"X,甲,,2026-01-05,1\n', []).errors[0], /引号/);
  assert.equal(A.validateImport('', []).ok, false);
  assert.equal(A.validateImport(H + '\n', []).ok, false);
});

test('部分列表头可用；未知列警告', () => {
  const v = A.validateImport('code,name,date,pb,foo\nX,甲,2026-01-05,1.2,zz\n', []);
  assert.equal(v.ok, true);
  assert.match(v.warnings.join(), /foo/);
});

test('同文件重复日期：一致合并，冲突报错', () => {
  const ok = A.validateImport('code,name,date,price,pe\nX,甲,2026-01-05,10,\nX,甲,2026-01-05,,5\n', []);
  assert.equal(ok.ok, true);
  assert.deepEqual([ok.groups.X.byDate['2026-01-05'].price, ok.groups.X.byDate['2026-01-05'].pe], [10, 5]);
  const bad = A.validateImport('code,name,date,price\nX,甲,2026-01-05,10\nX,甲,2026-01-05,11\n', []);
  assert.equal(bad.ok, false);
});

test('任一错误整份不导入；合并不改原对象，按日期排序去重', () => {
  const bad = A.validateImport('code,name,date,pb\n000300.SH,沪深300,2026-11-11,1.4\n000300.SH,沪深300,bad,1\n', base);
  assert.equal(bad.ok, false);
  const v = A.validateImport('code,name,date,pb,price\n000300.SH,沪深300,2026-11-11,1.4,\n000300.SH,沪深300,2026-11-09,1.38,4000\n000300.SH,沪深300,2026-11-10,,4060\n', base);
  assert.equal(v.ok, true);
  const r = A.applyImport(base, v, 't.csv');
  assert.equal(JSON.stringify(base), snapshot, '原数据未被修改');
  const s = r.list[0];
  assert.deepEqual(s.d, ['2026-11-09', '2026-11-10', '2026-11-11']);
  assert.deepEqual(s.price, [4000, 4060, 4075.71]); // 11-10 被覆盖，11-11 空单元格保持原值
  assert.deepEqual(s.pb, [1.38, null, 1.4]);
  assert.deepEqual(s.chg, [null, null, 0.41]);
  for (const f of ['price','chg','pe','pb','dy','mcap','amt','turn','eps','roe','bps','volume']) assert.equal(s[f].length, s.d.length, f);
  assert.equal(r.summary.added, 1); assert.equal(r.summary.overridden, 1);
  assert.ok(s.sources.pb && /导入/.test(s.sources.pb.label));
  assert.ok(s.warnings.some(w => /price/.test(w)), '覆盖原来源字段时有口径警告');
  assert.equal(s.category, '核心宽基');
});

test('新代码：默认分类为导入组；导出 CSV 可再导入（往返）', () => {
  const v = A.validateImport('code,name,date,price,chg\nHSTECH.HK,恒生科技,2026-11-12,5000.5,-1.2\n', base);
  const r = A.applyImport(base, v, 'x.csv');
  const s = r.list[1];
  assert.equal(s.category, '导入（本次会话）');
  const csv = A.seriesToCSV(base[0]);
  assert.ok(csv.startsWith('﻿' + H + '\r\n'));
  const back = A.validateImport(csv, []);
  assert.equal(back.ok, true, back.errors.join(';'));
  const r2 = A.applyImport([], back, 'rt.csv').list[0];
  assert.deepEqual(r2.d, base[0].d);
  for (const f of ['price','chg','pe','amt','volume','pb']) assert.deepEqual(r2[f], base[0][f], f);
  const q = A.seriesToCSV({ code: 'A', name: '含,逗号"引号', category: '', d: ['2026-01-01'], price: [1] });
  assert.match(q, /"含,逗号""引号"/);
  assert.equal(A.templateCSV(), '﻿' + H + '\r\n');
});

test('路由解析', () => {
  assert.deepEqual(A.parseRoute(''), { name: 'panorama', canonical: false });
  assert.deepEqual(A.parseRoute('#/panorama'), { name: 'panorama', canonical: true });
  const h = A.indexHash('000300.SH', '5', 'pb');
  assert.equal(h, '#/index/000300.SH?range=5&metric=pb');
  assert.deepEqual(A.parseRoute(h), { name: 'index', code: '000300.SH', range: '5', metric: 'pb' });
  const odd = A.indexHash('A/B 中?&#');
  assert.equal(A.parseRoute(odd).code, 'A/B 中?&#');
  assert.deepEqual(A.parseRoute('#/index/X?range=7&metric=zzz'), { name: 'index', code: 'X', range: null, metric: null });
  assert.equal(A.parseRoute('#/index/%E0%A4%A').name, 'notfound');
  assert.equal(A.parseRoute('#/foo').name, 'notfound');
});

// ---------- 二审回归：外部值作字典键 ----------
test('原型属性名作为 code / 表头 / 日期键不崩溃', () => {
  for (const code of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    const v = A.validateImport('code,name,date,price\n' + code + ',测试,2026-11-13,100\n', []);
    if (code === '__proto__') { assert.equal(v.ok, false); continue; } // 首字符须为字母数字，按格式报错
    assert.equal(v.ok, true, code + ': ' + v.errors.join(';'));
    assert.equal(v.groups[code].byDate['2026-11-13'].price, 100);
    const r = A.applyImport(base, v, 'p.csv');
    assert.equal(r.list.length, 2);
    assert.equal(r.list[1].code, code);
    assert.deepEqual(r.list[1].price, [100]);
    // 二次导入同一代码走合并而不是新增
    const r2 = A.applyImport(r.list, A.validateImport('code,name,date,price\n' + code + ',测试,2026-11-14,101\n', r.list), 'q.csv');
    assert.equal(r2.list.length, 2);
    assert.deepEqual(r2.list[1].d, ['2026-11-13', '2026-11-14']);
  }
  assert.equal(Object.prototype.polluted, undefined);
});

test('constructor/toString 不会被当作缺失标记或表头列', () => {
  assert.equal(A.parseNumber('constructor').ok, false);
  assert.equal(A.parseNumber('toString').ok, false);
  const v = A.validateImport('code,name,date,constructor\nX,甲,2026-01-01,1\n', []);
  assert.equal(v.ok, false); // 没有任何数值列
  assert.match(v.errors[0], /数值列/);
  const v2 = A.validateImport('code,name,date,price,toString\nX,甲,2026-01-01,1,zz\n', []);
  assert.equal(v2.ok, true);
  assert.match(v2.warnings.join(), /tostring/i);
  assert.equal(A.parseRoute('#/index/constructor').code, 'constructor');
  assert.equal(A.parseRoute('#/index/X?constructor=1&range=5').range, '5');
});

// ---------- 二审回归：PE/PB 整列替换，不与原来源拼接 ----------
const peBase = [{ code: 'P.SH', name: '估值样本', category: '核心宽基',
  sources: { price: { label: '腾讯证券' }, pe: { label: '中证指数', unit: '倍' } }, warnings: [],
  d: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'],
  price: [10, 11, 12, 13], chg: [null, 10, 9.09, 8.33], pe: [20, 21, 22, null], pb: [null, null, null, null],
  dy: [null, null, null, null], mcap: [null, null, null, null], amt: [null, null, null, null], turn: [null, null, null, null],
  eps: [null, null, null, null], roe: [null, null, null, null], bps: [null, null, null, null], volume: [null, null, null, null] }];
const peSnap = JSON.stringify(peBase);

test('导入 PE：整列替换，只保留 CSV 观测，原来源其余值清空，来源换成导入', () => {
  const v = A.validateImport('code,name,date,pe,price\nP.SH,估值样本,2026-01-06,30,\nP.SH,估值样本,2026-01-09,31,14\n', peBase);
  assert.equal(v.ok, true, v.errors.join(';'));
  const r = A.applyImport(peBase, v, 'pe.csv');
  assert.equal(JSON.stringify(peBase), peSnap, '原对象未变');
  const s = r.list[0];
  assert.deepEqual(s.d, ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09']);
  assert.deepEqual(s.pe, [null, 30, null, null, 31], '旧中证 PE 20/22 被清空，不与导入值拼接');
  assert.deepEqual(s.price, [10, 11, 12, 13, 14], 'price 仍按日期合并');
  assert.match(s.sources.pe.label, /用户导入CSV/);
  assert.match(s.sources.pe.method, /整列替换/);
  assert.equal(s.sources.price.label, '腾讯证券');
  assert.ok(s.warnings.some(w => /pe 已整列替换/.test(w) && /中证指数/.test(w)));
  assert.deepEqual(s.imported.replaced, ['pe']);
  assert.deepEqual(r.summary.replaced, ['P.SH pe']);
  assert.equal(r.summary.cleared, 2); // 20 与 22 被清空，21 被同日导入值 30 覆盖
  for (const f of ['price','chg','pe','pb','dy','mcap','amt','turn','eps','roe','bps','volume']) assert.equal(s[f].length, s.d.length, f);
});

test('导入 PB：原列全空时直接补全；PE 不受影响', () => {
  const v = A.validateImport('code,name,date,pb\nP.SH,估值样本,2026-01-07,1.5\nP.SH,估值样本,2026-01-08,1.6\n', peBase);
  const s = A.applyImport(peBase, v, 'pb.csv').list[0];
  assert.deepEqual(s.pb, [null, null, 1.5, 1.6]);
  assert.deepEqual(s.pe, [20, 21, 22, null], '未提供 PE 时原 PE 保留');
  assert.equal(s.sources.pe.label, '中证指数');
  assert.match(s.sources.pb.label, /用户导入CSV/);
});

test('CSV 含 pe 列但该代码全空：不替换原 PE', () => {
  const v = A.validateImport('code,name,date,pe,price\nP.SH,估值样本,2026-01-08,,13.5\n', peBase);
  const s = A.applyImport(peBase, v, 'x.csv').list[0];
  assert.deepEqual(s.pe, [20, 21, 22, null]);
  assert.deepEqual(s.price, [10, 11, 12, 13.5]);
});

test('仅剩被清空估值字段的日期整行去除，不留空行', () => {
  const b = [{ code: 'Q', name: 'q', category: '核心宽基', sources: {}, warnings: [], d: ['2026-01-01', '2026-01-02'],
    price: [null, 5], chg: [null, null], pe: [9, 10], pb: [null, null], dy: [null, null], mcap: [null, null], amt: [null, null],
    turn: [null, null], eps: [null, null], roe: [null, null], bps: [null, null], volume: [null, null] }];
  const v = A.validateImport('code,name,date,pe\nQ,q,2026-01-03,11\n', b);
  const s = A.applyImport(b, v, 'q.csv').list[0];
  assert.deepEqual(s.d, ['2026-01-02', '2026-01-03']);
  assert.deepEqual(s.pe, [null, 11]);
  assert.deepEqual(s.price, [5, null]);
});

// ---------- 二审 P1：统计锚点随数据刷新 ----------
const M = require(path.join(DIR, 'analytics.js'));
function mk(code, d, price, pe) {
  const n = () => d.map(() => null);
  return { code, name: code, category: '核心宽基', sources: {}, warnings: [], d: d.slice(), price: price.slice(), chg: n(), pe: pe ? pe.slice() : n(),
    pb: n(), dy: n(), mcap: n(), amt: n(), turn: n(), eps: n(), roe: n(), bps: n(), volume: n() };
}
const days = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'];
const anchorBase = [mk('A.SH', days, [10, 11, 12, 13, 14], [20, 21, 22, 23, 24]), mk('B.SH', days, [5, 5.5, 6, 6.5, 7])];
const BASE_AS_OF = '2026-11-10';

test('maxObservationDate：只认非空有限观测与合法日期', () => {
  assert.equal(A.maxObservationDate([]), null);
  assert.equal(A.maxObservationDate(anchorBase), '2026-11-10');
  const s = mk('C', ['2026-11-10', '2026-11-12', '2026-11-13'], [1, 2, null]); // 11-13 全空
  assert.equal(A.maxObservationDate([s]), '2026-11-12');
  const bad = mk('D', ['2026-11-10', '2026-02-30', 'zzzz'], [1, 2, 3]);
  assert.equal(A.maxObservationDate([bad]), '2026-11-10');
  const inf = mk('E', ['2026-11-10', '2026-11-11'], [1, Infinity]);
  assert.equal(A.maxObservationDate([inf]), '2026-11-10');
  // 跨境数据晚于 bundle.asOf
  assert.equal(A.statsAnchor(BASE_AS_OF, anchorBase.concat([mk('HSI.HK', ['2026-11-11'], [20000])])), '2026-11-11');
  // 锚点不早于数据包 asOf；asOf 无效时只用观测
  assert.equal(A.statsAnchor('2026-11-12', anchorBase), '2026-11-12');
  assert.equal(A.statsAnchor('bad', anchorBase), '2026-11-10');
  assert.equal(A.statsAnchor(null, []), null);
});

test('baseAsOf 11-10 + CSV 新增 11-13：首页统计与详情区间都包含 11-13', () => {
  const before = A.statsAnchor(BASE_AS_OF, anchorBase);
  assert.equal(before, '2026-11-10');
  const csv = 'code,name,date,price,pe\nA.SH,A.SH,2026-11-13,15,\nNEW.X,新指数,2026-11-12,100,\nNEW.X,新指数,2026-11-13,101,\n';
  const r = A.importText(anchorBase, csv, 'add.csv', BASE_AS_OF);
  assert.equal(r.ok, true, r.validation.errors.join(';'));
  assert.equal(r.anchor, '2026-11-13');
  const a = r.list.find(s => s.code === 'A.SH');
  // 首页：近1年 price 统计与 PE 分位（PE 未提供，不替换）都用新锚点
  const st = M.stats(a, 'price', '1', r.anchor);
  assert.equal(st.latestDate, '2026-11-13');
  assert.equal(st.latest, 15);
  const pe = M.stats(a, 'pe', '1', r.anchor);
  assert.equal(pe.latestDate, '2026-11-10'); // PE 自身日期独立
  assert.equal(pe.count, 5);
  // 旧锚点会截掉 11-13（即修复前的矛盾）
  assert.equal(M.stats(a, 'price', '1', before).latestDate, '2026-11-10');
  // 详情：sliceSeries 包含 11-13
  const sl = M.sliceSeries(a, '1', r.anchor);
  assert.equal(sl.d[sl.d.length - 1], '2026-11-13');
  // 新指数全为 11-12/11-13 也在锚点区间内
  const nw = r.list.find(s => s.code === 'NEW.X');
  assert.equal(M.stats(nw, 'price', '1', r.anchor).count, 2);
  // 叠加：共同日期含 11-13
  const cmp = M.compare([a, nw], '1', r.anchor);
  assert.deepEqual(cmp.dates, ['2026-11-13']);
});

test('失败导入不改变锚点与数据', () => {
  const snap = JSON.stringify(anchorBase);
  const r = A.importText(anchorBase, 'code,name,date,price\nA.SH,A.SH,2026-11-13,15\nA.SH,A.SH,2026-02-30,1\n', 'bad.csv', BASE_AS_OF);
  assert.equal(r.ok, false);
  assert.equal(r.anchor, undefined);
  assert.equal(r.list, undefined);
  assert.equal(JSON.stringify(anchorBase), snap);
  assert.equal(A.statsAnchor(BASE_AS_OF, anchorBase), '2026-11-10');
});

test('CSV 导入：数据包里已有的新分类可用，未知分类仍拒绝', () => {
  const ex = [Object.assign({}, base[0], { code: 'N1.SH', category: '新增主题' })];
  assert.equal(A.validateImport(H + '\nX1,甲,新增主题,2026-01-05,1,,,,,,,,,,,\n', ex).ok, true);
  assert.equal(A.validateImport(H + '\nX1,甲,不存在分类,2026-01-05,1,,,,,,,,,,,\n', ex).ok, false);
});
