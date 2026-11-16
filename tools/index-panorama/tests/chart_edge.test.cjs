// 图表左右端点吸附：用真实 ECharts（jsdom + SVG 渲染）派发鼠标事件，检查提示里显示的是哪一个真实观测。
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const DIR = path.join(__dirname, '..');

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { JSDOM = null; }

const W = 600, H = 300, GRID = { left: 52, right: 52, top: 26, bottom: 46 };

function setup() {
  const dom = new JSDOM('<!doctype html><div id="c" style="width:600px;height:300px"></div>', { pretendToBeVisual: true, virtualConsole: new VirtualConsole() }); // 丢弃 jsdom 无 canvas 的提示
  const win = dom.window;
  for (const [k, v] of [['window', win], ['document', win.document], ['navigator', win.navigator]]) {
    Object.defineProperty(global, k, { value: v, configurable: true, writable: true });
  }
  // jsdom 没有布局：容器尺寸与位置固定为 600×300、左上角 (0,0)
  win.HTMLElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, right: W, bottom: H, width: W, height: H, x: 0, y: 0 }; };
  delete require.cache[require.resolve(path.join(DIR, 'assets/echarts.min.js'))];
  const echarts = require(path.join(DIR, 'assets/echarts.min.js'));
  const edge = require(path.join(DIR, 'chart-edge.js'));
  return { win, echarts, edge, el: win.document.getElementById('c') };
}

function days(n, start) {
  const out = [], t0 = Date.UTC(2026, 0, start || 1);
  for (let i = 0; i < n; i++) out.push(new Date(t0 + i * 86400000).toISOString().slice(0, 10));
  return out;
}

function mount(env, series, extra) {
  const chart = env.echarts.init(env.el, null, { renderer: 'svg', width: W, height: H });
  const seen = [];
  chart.setOption(Object.assign({
    animation: false,
    grid: GRID,
    tooltip: { trigger: 'axis', showDelay: 0, transitionDuration: 0, axisPointer: { type: 'cross', snap: true },
      formatter: (ps) => { seen.push(ps.map((p) => [p.seriesName, p.value[0], p.value[1]])); return 'x'; } },
    xAxis: { type: 'time' },
    yAxis: [{ type: 'value', scale: true }, { type: 'value', scale: true, position: 'right' }],
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 14, bottom: 6 }],
    series,
  }, extra || {}));
  env.edge.attach(chart);
  return { chart, seen };
}

