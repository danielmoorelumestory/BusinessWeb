import { describe, expect, it } from 'vitest';
import { B20_SNAPSHOTS, B_STYLE, bNoteLine, bWindowLine, parseB20Snapshot } from './grid-b20';
import { renderEquityChart, type Candle, type ChartIndicators } from './grid-trading';

const FIELDS = ['date', 'value', 'above', 'valid', 'total', 'reason', 'detail'];
const REASONS = { pcf: '当日 PCF 缺失（404）', coverage: '有效成员覆盖率低于 95%', warmup: '此前 N 个交易日不在已取历史内（预热不足）', lm_late: 'PCF 的 Last-Modified 晚于当日 09:00:00', lm_missing: 'PCF 缺 Last-Modified' };
const SUMMARY = { days: 5, value: 0, firstValid: null, lastValid: null, coverage: 0, pcf: 0, lm_late: 0, lm_missing: 0, warmup: 0, warmupFrom: null, warmupTo: null };
const B20_ROWS = [
  ['2026-11-19', 0.62, 31, 50, 50, null, null],
  ['2026-11-20', null, 29, 46, 50, 'coverage', '未知 4（缺K线 3，复权未核实 1）'],
  ['2026-11-23', null, null, null, null, 'pcf', 'PCF 404'],
  ['2026-11-24', 0.5, 25, 50, 50, null, null],
  ['2026-11-25', 0.52, 26, 50, 50, null, null],
];
const B55_ROWS = [
  ['2026-11-19', null, null, null, 50, 'warmup', '需此前 55 个交易日'],
  ['2026-11-20', 0.4, 20, 50, 50, null, null],
  ['2026-11-23', null, null, null, null, 'pcf', 'PCF 404'],
  ['2026-11-24', 0.44, 22, 50, 50, null, null],
  ['2026-11-25', 0.46, 23, 50, 50, null, null],
];
const B120_ROWS = [
  ['2026-11-19', null, null, null, 50, 'warmup', '需此前 120 个交易日'],
  ['2026-11-20', null, null, null, 50, 'warmup', '需此前 120 个交易日'],
  ['2026-11-23', null, null, null, null, 'pcf', 'PCF 404'],
  ['2026-11-24', null, 17, 50, 50, 'lm_late', null],
  ['2026-11-25', 0.4375, 21, 48, 50, null, '未知 2（缺K线 0，复权未核实 2）'],
];
const v2 = (series: Record<string, unknown[][]> = { 20: B20_ROWS, 55: B55_ROWS, 120: B120_ROWS }, extra: Record<string, unknown> = {}) => ({
  version: 2, code: '159593', through: '2026-11-25', generatedAt: '2026-11-25T22:00:00+08:00', windows: Object.keys(series).map(Number), calendarFrom: '2023-06-01', fields: FIELDS,
  reasons: REASONS, summary: { days: 5, members: 50, baskets: 1 },
  series: Object.fromEntries(Object.entries(series).map(([n, rows]) => [n, { summary: SUMMARY, rows }])), ...extra,
});
const v1 = (rows: unknown[][] = B20_ROWS) => ({ version: 1, code: '159593', through: '2026-11-25', generatedAt: 'x', fields: FIELDS, reasons: REASONS, summary: { ...SUMMARY, members: 50, baskets: 1 }, rows });

