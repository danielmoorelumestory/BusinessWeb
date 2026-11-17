// 复盘页两组回测优选（创业板择时优选、沪深300择时优选）的买卖点 → Telegram 提醒。
// 买卖规则与详情页标注完全一致（复用 plan-trades.ts）：
// - 创业板择时优选：Y1 = 创业板÷红利 择时 + B+KD10（金叉 / 站上10日线 次日开盘买；死叉 / 熊市破10日线 当日收盘卖）。
// - 沪深300择时优选：只认金叉 = 沪深300÷红利 择时牛市金叉次日开盘买、熊市不开新仓、死叉当日收盘卖。
// 每个交易日两次（由 index.ts 的盘中 15 分钟定时任务在对应时刻调用）：
// - pre   北京 14:45：用实时价当作今日收盘估算，不论有没有信号都发（买入 / 卖出 / 持有三段），顺带确认服务正常；
// - close 北京 15:15：按真实收盘重算，只有与 14:45 不同（或 14:45 没发出）时才发。
// 同一交易日同一时段只发一次（plan_alert_log）。
import macdGood from '../../../../src/data/etfMacdGood.json';
import hs300Timing from '../../../../src/data/etfHs300Timing.json';
import { cybPlan, hsPlan, type PlanBar, type PlanResult } from '../../../src/lib/plan-trades';
import { H1_CODES, R2_CODES, styleRatio } from '../../../src/lib/chart-indicators';

export type AlertPhase = 'pre' | 'close';
export type AlertAction = 'sell-today-close' | 'buy-next-open' | 'sell-next-open';
export type PlanAlert = { code: string; name: string; action: AlertAction; reason: string; price: number };
export type Quote = { price: number; open: number; high: number; low: number; date: string; changePercent?: number };
export type GroupDef = { key: 'cyb' | 'hs'; title: string; timing: string; items: { code: string; name: string }[] };

export const PLAN_GROUPS: GroupDef[] = [
  { key: 'cyb', title: '创业板择时优选', timing: '创业板÷红利', items: macdGood.items.map(({ code, name }) => ({ code, name })) },
  { key: 'hs', title: '沪深300择时优选', timing: '沪深300÷红利', items: hs300Timing.items.map(({ code, name }) => ({ code, name })) },
];

/** 盘中 15 分钟任务里只有这两个时刻发提醒：UTC 06:45 = 北京 14:45，UTC 07:15 = 北京 15:15。 */
export const alertPhaseOf = (scheduledTime: number): AlertPhase | undefined => {
  const time = new Date(scheduledTime), hm = time.getUTCHours() * 60 + time.getUTCMinutes();
  return hm === 6 * 60 + 45 ? 'pre' : hm === 7 * 60 + 15 ? 'close' : undefined;
};

/** 行情代码：ETF 按首位判断沪深，已带前缀的（指数 sh000300）原样使用。 */
export const marketSymbol = (code: string) => /^(sh|sz)\d{6}$/.test(code) ? code : `${/^[569]/.test(code) ? 'sh' : 'sz'}${code}`;

/**
 * 择时比值里的 ETF（创业板 159915、红利 510880）取后复权日线：腾讯前复权对 ETF 是按累计分红减固定金额，
 * 分红多的红利 ETF 涨跌幅被放大，比值与研究回测（加回分红）口径不一致；后复权与研究基本一致（同向约 99.5%）。
 * 指数（sh000300）无复权问题。这些代码不能同时是买卖标的（标的买卖点仍用前复权）。
 */
export const RATIO_HFQ_SYMBOLS = new Set([R2_CODES, H1_CODES].flatMap(codes => [codes.growth, codes.defensive]).filter(code => !/^(sh|sz)/.test(code)).map(marketSymbol));

/** 后复权日线并入实时报价：报价是不复权价格，按当日涨跌幅换算；没有涨跌幅时不并入。 */
export function mergeLiveByChange(bars: PlanBar[], quote: Quote | undefined, today: string): PlanBar[] {
  if (!quote || quote.date !== today || quote.changePercent === undefined || !bars.length) return bars;
  const last = bars.at(-1)!;
  const base = last.date === today ? bars.at(-2) : last.date < today ? last : undefined;
  if (!base) return bars;
  const close = base.close * (1 + quote.changePercent / 100);
  if (last.date === today) return [...bars.slice(0, -1), { ...last, close, high: Math.max(last.high, close), low: Math.min(last.low, close) }];
  return [...bars, { date: today, open: close, high: close, low: close, close }];
}

/** 实时报价并入日线：同日则更新收盘/高/低，晚于最后一根则追加；只合并今天的报价。 */
export function mergeLive(bars: PlanBar[], quote: Quote | undefined, today: string): PlanBar[] {
  if (!quote || quote.date !== today || !(quote.price > 0)) return bars;
  const last = bars.at(-1);
  if (last?.date === today) return [...bars.slice(0, -1), { ...last, close: quote.price, high: Math.max(last.high, quote.high), low: Math.min(last.low, quote.low) }];
  if (last && last.date > today) return bars;
  return [...bars, { date: today, open: quote.open > 0 ? quote.open : quote.price, high: quote.high, low: quote.low, close: quote.price }];
}

