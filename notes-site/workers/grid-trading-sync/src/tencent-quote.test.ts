import { describe, expect, it } from 'vitest';
import { parseTencentQuoteBody } from './tencent-quote';

const line = (code: string, type: string, premium: string, nav: string, price = '0.513') => {
  const fields = Array<string>(88).fill('');
  Object.assign(fields, { 1: 'ETF', 3: price, 30: '20261019161458', 33: '0.514', 34: '0.510', 61: type, 77: premium, 78: nav });
  return `v_sh${code}="${fields.join('~')}";`;
};

describe('parseTencentQuoteBody', () => {
  it('keeps ETF premium including zero; skips empty premium and stocks', () => {
    const body = line('513180', 'ETF', '-0.14', '0.5137') + line('510300', 'ETF', '0', '0.513')
      + line('510500', 'ETF', '', '0.513') + line('600989', 'GP-A', '3', '20');
    const rows = parseTencentQuoteBody(new TextEncoder().encode(body).buffer);
    expect(rows).toEqual([
      { code: '513180', date: '20261019', premiumRate: -0.14, referenceNav: 0.5137, price: 0.513 },
      { code: '510300', date: '20261019', premiumRate: 0, referenceNav: 0.513, price: 0.513 },
    ]);
  });
});