describe('申赎篮子宽度快照解析', () => {
  it('只为已核验的 159593 提供快照', () => {
    expect(Object.keys(B20_SNAPSHOTS)).toEqual(['159593']);
  });

  it('v2：三个周期各自解析，保留缺失原因与计数', () => {
    const series = parseB20Snapshot(v2(), '159593');
    expect([...series.periods.keys()]).toEqual([20, 55, 120]);
    expect(series.calendarFrom).toBe('2023-06-01');
    expect(series.periods.get(20)!.points.get('2026-11-20')).toMatchObject({ value: null, above: 29, valid: 46, total: 50, reason: 'coverage' });
    expect(series.periods.get(120)!.points.get('2026-11-19')).toMatchObject({ value: null, valid: null, total: 50, reason: 'warmup' });
  });

  it('v1 旧快照按 B20 读入（迁移兼容），B20 点与 v2 完全相同', () => {
    const old = parseB20Snapshot(v1(), '159593'), now = parseB20Snapshot(v2(), '159593');
    expect([...old.periods.keys()]).toEqual([20]);
    expect([...old.periods.get(20)!.points.values()]).toEqual([...now.periods.get(20)!.points.values()]);
    expect(old.calendarFrom).toBeNull();
  });

  it('拒绝代码不符、数值与计数不符、覆盖率不足却有值、日期越过截止日、缺原因、周期异常', () => {
    expect(() => parseB20Snapshot(v2(), '510300')).toThrow();
    expect(() => parseB20Snapshot(v2({ 20: [['2026-11-19', 0.7, 31, 50, 50, null, null]] }), '159593')).toThrow(/不符/);
    expect(() => parseB20Snapshot(v2({ 20: B20_ROWS, 55: [['2026-11-19', 0.5, 23, 46, 50, null, null]] }), '159593')).toThrow(/B55 快照数值与计数不符/);
    expect(() => parseB20Snapshot(v2({ 20: [['2026-11-26', 0.5, 25, 50, 50, null, null]] }), '159593')).toThrow(/日期/);
    expect(() => parseB20Snapshot(v2({ 20: B20_ROWS, 120: [['2026-11-19', null, 25, 50, 50, null, null]] }), '159593')).toThrow(/B120 快照缺少原因/);
    expect(() => parseB20Snapshot(v2({ 55: B55_ROWS }), '159593')).toThrow(/周期/);              // 必须含 B20
    expect(() => parseB20Snapshot({ ...v2(), windows: [20, 60] }, '159593')).toThrow(/周期/);
    expect(() => parseB20Snapshot({ ...v2(), windows: [20, 55] , series: { 20: { rows: B20_ROWS } } }, '159593')).toThrow(/B55 快照缺失/);
    expect(parseB20Snapshot(v2({ 20: [['2026-11-19', 0.526316, 10, 19, 20, null, null]] }), '159593').periods.get(20)!.points.size).toBe(1); // 恰好 95%
  });

  it('悬浮：每个周期一行，百分比 + 站上 / 有效 / 篮子；预热、覆盖、PCF、Last-Modified 分开写', () => {
    const s = parseB20Snapshot(v2(), '159593');
    expect(bWindowLine(s, 20, '2026-11-19')).toBe('B20 62.0% · 站上 31 / 有效 50 / 篮子 50');
    expect(bWindowLine(s, 55, '2026-11-19')).toBe('B55 缺失 · 预热不足（需前 55 日）');
    expect(bWindowLine(s, 20, '2026-11-20')).toBe('B20 缺失 · 覆盖不足 有效 46 / 篮子 50');
    expect(bWindowLine(s, 120, '2026-11-23')).toBe('B120 缺失 · 当日 PCF 缺失（404）');
    expect(bWindowLine(s, 120, '2026-11-24')).toBe('B120 缺失 · Last-Modified 晚于 09:00:00');
    expect(bWindowLine(s, 120, '2026-11-25')).toBe('B120 43.8% · 站上 21 / 有效 48 / 篮子 50');
    expect(bWindowLine(s, 55, '2026-11-26')).toBe('B55 缺失 · 收盘后更新（快照截至 2026-11-25）');
    expect(bWindowLine(parseB20Snapshot(v1(), '159593'), 55, '2026-11-25')).toBe('B55 缺失 · 快照无此周期');
    expect(bNoteLine(s, [20, 55, 120], '2026-11-20')).toBe('未计入成员 B20 4（缺K线或复权未核实）');
    expect(bNoteLine(s, [20, 55, 120], '2026-11-25')).toBe('未计入成员 B120 2（缺K线或复权未核实）');
    expect(bNoteLine(s, [20, 55], '2026-11-25')).toBe('');
  });
});