const NEXT = '9999-12-31';

/**
 * 今天这根K线触发的动作。在最后补一根假想的「下一交易日」K线（开收高低都等于今日收盘），
 * 这样规则引擎里挂起的次日开盘买 / 卖（含 T+1 顺延卖出）都会落到这根K线上，统一识别。
 * 最后一根不是今天（停牌、数据未更新）时不给信号。
 */
export function todayActions(bars: PlanBar[], today: string, run: (bars: PlanBar[]) => PlanResult): Omit<PlanAlert, 'code' | 'name'>[] {
  const last = bars.at(-1);
  if (!last || last.date !== today) return [];
  const result = run([...bars, { date: NEXT, open: last.close, high: last.close, low: last.close, close: last.close }]);
  return result.signals.flatMap((signal): Omit<PlanAlert, 'code' | 'name'>[] => {
    if (signal.signalDate !== today) return [];
    if (signal.date === today && signal.side === 'sell') return [{ action: 'sell-today-close' as const, reason: signal.reason, price: last.close }];
    if (signal.date === NEXT) return [{ action: signal.side === 'buy' ? 'buy-next-open' as const : 'sell-next-open' as const, reason: signal.reason, price: last.close }];
    return [];
  });
}

/** 按规则当前持有的一笔：买入日、买入价（开盘）、按最新价（盘中为实时价）计的涨跌。 */
export type Holding = { code: string; name: string; buyDate: string; buyPrice: number; ret: number };
export type GroupResult = { group: GroupDef; bull?: boolean; alerts: PlanAlert[]; failed: string[]; holdings?: Holding[] };

/** 规则引擎在最后一根K线结束时仍持有的一笔；今日收盘已卖出的不算持有。 */
export function currentHolding(bars: PlanBar[], run: (bars: PlanBar[]) => PlanResult): Omit<Holding, 'code' | 'name'> | undefined {
  const last = bars.at(-1);
  if (!last) return undefined;
  const result = run(bars), buy = result.signals.at(-1);
  if (!result.holding || buy?.side !== 'buy' || !(buy.price > 0)) return undefined;
  return { buyDate: buy.date, buyPrice: buy.price, ret: last.close / buy.price - 1 };
}

/** bars：按行情代码给出前复权日线（已并入实时价）；缺失的代码记为取数失败。 */
export function evaluateGroups(barsOf: Map<string, PlanBar[]>, today: string): GroupResult[] {
  const ratio = (codes: { growth: string; defensive: string }) => {
    const growth = barsOf.get(marketSymbol(codes.growth)), defensive = barsOf.get(marketSymbol(codes.defensive));
    return growth && defensive ? styleRatio(growth, defensive) : undefined;
  };
  const ratios = { cyb: ratio(R2_CODES), hs: ratio(H1_CODES) };
  return PLAN_GROUPS.map(group => {
    const points = ratios[group.key];
    if (!points?.length) return { group, alerts: [], failed: [`${group.timing} 择时数据`] };
    const lastPoint = points.at(-1)!;
    const bull = lastPoint.date === today && lastPoint.bull !== null ? lastPoint.bull : undefined;
    const run = (bars: PlanBar[]) => group.key === 'cyb' ? cybPlan(bars, points) : hsPlan(bars, points);
    const alerts: PlanAlert[] = [], failed: string[] = [], holdings: Holding[] = [];
    for (const item of group.items) {
      const bars = barsOf.get(marketSymbol(item.code));
      if (!bars?.length) { failed.push(item.code); continue; }
      for (const action of todayActions(bars, today, run)) alerts.push({ code: item.code, name: item.name, ...action });
      const holding = currentHolding(bars, run);
      if (holding) holdings.push({ code: item.code, name: item.name, ...holding });
    }
    return { group, bull, alerts, failed, holdings };
  });
}

/** 动作时点：卖出分今日尾盘 / 今日收盘已触发 / 明日开盘（T+1 顺延），买入都是明日开盘。 */
const WHEN_TEXT: Record<AlertPhase, Record<AlertAction, string>> = {
  pre: { 'sell-today-close': '今日尾盘', 'buy-next-open': '明日开盘', 'sell-next-open': '明日开盘' },
  close: { 'sell-today-close': '今日收盘（已触发）', 'buy-next-open': '明日开盘', 'sell-next-open': '明日开盘' },
};

const pct = (ret: number) => `${ret >= 0 ? '+' : ''}${(ret * 100).toFixed(2)}%`;

/**
 * 不分择时分组，只分「买入 / 卖出 / 持有」三段；盘中预估由「今日尾盘 / 现价」区分。
 * 是否发送由 shouldSend 决定；header 为可选的首行（如收盘更正）。
 */
