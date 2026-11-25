const PAGE_SIZE = 640;
const ENDPOINTS = [
  'https://web.ifzq.gtimg.cn/appstock/app/newfqkline/get',
  'https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get',
];

type Kline = unknown[];
type KlineResponse = { data?: Record<string, { qfqday?: Kline[]; day?: Kline[] }> };
export type TurnoverTrendPoint = { amount: number; weighted: number };

async function turnoverPage(symbol: string, from: string, to: string): Promise<Kline[]> {
  const param = new URLSearchParams({ param: [symbol, 'day', from, to, PAGE_SIZE, 'qfq'].join(',') });
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?${param}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) continue;
      const payload: KlineResponse = await response.json();
      const data = payload.data?.[symbol];
      const rows = data?.qfqday ?? data?.day;
      if (Array.isArray(rows)) return rows;
    } catch { /* 同源备用接口 */ }
  }
  throw new Error('日线成交额暂时无法获取');
}

/** 腾讯扩展日线第 9 项是实际成交额（万元），与复权价格无关。 */
export async function fetchDailyTurnover(symbol: string, from: string, through: string): Promise<Map<string, number>> {
  if (!/^(sh|sz)\d{6}$/.test(symbol)) throw new Error('不支持的行情代码');
  const amounts = new Map<string, number>();
  let to = through;
  while (to >= from) {
    const rows = await turnoverPage(symbol, from, to);
    const first = rows[0]?.[0];
    if (rows.length && (typeof first !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(first) || first > to)) {
      throw new Error('日线成交额日期异常');
    }
    for (const row of rows) {
      const date = row[0], raw = row[8];
      const amount = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
      if (typeof date === 'string' && date >= from && date <= to && Number.isFinite(amount) && amount > 0) {
        amounts.set(date, amount / 10000); // 人民币亿元
      }
    }
    if (rows.length < PAGE_SIZE || typeof first !== 'string' || first <= from) break;
    const previous = new Date(`${first}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    to = previous.toISOString().slice(0, 10);
  }
  return amounts;
}

/** 成交额缺失时断开。每段首日加权值等于 11 倍当日额，其后以 10/11 衰减。 */
export function turnoverTrend(bars: readonly { date: string }[], amounts: ReadonlyMap<string, number>): Map<string, TurnoverTrendPoint> {
  const points = new Map<string, TurnoverTrendPoint>();
  let previous: number | undefined;
  for (const { date } of bars) {
    const amount = amounts.get(date);
    if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
      previous = undefined;
      continue;
    }
    const weighted: number = previous === undefined ? 11 * amount : amount + (10 / 11) * previous;
    points.set(date, { amount, weighted });
    previous = weighted;
  }
  return points;
}
