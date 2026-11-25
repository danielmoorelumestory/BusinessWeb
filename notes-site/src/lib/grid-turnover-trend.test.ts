import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDailyTurnover, turnoverTrend } from './grid-turnover-trend';

afterEach(() => vi.unstubAllGlobals());

describe('成交额加权趋势', () => {
  it('按完整日线递推，成交额缺失后按段首重启', () => {
    const bars = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24'].map(date => ({ date }));
    const points = turnoverTrend(bars, new Map([
      ['2026-11-18', 2],
      ['2026-11-19', 4],
      ['2026-11-23', 3],
      ['2026-11-24', 5],
    ]));
    expect([...points]).toEqual([
      ['2026-11-18', { amount: 2, weighted: 22 }],
      ['2026-11-19', { amount: 4, weighted: 24 }],
      ['2026-11-23', { amount: 3, weighted: 33 }],
      ['2026-11-24', { amount: 5, weighted: 35 }],
    ]);
  });

  it('逐页取 ETF 第九项成交额，万元换算亿元，跳过无效或范围外的值', async () => {
    const row = (date: string, amount: unknown) => [date, '1', '1', '1', '1', '999', {}, '1', amount];
    const history = Array.from({ length: 640 }, (_, i) => {
      const date = new Date(Date.UTC(2024, 3, 8 + i)).toISOString().slice(0, 10);
      return row(date, '3790.61');
    });
    const respond = (rows: unknown[][]) => Response.json({ data: { sz159593: { day: rows } } });
    const fetch = vi.fn()
      .mockResolvedValueOnce(respond(history))
      .mockResolvedValueOnce(respond([
        row('2024-04-01', '3564.29'), row('2024-04-02', ''), row('2024-04-03', 0), row('2024-04-08', 9999),
      ]));
    vi.stubGlobal('fetch', fetch);

    const points = await fetchDailyTurnover('sz159593', '2024-04-01', '2026-11-25');

    expect(points.get('2024-04-01')).toBeCloseTo(0.356429);
    expect(points.has('2024-04-02')).toBe(false);
    expect(points.has('2024-04-03')).toBe(false);
    expect(points.get('2024-04-08')).toBeCloseTo(0.379061);
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('param')).toBe('sz159593,day,2024-04-01,2024-04-07,640,qfq');
  });
});
