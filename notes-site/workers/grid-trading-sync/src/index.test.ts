import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailyFetchBudget, type Env, readPremiums, syncPremiums } from './index';

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
