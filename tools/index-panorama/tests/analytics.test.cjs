'use strict';
// 运行：node --test tests/analytics.test.cjs
// 所有预期值均为手算（见注释），不调用被测函数自证。
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const M = require(path.join(__dirname, '..', 'analytics.js'));

const FIELDS = ['price', 'chg', 'pe', 'pb', 'dy', 'mcap', 'amt', 'turn', 'eps', 'roe', 'bps', 'volume', 'np'];

function mk(code, d, cols) {
  const s = { code, name: code + '名', category: '核心宽基', sources: {}, warnings: [], d: d.slice() };
  for (const f of FIELDS) s[f] = (cols && cols[f]) ? cols[f].slice() : d.map(() => null);
  return s;
}
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// ---------- sliceSeries ----------
test('sliceSeries: 闰日锚点回退1个日历年钳制到 2-28，两端含，锚点后剔除', () => {
  const d = ['2023-02-27', '2023-02-28', '2023-03-01', '2024-02-29', '2024-03-01'];
  const s = mk('A', d, { price: [1, 2, 3, 4, 5], pe: [10, null, 12, 13, 14] });
  const out = M.sliceSeries(s, '1', '2024-02-29');
  assert.deepEqual(out.d, ['2023-02-28', '2023-03-01', '2024-02-29']);
  assert.deepEqual(out.price, [2, 3, 4]);
  assert.deepEqual(out.pe, [null, 12, 13]);
  assert.equal(out.rangeStart, '2023-02-28');
  for (const f of FIELDS) assert.equal(out[f].length, out.d.length, f + ' 对齐');
});

test('sliceSeries: 非闰年锚点 2025-02-28 回退1年 = 2024-02-28（不是 02-29）', () => {
  const d = ['2024-02-27', '2024-02-28', '2024-02-29', '2025-02-28'];
  const out = M.sliceSeries(mk('A', d, { price: [1, 2, 3, 4] }), '1', '2025-02-28');
  assert.deepEqual(out.d, ['2024-02-28', '2024-02-29', '2025-02-28']);
  assert.equal(M.minusYears('2024-02-29', 4), '2020-02-29');
  assert.equal(M.minusYears('2024-02-29', 3), '2021-02-28');
  assert.equal(M.minusYears('2026-11-11', 10), '2016-11-11');
});

test('sliceSeries: 默认锚点为末日；all 含全部；不修改原对象；缺失字段补 null', () => {
  const d = ['2015-01-05', '2020-06-01', '2026-11-11'];
  const s = mk('A', d, { price: [1, 2, 3] });
  delete s.roe; // 缺失数组
  const snapshot = JSON.stringify(s);
  const all = M.sliceSeries(s, 'all');
  assert.deepEqual(all.d, d);
  assert.deepEqual(all.roe, [null, null, null]);
  const ten = M.sliceSeries(s, '10');
  assert.deepEqual(ten.d, ['2020-06-01', '2026-11-11']);
  assert.equal(ten.code, 'A');
  assert.equal(JSON.stringify(s), snapshot, '原对象未变');
  assert.notEqual(all.price, s.price, '返回新数组');
  const empty = M.sliceSeries(mk('E', []), '5');
  assert.deepEqual(empty.d, []);
  assert.deepEqual(empty.pe, []);
});

test('sliceSeries: 显式锚点早于末日，仅取 [锚点-3年, 锚点]', () => {
  const d = ['2019-12-31', '2020-01-01', '2022-06-30', '2023-01-01', '2023-01-02'];
  const out = M.sliceSeries(mk('A', d, { price: [1, 2, 3, 4, 5] }), '3', '2023-01-01');
  assert.deepEqual(out.d, ['2020-01-01', '2022-06-30', '2023-01-01']);
});

// ---------- stats ----------
test('stats: 已知分位/分位带/均值/高低日期，跳过 null 与 NaN', () => {
  const d = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12', '2026-01-13'];
  const pe = [10, null, 30, 20, NaN, 40, 20];
  const r = M.stats(mk('A', d, { pe }), 'pe', 'all');
  // 有效 = [10,30,20,40,20]，最新 20；<=20 的有 10,20,20 → 3/5
  assert.equal(r.count, 5);
  assert.equal(r.latest, 20);
  assert.equal(r.latestDate, '2026-01-13');
  close(r.percentile, 60);
  // 升序 [10,20,20,30,40]：q20 位置 0.8 → 10+10*0.8=18；q80 位置 3.2 → 30+10*0.2=32
  close(r.q20, 18);
  close(r.q80, 32);
  close(r.mean, 24);
  assert.equal(r.min, 10); assert.equal(r.minDate, '2026-01-05');
  assert.equal(r.max, 40); assert.equal(r.maxDate, '2026-01-12');
  close(r.changePct, 100); // (20-10)/10
  assert.equal(r.changeKind, 'metric', '非 price 指标不称涨跌');
  assert.equal(M.stats(mk('A', d, { price: [1, 2, 3, 4, 5, 6, 7] }), 'price', 'all').changeKind, 'price');
});