export function formatMessage(results: GroupResult[], phase: AlertPhase, header?: string): string {
  const alerts = results.flatMap(result => result.alerts), holdings = results.flatMap(result => result.holdings ?? []);
  const failed = [...new Set(results.flatMap(result => result.failed))];
  const priceLabel = phase === 'pre' ? '现价' : '收盘';
  const actionLine = (alert: PlanAlert) => `${WHEN_TEXT[phase][alert.action]} ${alert.code} ${alert.name}（${alert.reason}，${priceLabel} ${alert.price.toFixed(3)}）`;
  const section = (title: string, lines: string[]) => [title, ...(lines.length ? lines : ['无'])].join('\n');
  const parts = [
    section('🟢 买入', alerts.filter(alert => alert.action === 'buy-next-open').map(actionLine)),
    section('🔴 卖出', alerts.filter(alert => alert.action !== 'buy-next-open').sort((x, y) => x.action === y.action ? 0 : x.action === 'sell-today-close' ? -1 : 1).map(actionLine)),
    section('📌 持有', holdings.map(h => `${h.code} ${h.name} ${pct(h.ret)}（${h.buyDate.slice(5)}买入 ${h.buyPrice.toFixed(3)}）`)),
  ];
  if (failed.length) parts.push(`⚠️ 取数失败：${failed.join('、')}`);
  return [...(header ? [header] : []), ...parts].join('\n\n');
}

/** 买卖信号的指纹（动作+代码），用来比较 14:45 预估与收盘结果是否一致。 */
export const alertKeys = (results: GroupResult[]) => results.flatMap(result => result.alerts.map(alert => `${alert.action}:${alert.code}`)).sort().join(',');

/**
 * 14:45 不论有没有信号都发（顺带确认服务正常）；
 * 15:15 只在收盘信号与 14:45 不同（或 14:45 没发出）时发，并在首行说明。返回 undefined 表示不发。
 */
export function closeHeader(keys: string, preKeys: string | undefined): string | undefined {
  if (preKeys === undefined) return '收盘确认（14:45 未发出）';
  return keys === preKeys ? undefined : '⚠️ 收盘结果与 14:45 不同，以此为准';
}

/** 腾讯实时报价（GBK），一次请求多只；指数用带前缀的代码请求。 */
export async function fetchLiveQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const response = await fetch(`https://qt.gtimg.cn/q=${symbols.join(',')}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`实时报价 HTTP ${response.status}`);
  const text = new TextDecoder('gbk').decode(await response.arrayBuffer());
  const quotes = new Map<string, Quote>();
  for (const match of text.matchAll(/v_((?:sh|sz)\d{6})="([^"]*)"/g)) {
    const fields = match[2].split('~'), stamp = fields[30] ?? '';
    const quote: Quote = { price: Number(fields[3]), open: Number(fields[5]), high: Number(fields[33]), low: Number(fields[34]), date: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}` };
    if (fields[32]?.trim() && Number.isFinite(Number(fields[32]))) quote.changePercent = Number(fields[32]);
    if (stamp.length >= 8 && quote.price > 0 && quote.high > 0 && quote.low > 0) quotes.set(match[1], quote);
  }
  return quotes;
}

export async function sendTelegram(token: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}: ${await response.text()}`);
}

export const allSymbols = () => [...new Set([
  ...[R2_CODES, H1_CODES].flatMap(codes => [codes.growth, codes.defensive]),
  ...PLAN_GROUPS.flatMap(group => group.items.map(item => item.code)),
].map(marketSymbol))];

export type AlertDeps = {
  today: string;
  /** 取某行情代码近两年多的日线（升序）；默认前复权，择时比值里的 ETF 传 'hfq' 取后复权。 */
  loadBars: (symbol: string, fq?: 'qfq' | 'hfq') => Promise<PlanBar[]>;
  loadQuotes?: (symbols: string[]) => Promise<Map<string, Quote>>;
};

/** 取数并算出两组的信号与消息正文；今天不是交易日（红利 ETF 报价日期不是今天）时 tradingDay 为 false。 */
export async function buildPlanAlert({ today, loadBars, loadQuotes = fetchLiveQuotes }: AlertDeps, phase: AlertPhase) {
  const symbols = allSymbols();
  const quotes = await loadQuotes(symbols).catch(error => { console.error('择时提醒：实时报价失败', error); return new Map<string, Quote>(); });
  const anchor = quotes.get(marketSymbol(R2_CODES.defensive));
  if (anchor && anchor.date !== today) return { tradingDay: false as const };
  const barsOf = new Map<string, PlanBar[]>();
  for (const symbol of symbols) {
    try {
      barsOf.set(symbol, RATIO_HFQ_SYMBOLS.has(symbol)
        ? mergeLiveByChange(await loadBars(symbol, 'hfq'), quotes.get(symbol), today)
        : mergeLive(await loadBars(symbol), quotes.get(symbol), today));
    } catch (error) {
      console.error('择时提醒：日线失败', symbol, error);
      if (error instanceof Error && error.message === 'BUDGET') break;
    }
  }
  // 报价失败时用日线最后一根判断是否交易日
  if (!anchor && barsOf.get(marketSymbol(R2_CODES.defensive))?.at(-1)?.date !== today) return { tradingDay: false as const };
  const results = evaluateGroups(barsOf, today);
  return { tradingDay: true as const, results, keys: alertKeys(results), text: formatMessage(results, phase) };
}
