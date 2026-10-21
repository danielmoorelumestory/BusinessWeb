import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Budget, dailyBars, eastmoneyUrl, parseEastmoneyKlines, resetTencentCooldown } from './index';

const tencentBody = { data: { sh510300: { day: [['2026-10-20', '4.2', '4.3', '4.4', '4.1', '100']], qfqday: [['2026-10-20', '4.2', '4.3', '4.4', '4.1', '100']] } } };
const eastmoneyBody = { data: { klines: ['2026-10-19,4.1,4.2,4.3,4.0,90', '2026-10-20,4.2,4.3,4.4,4.1,100', 'bad row'] } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('日 K 备用源：腾讯失败时改用东方财富', () => {
  let calls: string[];
  const mockFetch = (tencent: () => Response) => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { calls.push(url); return url.includes('eastmoney') ? json(eastmoneyBody) : tencent(); }));
  };
  beforeEach(() => resetTencentCooldown());
  afterEach(() => vi.unstubAllGlobals());

  it('腾讯三个入口都返回 501 时使用东方财富，丢弃坏行，并一次取整段', async () => {
    mockFetch(() => json({}, 501));
    const bars = await dailyBars('sh510300', '2026-10-01', '', new Budget(48));
    expect([...bars.keys()]).toEqual(['2026-10-19', '2026-10-20']);
    expect(bars.get('2026-10-20')).toEqual({ open: 4.2, close: 4.3, high: 4.4, low: 4.1, volume: 100 });
    expect(calls.filter(url => url.includes('eastmoney'))).toHaveLength(1);
  });
  it('腾讯正常时不访问东方财富', async () => {
    mockFetch(() => json(tencentBody));
    const bars = await dailyBars('sh510300', '2026-10-01', 'qfq', new Budget(48));
    expect(bars.size).toBe(1);
    expect(calls.some(url => url.includes('eastmoney'))).toBe(false);
  });
  it('切到东方财富后进入冷却，后续请求直接走东方财富，不再消耗腾讯的子请求', async () => {
    mockFetch(() => json({}, 501));
    await dailyBars('sh510300', '2026-10-01', '', new Budget(48));
    calls.length = 0;
    await dailyBars('sh510300', '2026-10-01', 'qfq', new Budget(48));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('fqt=1');
  });
  it('东方财富也失败时报出两边的具体原因', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 501)));
    await expect(dailyBars('sh510300', '2026-10-01', '', new Budget(48))).rejects.toThrow(/gtimg\.cn HTTP 501.*eastmoney\.com HTTP 501/);
  });
  it('东方财富 URL：沪市 secid=1、深市 0，fqt 区分复权，日期为 YYYYMMDD', () => {
    expect(eastmoneyUrl('sh510300', '2026-10-01', '2026-10-21', 'qfq')).toContain('secid=1.510300&klt=101&fqt=1&beg=20261001&end=20261021');
    expect(eastmoneyUrl('sz159915', '2026-10-01', '2026-10-21', '')).toContain('secid=0.159915&klt=101&fqt=0');
  });
  it('klines 解析：列数不足、日期格式错误、非数组都被忽略', () => {
    expect(parseEastmoneyKlines(['2026-10-20,1,2,3,4,5', '2026-10-20,1,2', 'x,1,2,3,4,5'])).toEqual([['2026-10-20', '1', '2', '3', '4', '5']]);
    expect(parseEastmoneyKlines(null)).toEqual([]);
  });
});