test('stats: 最新值为唯一最高 → 100；唯一最低 → 1/count', () => {
  const d = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'];
  close(M.stats(mk('A', d, { pb: [1, 2, 3, 4] }), 'pb', 'all').percentile, 100);
  close(M.stats(mk('A', d, { pb: [4, 3, 2, 1] }), 'pb', 'all').percentile, 25);
});

test('stats: 全空/字段缺失/字符串数字 → count 0 与 null，不伪造', () => {
  const d = ['2026-01-05', '2026-01-06'];
  const r = M.stats(mk('A', d, { dy: [null, null] }), 'dy', '10');
  assert.equal(r.count, 0);
  for (const k of ['latest', 'latestDate', 'percentile', 'q20', 'q80', 'min', 'max', 'mean', 'changePct']) {
    assert.equal(r[k], null, k);
  }
  const s = mk('A', d); s.pe = ['12', '13'];
  assert.equal(M.stats(s, 'pe', 'all').count, 0, '字符串不计为样本');
  // 单样本：分位 100，变化 null
  const one = M.stats(mk('A', d, { pe: [null, 12] }), 'pe', 'all');
  assert.equal(one.count, 1); close(one.percentile, 100); assert.equal(one.changePct, null);
});

test('stats: 区间剪裁影响分位（1年 vs 全部）', () => {
  const d = ['2024-01-02', '2025-11-10', '2026-03-02', '2026-11-11'];
  const s = mk('A', d, { pe: [5, 30, 20, 10] });
  // 全部 [5,30,20,10]，<=10 有 5,10 → 50
  close(M.stats(s, 'pe', 'all').percentile, 50);
  // 1年 起点 2025-11-11：[20,10] → 50；3年：同全部
  const one = M.stats(s, 'pe', '1');
  assert.equal(one.count, 2); close(one.percentile, 50); assert.equal(one.rangeStart, '2025-11-11');
  // 锚点 2026-03-02、1年：[30,20]（2025-03-02 起）→ 最新20 → 1/2
  const anc = M.stats(s, 'pe', '1', '2026-03-02');
  assert.equal(anc.count, 2); assert.equal(anc.latest, 20); close(anc.percentile, 50);
});

// ---------- drawdown ----------
test('drawdown: 高水位回撤，缺值保持 null 不补 0，非正价格视为缺失', () => {
  const d = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'].map((_, i) => `2026-01-0${i + 1}`);
  const r = M.drawdown(mk('A', d, { price: [null, 100, 120, null, 90, 130, 0] }));
  // 峰 120 → 90 回撤 -25；130 创新高 0；0 视为缺失
  assert.deepEqual(r.dates, d);
  assert.equal(r.values[0], null);
  assert.equal(r.values[1], 0);
  assert.equal(r.values[2], 0);
  assert.equal(r.values[3], null);
  close(r.values[4], -25);
  assert.equal(r.values[5], 0);
  assert.equal(r.values[6], null);
  close(r.maxDrawdown, -25);
  assert.equal(r.maxDrawdownDate, '2026-01-05');
  assert.equal(r.peakDateBeforeMaxDrawdown, '2026-01-03');
  assert.equal(r.current, 0);
});

test('drawdown: 单调上涨 maxDrawdown 为 0；无有效价格返回 null', () => {
  const d = ['2026-01-05', '2026-01-06', '2026-01-07'];
  assert.equal(M.drawdown(mk('A', d, { price: [1, 2, 3] })).maxDrawdown, 0);
  assert.equal(M.drawdown(mk('A', d)), null);
  assert.equal(M.drawdown(mk('A', [])), null);
});

