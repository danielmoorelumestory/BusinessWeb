import { afterEach, describe, expect, it, vi } from 'vitest';
import { clsDayLimit, dailyFetchBudget, type Env, readPremiums, runSync, shouldTriggerDailyAnalysis, syncPremiums, triggerDailyAnalysis } from './index';

type Call = { sql: string; bindings: unknown[] };

function fakeEnv(results: unknown[] = []) {
  const calls: Call[] = [];
  const DB = {
    prepare(sql: string) {
      const call = { sql, bindings: [] as unknown[] };
      calls.push(call);
      const statement = {
        bind(...bindings: unknown[]) {
          call.bindings = bindings;
          return statement;
        },
        run: async () => ({ success: true }),
        all: async () => ({ results }),
        first: async () => null,
      };
      return statement;
    },
  };
  return { env: { DB } as unknown as Env, calls };
}

const quoteBody = (code: string) => {
  const fields = Array<string>(88).fill('');
  Object.assign(fields, { 3: '1.234', 30: '20261019161458', 61: 'ETF', 77: '-0.14', 78: '1.236' });
  return `v_sh${code}="${fields.join('~')}";`;
};

afterEach(() => vi.unstubAllGlobals());

describe('dailyFetchBudget', () => {
  it('reserves one premium request per 40 codes within the worker fetch limit', () => {
    expect(dailyFetchBudget(41)).toBe(5);
    expect(41 + dailyFetchBudget(41) + Math.ceil(41 / 40)).toBe(48);
    expect(dailyFetchBudget(50)).toBe(0);
  });
});

describe('定时任务 fetch 配额', () => {
  it('日K 预算扣除 CLS 已用请求，总数不超过上限', () => {
    expect(dailyFetchBudget(26, 7)).toBe(14);
    expect(7 + 1 + 26 + dailyFetchBudget(26, 7)).toBe(48);
    expect(dailyFetchBudget(26, 25)).toBe(0);
  });
  it('标的越多 CLS 补缺天数越少，但始终刷新最近 2 日', () => {
    expect(clsDayLimit(0)).toBe(8);
    expect(clsDayLimit(26)).toBe(6);
    expect(clsDayLimit(47)).toBe(2);
  });
});

describe('每日分析触发', () => {
  const at = (iso: string) => Date.parse(iso);
  it('只在北京时间 15:45 这一轮触发', () => {
    expect(shouldTriggerDailyAnalysis(at('2026-11-03T07:45:00Z'))).toBe(true);
    expect(shouldTriggerDailyAnalysis(at('2026-11-03T07:30:00Z'))).toBe(false);
    expect(shouldTriggerDailyAnalysis(at('2026-11-03T02:45:00Z'))).toBe(false);
  });
  it('没有配置密钥时不发请求', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await triggerDailyAnalysis(fakeEnv().env);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('配置密钥后触发 main 上的工作流，失败不抛错', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('nope', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await triggerDailyAnalysis({ ...fakeEnv().env, GITHUB_DISPATCH_TOKEN: 'token' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/actions/workflows/daily-analysis-snapshot.yml/dispatches');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ ref: 'main' }));
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer token');
  });
});

describe('runSync', () => {
  it('fetches premiums before minute and daily bars so the worker fetch limit cannot starve them', async () => {
    const { env } = fakeEnv();
    const fetchMock = vi.fn(async (_url: string) => new Response(new TextEncoder().encode(quoteBody('510300'))));
    vi.stubGlobal('fetch', fetchMock);
    await runSync(env, 'cron', ['510300']);
    expect(String(fetchMock.mock.calls[0][0])).toContain('qt.gtimg.cn');
  });
});

describe('syncPremiums', () => {
  it('uses exchange prefix plus code and upserts parsed premiums', async () => {
    const { env, calls } = fakeEnv();
    const fetchMock = vi.fn(async () => new Response(new TextEncoder().encode(quoteBody('510300'))));
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncPremiums(env, ['510300', '510300', 'bad'])).resolves.toEqual({ ok: 1, skipped: 0, failed: 0 });
    expect(fetchMock).toHaveBeenCalledWith('https://qt.gtimg.cn/q=sh510300');
    expect(calls.at(-1)?.bindings).toEqual(['510300', '20261019', -0.14, 1.236, 1.234, expect.any(Number)]);
  });
});

describe('readPremiums', () => {
  it('normalizes date filters and returns camel-cased rows', async () => {
    const row = { code: '510300', date: '2026-10-19', premiumRate: -0.14, referenceNav: 1.236, price: 1.234 };
    const { env, calls } = fakeEnv([row]);

    const response = await readPremiums(env, new URL('https://worker/premium?codes=510300,510300,bad&from=2026-10-01&to=2026-10-19'));

    await expect(response.json()).resolves.toEqual({ premiums: [row] });
    expect(calls.at(-1)?.bindings).toEqual(['510300', '20261001', '20261019']);
  });
});