function move(env, chart, x, y) {
  const target = chart.getZr().painter.getViewportRoot();
  target.dispatchEvent(new env.win.MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
}

const MID_Y = GRID.top + (H - GRID.top - GRID.bottom) / 2;
const RIGHT_MARGIN_X = W - GRID.right / 2, LEFT_MARGIN_X = GRID.left / 2;

test('edgePoint：只处理左右轴边距，绘图区内和上下边距不处理', () => {
  const { edgePoint } = require(path.join(DIR, 'chart-edge.js'));
  const r = { x: 52, y: 26, width: 496, height: 228 };
  assert.deepEqual(edgePoint(r, 10, 100), { x: 52, y: 100, side: 'left' });
  assert.deepEqual(edgePoint(r, 590, 100), { x: 548, y: 100, side: 'right' });
  assert.equal(edgePoint(r, 300, 100), null);       // 绘图区内
  assert.equal(edgePoint(r, 590, 280), null);       // 滑块所在的下边距
  assert.equal(edgePoint(r, 10, 5), null);          // 上边距（轴名）
  assert.equal(edgePoint(null, 10, 100), null);
});

test('真实 ECharts：轴边距吸附首末真实观测；缩放后吸附可见区间端点', { skip: !JSDOM && 'jsdom 不可用' }, () => {
  const env = setup();
  const d = days(200);
  const data = d.map((x, i) => [x, 10 + i]);
  const { chart, seen } = mount(env, [{ name: 'PE', type: 'line', data }]);

  move(env, chart, RIGHT_MARGIN_X, MID_Y);
  assert.deepEqual(seen.at(-1), [['PE', d[199], 209]]);
  move(env, chart, LEFT_MARGIN_X, MID_Y);
  assert.deepEqual(seen.at(-1), [['PE', d[0], 10]]);

  // 缩放到中段：不能跳到全历史首尾，也不能落在窗口外
  chart.dispatchAction({ type: 'dataZoom', start: 40, end: 60 });
  const [lo, hi] = chart.getModel().getComponent('xAxis').axis.scale.getExtent();
  const visible = data.filter((p) => { const t = Date.parse(p[0]); return t >= lo && t <= hi; });
  move(env, chart, RIGHT_MARGIN_X, MID_Y);
  assert.deepEqual(seen.at(-1), [['PE', visible.at(-1)[0], visible.at(-1)[1]]]);
  assert.notEqual(seen.at(-1)[0][1], d[199]);
  move(env, chart, LEFT_MARGIN_X, MID_Y);
  assert.deepEqual(seen.at(-1), [['PE', visible[0][0], visible[0][1]]]);
  assert.notEqual(seen.at(-1)[0][1], d[0]);

  // 下边距（滑块）不触发吸附
  const n = seen.length;
  move(env, chart, RIGHT_MARGIN_X, H - 8);
  assert.equal(seen.length, n);
  chart.dispose();
});

test('真实 ECharts：稀疏 EPS 末点早于 PE 时，右边距只给真实同日观测，不伪造 EPS 当日值', { skip: !JSDOM && 'jsdom 不可用' }, () => {
  const env = setup();
  const d = days(120);
  const pe = d.map((x, i) => [x, 12 + i / 100]);
  const eps = d.filter((_, i) => i % 5 === 0 && i < 100).map((x, i) => [x, 0.5 + i / 100]); // 末点早 20 天
  const { chart, seen } = mount(env, [
    { name: 'PE', type: 'line', data: pe },
    { name: 'EPS', type: 'line', yAxisIndex: 1, data: eps },
  ]);
  move(env, chart, RIGHT_MARGIN_X, MID_Y);
  const last = seen.at(-1);
  assert.deepEqual(last.map((p) => p[0]), ['PE']);
  assert.equal(last[0][1], d[119]);
  // 每个出现的值都与该系列在该日期的原始观测一致
  for (const [name, date, v] of last) {
    const src = name === 'PE' ? pe : eps;
    assert.deepEqual(src.find((p) => p[0] === date), [date, v]);
  }
  chart.dispose();
});

test('真实 ECharts：类目轴（首页叠加）边距吸附可见区间首末交易日', { skip: !JSDOM && 'jsdom 不可用' }, () => {
  const env = setup();
  const d = days(100);
  const chart = env.echarts.init(env.el, null, { renderer: 'svg', width: W, height: H });
  const seen = [];
  chart.setOption({
    animation: false, grid: GRID,
    tooltip: { trigger: 'axis', showDelay: 0, axisPointer: { type: 'cross', snap: true }, formatter: (ps) => { seen.push(ps.map((p) => [p.seriesName, p.axisValue, p.value])); return 'x'; } },
    xAxis: { type: 'category', data: d, boundaryGap: false }, yAxis: { type: 'value', scale: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 10 }],
    series: [{ name: 'A', type: 'line', data: d.map((_, i) => 100 + i) }, { name: 'B', type: 'line', data: d.map((_, i) => 100 - i) }],
  });
  env.edge.attach(chart);
  move(env, chart, RIGHT_MARGIN_X, MID_Y);
  assert.deepEqual(seen.at(-1), [['A', d[99], 199], ['B', d[99], 1]]);
  chart.dispatchAction({ type: 'dataZoom', startValue: 20, endValue: 59 });
  move(env, chart, LEFT_MARGIN_X, MID_Y);
  assert.deepEqual(seen.at(-1), [['A', d[20], 120], ['B', d[20], 80]]);
  move(env, chart, RIGHT_MARGIN_X, MID_Y);
  assert.deepEqual(seen.at(-1), [['A', d[59], 159], ['B', d[59], 41]]);
  chart.dispose();
});