// ---------- compare ----------
test('compare: 仅取共同正收盘日期，共同首日统一为 100', () => {
  const a = mk('A', ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'], { price: [50, 55, 60, 45] });
  // B 首日缺失，次日为 0（无效），共同日期 = 01-07, 01-08
  const b = mk('B', ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'], { price: [null, 0, 200, 220] });
  const r = M.compare([a, b], 'all');
  assert.deepEqual(r.dates, ['2026-01-07', '2026-01-08']);
  assert.equal(r.startDate, '2026-01-07');
  assert.equal(r.endDate, '2026-01-08');
  assert.deepEqual(r.lines.map(l => l.code), ['A', 'B']);
  close(r.lines[0].values[0], 100); close(r.lines[1].values[0], 100);
  close(r.lines[0].values[1], 75);  // 45/60
  close(r.lines[1].values[1], 110); // 220/200
});

test('compare: 不同日历（港股/A股）求交集；空列表与无交集不报错', () => {
  const a = mk('A', ['2026-01-05', '2026-01-06', '2026-01-08'], { price: [1, 2, 4] });
  const h = mk('H', ['2026-01-06', '2026-01-07', '2026-01-08'], { price: [10, 11, 5] });
  const r = M.compare([a, h], 'all');
  assert.deepEqual(r.dates, ['2026-01-06', '2026-01-08']);
  close(r.lines[0].values[1], 200); close(r.lines[1].values[1], 50);
  const none = M.compare([mk('X', ['2026-01-05'], { price: [1] }), mk('Y', ['2026-01-06'], { price: [1] })], 'all');
  assert.deepEqual(none.dates, []); assert.equal(none.startDate, null);
  assert.equal(none.corr.matrix[0][1], null); assert.equal(none.corr.counts[0][1], 0);
  const empty = M.compare([], '10');
  assert.deepEqual(empty.lines, []); assert.deepEqual(empty.corr.matrix, []);
});

// 周五日期（ISO 周相邻）
const FRI = ['2026-01-02', '2026-01-09', '2026-01-16', '2026-01-23', '2026-01-30', '2026-02-06'];

test('compare 相关性: 完全反向周收益 → -1，保留负值；样本数 = 相邻周数', () => {
  // A 周收益 +10%,-10%,+10%；B 为 -10%,+10%,-10%
  const a = mk('A', FRI.slice(0, 4), { price: [100, 110, 99, 108.9] });
  const b = mk('B', FRI.slice(0, 4), { price: [100, 90, 99, 89.1] });
  const r = M.compare([a, b], 'all');
  close(r.corr.matrix[0][1], -1, 1e-12);
  close(r.corr.matrix[1][0], -1, 1e-12);
  close(r.corr.matrix[0][0], 1, 1e-12);
  assert.equal(r.corr.counts[0][1], 3);
  assert.deepEqual(r.corr.codes, ['A', 'B']);
});

test('compare 相关性: 常数价格（方差 0）→ null，计数仍保留', () => {
  const a = mk('A', FRI.slice(0, 5), { price: [100, 110, 99, 108.9, 120] });
  const c = mk('C', FRI.slice(0, 5), { price: [7, 7, 7, 7, 7] });
  const r = M.compare([a, c], 'all');
  assert.equal(r.corr.matrix[0][1], null);
  assert.equal(r.corr.matrix[1][1], null, '常数自相关也为 null');
  assert.equal(r.corr.counts[0][1], 4);
});

test('compare 相关性: 少于 3 个周收益样本 → null', () => {
  const a = mk('A', FRI.slice(0, 3), { price: [100, 110, 99] });
  const b = mk('B', FRI.slice(0, 3), { price: [100, 90, 99] });
  const r = M.compare([a, b], 'all');
  assert.equal(r.corr.counts[0][1], 2);
  assert.equal(r.corr.matrix[0][1], null);
});

test('compare 相关性: 缺周不跨周计算、不当 0；同周取最后一个观测', () => {
  // 周：W1(01-02) W2(01-07 周三, 01-09 周五) W3(01-16) [缺 W4] W5(01-30) W6(02-06) W7(02-13)
  const d = ['2026-01-02', '2026-01-07', '2026-01-09', '2026-01-16', '2026-01-30', '2026-02-06', '2026-02-13'];
  const pa = [100, 500, 110, 121, 50, 55, 44];
  const pb = [100, 1, 105, 100, 80, 100, 90];
  const r = M.compare([mk('A', d, { price: pa }), mk('B', d, { price: pb })], 'all');
  // 相邻周对：W1→W2, W2→W3, W5→W6, W6→W7（W3→W5 跨缺周跳过）
  assert.deepEqual(r.corr.returnDates, ['2026-01-09', '2026-01-16', '2026-02-06', '2026-02-13']);
  assert.equal(r.corr.counts[0][1], 4);
  // 手算周收益：A = [.1, .1, .1, -.2]；B = [.05, -100/105+1, .25, -.1]
  const ra = [0.1, 0.1, 0.1, -0.2];
  const rb = [0.05, 100 / 105 - 1, 0.25, -0.1];
  const ma = ra.reduce((x, y) => x + y) / 4, mb = rb.reduce((x, y) => x + y) / 4;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < 4; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2; }
  close(r.corr.matrix[0][1], sxy / Math.sqrt(sxx * syy), 1e-12);
});

test('ISO 周: 跨年 53 周与同周判定', () => {
  // 2026-12-31(周四) 与 2027-01-01(周五) 同属 2026-W53
  assert.equal(M.isoWeekIndex('2026-12-31'), M.isoWeekIndex('2027-01-01'));
  // 2026-12-27(周日) 属上一周；2026-12-28(周一) 新周
  assert.equal(M.isoWeekIndex('2026-12-28') - M.isoWeekIndex('2026-12-27'), 1);
  // 2020-12-31(2020-W53) → 2021-01-08(2021-W01) 相邻
  assert.equal(M.isoWeekIndex('2021-01-08') - M.isoWeekIndex('2020-12-31'), 1);
});

test('pearson: 已知数值与边界', () => {
  // x=[1,2,3,4] y=[2,4,5,9]：sxy=11 sxx=5 syy=26 → 11/√130
  close(M.pearson([1, 2, 3, 4], [2, 4, 5, 9]), 11 / Math.sqrt(130), 1e-12);
  assert.equal(M.pearson([1, 2], [3, 4]), null);
  assert.equal(M.pearson([1, 1, 1], [1, 2, 3]), null);
});

test('compare: 区间与锚点作用于共同窗口', () => {
  const d = ['2023-11-10', '2025-11-12', '2026-11-11'];
  const a = mk('A', d, { price: [10, 20, 30] });
  const b = mk('B', d, { price: [5, 10, 20] });
  const r = M.compare([a, b], '1');
  assert.deepEqual(r.dates, ['2025-11-12', '2026-11-11']);
  close(r.lines[1].values[1], 200);
  assert.equal(r.anchor, '2026-11-11');
});

// ---------- 详情页回撤口径回归（区间峰值 vs 全历史峰值） ----------
function loadDetail() {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['analytics.js', 'detail.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  }
  // vm 内对象跨 realm，统一经 JSON 转回本 realm 再断言
  return { drawdownSummary: (...a) => JSON.parse(JSON.stringify(ctx.PanoDetail.drawdownSummary(...a))) };
}

test('详情回撤: 区间最大回撤只用区间内峰值，不把区间前高点算入', () => {
  const D = loadDetail();
  // 区间前高点 100（2025-06-02），近1年（锚点 2026-11-11 → 起点 2025-11-11）内 [80,90,85]
  const d = ['2025-06-02', '2026-01-05', '2026-03-02', '2026-11-11'];
  const s = mk('A', d, { price: [100, 80, 90, 85] });
  const r = D.drawdownSummary(s, '1', '2026-11-11');
  // 区间：峰 90（2026-03-02）→ 85：(85/90-1)*100 = -5.5556%
  close(r.range.maxDrawdown, (85 / 90 - 1) * 100, 1e-9);
  close(r.range.maxDrawdown, -5.5556, 1e-4);
  assert.notEqual(Math.round(r.range.maxDrawdown), -20);
  assert.equal(r.range.peakDateBeforeMaxDrawdown, '2026-03-02');
  assert.equal(r.range.maxDrawdownDate, '2026-11-11');
  close(r.range.current, (85 / 90 - 1) * 100, 1e-9);
  assert.equal(r.range.peakDate, '2026-03-02');
  // 曲线点：区间首日相对自身为 0，而非 -20
  assert.deepEqual(r.pairs.map(p => p[0]), ['2026-01-05', '2026-03-02', '2026-11-11']);
  assert.equal(r.pairs[0][1], 0);
  assert.equal(r.rangeStart, '2026-01-05');
  // 全历史：峰 100 → 谷 80 = -20%，当前 85 相对 100 = -15%
  close(r.full.maxDrawdown, -20, 1e-9);
  assert.equal(r.full.peakDateBeforeMaxDrawdown, '2025-06-02');
  assert.equal(r.full.maxDrawdownDate, '2026-01-05');
  close(r.full.current, -15, 1e-9);
  assert.equal(r.dataStart, '2025-06-02');
});

test('详情回撤: 区间无收盘时 range 为 null，全历史仍可用；无数据全为 null', () => {
  const D = loadDetail();
  const s = mk('A', ['2020-01-02', '2026-11-11'], { price: [100, null] });
  const r = D.drawdownSummary(s, '1', '2026-11-11');
  assert.equal(r.range, null);
  assert.deepEqual(r.pairs, []);
  assert.equal(r.full.maxDrawdown, 0);
  const e = D.drawdownSummary(mk('E', []), '1');
  assert.equal(e.range, null); assert.equal(e.full, null);
});
