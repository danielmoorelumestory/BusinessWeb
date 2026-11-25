import { describe, expect, it } from 'vitest';
import { B20_SNAPSHOTS, b20TipLines, parseB20Snapshot } from './grid-b20';
import { renderEquityChart, type Candle } from './grid-trading';

const FIELDS = ['date', 'value', 'above', 'valid', 'total', 'reason', 'detail'];
const snapshot = (rows: unknown[][], extra: Record<string, unknown> = {}) => ({
  version: 1, code: '159593', through: '2026-11-25', generatedAt: '2026-11-25T22:00:00+08:00', fields: FIELDS,
  reasons: { pcf: '当日 PCF 缺失（404）', coverage: '有效成员覆盖率低于 95%', lm_late: 'PCF 的 Last-Modified 晚于当日 09:00:00（沿用原研究严格版留空；服务器元数据，不等于实际发布时间）', lm_missing: 'PCF 缺 Last-Modified，无法套用可得性门槛' },
  summary: { days: rows.length, value: 0, firstValid: null, lastValid: null, coverage: 0, pcf: 0, lm_late: 0, lm_missing: 0, members: 50, baskets: 1 },
  rows, ...extra,
});
const ROWS = [
  ['2026-11-19', 0.62, 31, 50, 50, null, null],
  ['2026-11-20', null, 29, 46, 50, 'coverage', '未知 4（缺K线 3，复权未核实 1）'],
  ['2026-11-23', null, null, null, null, 'pcf', 'PCF 404'],
  ['2026-11-24', 0.5, 25, 50, 50, null, null],
  ['2026-11-25', 0.52, 26, 50, 50, null, null],
];

describe('B20 快照解析', () => {
  it('只为已核验的 159593 提供快照', () => {
    expect(Object.keys(B20_SNAPSHOTS)).toEqual(['159593']);
  });

  it('解析行并保留缺失原因与计数', () => {
    const series = parseB20Snapshot(snapshot(ROWS), '159593');
    expect(series.points.size).toBe(5);
    expect(series.points.get('2026-11-20')).toMatchObject({ value: null, above: 29, valid: 46, total: 50, reason: 'coverage' });
  });

  it('拒绝代码不符、数值与计数不符、覆盖率不足却有值、日期越过截止日', () => {
    expect(() => parseB20Snapshot(snapshot(ROWS), '510300')).toThrow();
    expect(() => parseB20Snapshot(snapshot([['2026-11-19', 0.7, 31, 50, 50, null, null]]), '159593')).toThrow(/不符/);
    expect(() => parseB20Snapshot(snapshot([['2026-11-19', 0.5, 23, 46, 50, null, null]]), '159593')).toThrow(/不符/);
    expect(() => parseB20Snapshot(snapshot([['2026-11-26', 0.5, 25, 50, 50, null, null]]), '159593')).toThrow(/日期/);
    expect(() => parseB20Snapshot(snapshot([['2026-11-19', null, 25, 50, 50, null, null]]), '159593')).toThrow(/原因/);
    // 恰好 95%（19/20）可以有值
    expect(parseB20Snapshot(snapshot([['2026-11-19', 0.526316, 10, 19, 20, null, null]]), '159593').points.size).toBe(1);
  });

  it('悬浮文字：百分比 + 站上 / 有效 / 篮子；缺失时写原因；截止日之后提示收盘后更新', () => {
    const series = parseB20Snapshot(snapshot(ROWS), '159593');
    expect(b20TipLines(series, '2026-11-19')).toEqual(['B20 申赎篮子宽度 62.0%（收盘）', '站上 31 / 有效 50 / 篮子 50', '']);
    expect(b20TipLines(series, '2026-11-20')).toEqual(['B20 缺失 · 有效成员不足篮子 95%', '站上 29 / 有效 46 / 篮子 50', '未知 4（缺K线 3，复权未核实 1）']);
    expect(b20TipLines(series, '2026-11-23')).toEqual(['B20 缺失 · 当日 PCF 缺失（404）', '', 'PCF 404']);
    expect(b20TipLines(series, '2026-11-26')).toEqual(['B20 缺失 · 收盘后更新', '快照截至 2026-11-25', '']);
  });
});

describe('B20 副图', () => {
  const candles: Candle[] = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']
    .map((date, i) => ({ date, open: 1 + i / 100, close: 1.01 + i / 100, high: 1.02 + i / 100, low: .99 + i / 100, volume: 1000 }));
  const draw = (b20: boolean, withSeries = true, range: { from?: string; to?: string } = {}) => {
    const holder = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    holder.appendChild(svg); document.body.appendChild(holder);
    const series = withSeries ? parseB20Snapshot(snapshot(ROWS), '159593') : undefined;
    renderEquityChart(svg, [], undefined, undefined, [], undefined, undefined, candles, range, undefined, undefined, false, { b20 }, {}, undefined, series);
    return svg;
  };

  it('与 K 线同一日期轴：缺失日断线，孤立点画圆点，标题与 0–100% 刻度', () => {
    const svg = draw(true);
    const d = svg.querySelector('.b20-line')!.getAttribute('d')!;
    expect(d.match(/M/g)?.length).toBe(2);           // 11-19 单点（11-20 缺）+ 11-24~25 一段
    expect(d.match(/L/g)?.length).toBe(1);
    expect(svg.querySelectorAll('circle[fill="#0d9488"]').length).toBe(1);
    expect(svg.querySelector('.ptitle-b20')!.textContent).toContain('B20 申赎篮子宽度（收盘观察）· 0–100%');
    expect([...svg.querySelectorAll('text')].map(t => t.textContent)).toEqual(expect.arrayContaining(['0%', '50%', '100%']));
    // 竖线位置与 K 线槽位一致：第 2 根（11-19）
    const slot = Number(svg.dataset.plotWidth) / candles.length, left = Number(svg.dataset.plotLeft);
    expect(Number(d.slice(1).split(',')[0])).toBeCloseTo(left + 1.5 * slot, 0);
  });

  it('关闭开关或未提供快照（其他 ETF）时不画', () => {
    expect(draw(false).querySelector('.b20-line')).toBeNull();
    expect(draw(true, false).querySelector('.b20-line')).toBeNull();
    expect(draw(true, false).querySelector('.tip-b20')).toBeNull();
  });

  it('区间切换只画区间内的日期', () => {
    const svg = draw(true, true, { from: '2026-11-24' });
    const d = svg.querySelector('.b20-line')!.getAttribute('d')!;
    expect(d.match(/M/g)?.length).toBe(1);
    expect(d.match(/L/g)?.length).toBe(1);
    expect(draw(true, true, { from: '2026-11-26' }).querySelector('.b20-line')).toBeNull(); // 区间内没有 B20 记录
  });
});