describe('申赎篮子宽度副图', () => {
  const candles: Candle[] = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']
    .map((date, i) => ({ date, open: 1 + i / 100, close: 1.01 + i / 100, high: 1.02 + i / 100, low: .99 + i / 100, volume: 1000 }));
  const draw = (indicators: ChartIndicators, payload: unknown = v2(), range: { from?: string; to?: string } = {}) => {
    const holder = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    holder.appendChild(svg); document.body.appendChild(holder);
    const series = payload ? parseB20Snapshot(payload, '159593') : undefined;
    renderEquityChart(svg, [], undefined, undefined, [], undefined, undefined, candles, range, undefined, undefined, false, indicators, {}, undefined, series);
    return svg;
  };
  const all = { b20: true, b55: true, b120: true };
  const slot = (svg: SVGSVGElement, i: number) => Number(svg.dataset.plotLeft) + (i + .5) * Number(svg.dataset.plotWidth) / candles.length;

  it('三条线同一副图、同一日期轴，缺失断线，孤立点画圆点，线型可区分', () => {
    const svg = draw(all);
    const d20 = svg.querySelector('.b20-line')!.getAttribute('d')!, d55 = svg.querySelector('.b55-line')!.getAttribute('d')!, d120 = svg.querySelector('.b120-line')!.getAttribute('d')!;
    expect([d20.match(/M/g)?.length, d20.match(/L/g)?.length]).toEqual([2, 1]);   // 11-19 单点 + 11-24~25
    expect([d55.match(/M/g)?.length, d55.match(/L/g)?.length]).toEqual([2, 1]);   // 11-20 单点 + 11-24~25
    expect([d120.match(/M/g)?.length, d120.match(/L/g)?.length ?? 0]).toEqual([1, 0]); // 只有 11-25
    expect(svg.querySelectorAll('.b20-dot').length).toBe(1);
    expect(svg.querySelectorAll('.b120-dot').length).toBe(1);
    expect(svg.querySelector('.b55-line')!.getAttribute('stroke-dasharray')).toBe(B_STYLE[55].dash);
    expect(svg.querySelector('.b120-line')!.getAttribute('stroke-dasharray')).toBe(B_STYLE[120].dash);
    expect(svg.querySelector('.b20-line')!.hasAttribute('stroke-dasharray')).toBe(false);
    expect(new Set([20, 55, 120].map(n => svg.querySelector(`.b${n}-line`)!.getAttribute('stroke'))).size).toBe(3);
    // 与 K 线槽位对齐：B20 首点在第 2 根（11-19），B55 首点在第 3 根（11-20），B120 在第 6 根（11-25）
    expect(Number(d20.slice(1).split(',')[0])).toBeCloseTo(slot(svg, 1), 0);
    expect(Number(d55.slice(1).split(',')[0])).toBeCloseTo(slot(svg, 2), 0);
    expect(Number(d120.slice(1).split(',')[0])).toBeCloseTo(slot(svg, 5), 0);
    const title = svg.querySelector('.ptitle-b20')!.textContent!;
    expect(title).toContain('申赎篮子宽度（收盘，前 20/55/120 日）· 0–100%');
    expect(title).toContain('截至 2026-11-25');
    expect([...svg.querySelectorAll('.b-legend text')].map(t => t.textContent)).toEqual(['B20', 'B55', 'B120']);
    expect([...svg.querySelectorAll('text')].map(t => t.textContent)).toEqual(expect.arrayContaining(['0%', '50%', '100%']));
  });

  it('各周期分别开关；默认只开 B20 时与原 B20 副图一致', () => {
    const only20 = draw({ b20: true });
    expect(only20.querySelector('.b20-line')).not.toBeNull();
    expect(only20.querySelector('.b55-line')).toBeNull();
    expect(only20.querySelector('.b120-line')).toBeNull();
    expect(only20.querySelector('.ptitle-b20')!.textContent).toContain('前 20 日');
    expect([...only20.querySelectorAll('[class^="tip-b"]')].map(t => t.getAttribute('class'))).toEqual(['tip-b20', 'tip-b-note']);
    const no20 = draw({ b55: true, b120: true });
    expect(no20.querySelector('.b20-line')).toBeNull();
    expect([...no20.querySelectorAll('.b-legend text')].map(t => t.textContent)).toEqual(['B55', 'B120']);
    expect([...no20.querySelectorAll('[class^="tip-b"]')].map(t => t.getAttribute('class'))).toEqual(['tip-b55', 'tip-b120', 'tip-b-note']);
    // 旧 v1 快照：勾了 B55/B120 也只画 B20
    const old = draw(all, v1());
    expect([old.querySelector('.b20-line') !== null, old.querySelector('.b55-line'), old.querySelector('.b120-line')]).toEqual([true, null, null]);
  });

  it('全部关闭或未提供快照（其他 ETF）时不画', () => {
    expect(draw({}).querySelector('.ptitle-b20')).toBeNull();
    expect(draw(all, null).querySelector('.ptitle-b20')).toBeNull();
    expect(draw(all, null).querySelector('.tip-b20')).toBeNull();
  });

  it('区间切换只画区间内的日期；区间内某周期全无记录时不进图例', () => {
    const svg = draw(all, v2(), { from: '2026-11-24' });
    expect(svg.querySelector('.b20-line')!.getAttribute('d')!.match(/[ML]/g)).toEqual(['M', 'L']);
    expect(svg.querySelector('.b120-line')!.getAttribute('d')!.match(/[ML]/g)).toEqual(['M']);
    expect(draw(all, v2(), { from: '2026-11-26' }).querySelector('.ptitle-b20')).toBeNull(); // 区间内没有记录
    const early = draw(all, v2({ 20: B20_ROWS, 55: B55_ROWS, 120: B120_ROWS.slice(3) }), { to: '2026-11-20' });
    expect([...early.querySelectorAll('.b-legend text')].map(t => t.textContent)).toEqual(['B20', 'B55']);
  });
});
