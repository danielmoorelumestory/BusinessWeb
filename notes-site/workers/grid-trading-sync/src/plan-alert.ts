// 复盘页两组回测优选（创业板择时优选、沪深300择时优选）的买卖点 → Telegram 提醒。
// 买卖规则与详情页标注完全一致（复用 plan-trades.ts）：
// - 创业板择时优选：Y1 = 创业板÷红利 择时 + B+KD10（金叉 / 站上10日线 次日开盘买；死叉 / 熊市破10日线 当日收盘卖）。
// - 沪深300择时优选：只认金叉 = 沪深300÷红利 择时牛市金叉次日开盘买、熊市不开新仓、死叉当日收盘卖。
// 每个交易日两次（由 index.ts 的盘中 15 分钟定时任务在对应时刻调用）：
// - pre   北京 14:45：用实时价当作今日收盘估算，提醒「今日尾盘卖」与「若收盘维持则明日开盘买」；
// - close 北京 15:15：收盘后确认，列出明日开盘要买 / 卖的标的及今日收盘已触发的卖出。
// 没有任何信号时不发消息；同一交易日同一时段只发一次（plan_alert_log）。
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

export type GroupResult = { group: GroupDef; bull?: boolean; alerts: PlanAlert[]; failed: string[] };

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
    const alerts: PlanAlert[] = [], failed: string[] = [];
    for (const item of group.items) {
      const bars = barsOf.get(marketSymbol(item.code));
      if (!bars?.length) { failed.push(item.code); continue; }
      for (const action of todayActions(bars, today, run)) alerts.push({ code: item.code, name: item.name, ...action });
    }
    return { group, bull, alerts, failed };
  });
}

const ACTION_TEXT: Record<AlertPhase, Record<AlertAction, string>> = {
  pre: { 'sell-today-close': '🔴 尾盘卖出', 'buy-next-open': '🟢 明日开盘买入', 'sell-next-open': '🔴 明日开盘卖出' },
  close: { 'sell-today-close': '🔴 今日收盘卖出（已触发）', 'buy-next-open': '🟢 明日开盘买入', 'sell-next-open': '🔴 明日开盘卖出' },
};
const ACTION_ORDER: AlertAction[] = ['sell-today-close', 'sell-next-open', 'buy-next-open'];

/** 没有任何买卖信号时返回 undefined（不发消息）。 */
export function formatMessage(results: GroupResult[], today: string, phase: AlertPhase): string | undefined {
  if (!results.some(result => result.alerts.length)) return undefined;
  const head = phase === 'pre'
    ? [`【择时买卖提醒】${today} 14:45 盘中预估`, '按实时价当作收盘估算，收盘前可能变化；15:15 收盘后再确认一次。']
    : [`【择时买卖提醒】${today} 收盘确认`];
  const body = results.map(({ group, bull, alerts, failed }) => {
    const state = bull === undefined ? '' : bull ? '：偏进攻' : '：偏防守（不开新仓）';
    const lines = [`${group.title}（${group.timing}${state}）`];
    const sorted = [...alerts].sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action));
    lines.push(...(sorted.length ? sorted.map(alert => `${ACTION_TEXT[phase][alert.action]} ${alert.code} ${alert.name}（${alert.reason}，${phase === 'pre' ? '现价' : '收盘'} ${alert.price.toFixed(3)}）`) : ['无买卖信号']));
    if (failed.length) lines.push(`⚠️ 取数失败：${failed.join('、')}`);
    return lines.join('\n');
  });
  return [...head, '', body.join('\n\n'), '', '规则同复盘页「创业板择时买卖点 / 沪深300择时买卖点」，仅供参考。'].join('\n');
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
  return { tradingDay: true as const, results, text: formatMessage(results, today, phase) };
}
