import { describe, expect, it } from 'vitest';
import { cybPlan, hsPlan, type PlanBar } from '../../../src/lib/plan-trades';
import { styleRatio } from '../../../src/lib/chart-indicators';
import { alertPhaseOf, buildPlanAlert, currentHolding, formatMessage, marketSymbol, mergeLive, PLAN_GROUPS, todayActions, type GroupResult } from './plan-alert';

const day = (i: number) => { const d = new Date(Date.UTC(2024, 0, 1)); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); };
/** 带周期波动的价格序列，足以产生多次金叉死叉 */
const series = (n: number, phase = 0): PlanBar[] => Array.from({ length: n }, (_, i) => {
  const close = 1 + 0.2 * Math.sin((i + phase) / 9) + 0.08 * Math.sin((i + phase) / 2.3) + i * 0.001;
  return { date: day(i), open: close * 0.995, high: close * 1.01, low: close * 0.99, close };
});
const allBull = (bars: PlanBar[]) => bars.map(bar => ({ date: bar.date, bull: true }));

describe('alertPhaseOf', () => {
  it('只在 UTC 06:45 / 07:15 触发', () => {
    expect(alertPhaseOf(Date.UTC(2026, 10, 16, 6, 45))).toBe('pre');
    expect(alertPhaseOf(Date.UTC(2026, 10, 16, 7, 15))).toBe('close');
    expect(alertPhaseOf(Date.UTC(2026, 10, 16, 7, 0))).toBeUndefined();
    expect(alertPhaseOf(Date.UTC(2026, 10, 16, 7, 45))).toBeUndefined();
  });
});

describe('marketSymbol', () => {
  it('ETF 按首位判断沪深，指数保留前缀', () => {
    expect(marketSymbol('510880')).toBe('sh510880');
    expect(marketSymbol('159915')).toBe('sz159915');
    expect(marketSymbol('588200')).toBe('sh588200');
    expect(marketSymbol('sh000300')).toBe('sh000300');
  });
});

describe('mergeLive', () => {
  const bars = series(3);
  it('同日更新收盘与高低', () => {
    const merged = mergeLive(bars, { date: bars[2].date, price: 9, open: 1, high: 9.5, low: 0.5 }, bars[2].date);
    expect(merged.at(-1)).toMatchObject({ date: bars[2].date, close: 9, high: 9.5, low: 0.5, open: bars[2].open });
  });
  it('今天还没有日线时追加', () => {
    const merged = mergeLive(bars, { date: day(3), price: 2, open: 1.9, high: 2.1, low: 1.8 }, day(3));
    expect(merged).toHaveLength(4);
    expect(merged.at(-1)).toEqual({ date: day(3), open: 1.9, high: 2.1, low: 1.8, close: 2 });
  });
  it('报价不是今天时不合并', () => {
    expect(mergeLive(bars, { date: day(2), price: 2, open: 1.9, high: 2.1, low: 1.8 }, day(3))).toBe(bars);
  });
});

describe('todayActions 与详情页规则引擎一致', () => {
  for (const [name, plan] of [['沪深300择时', hsPlan], ['创业板择时', cybPlan]] as const) {
    it(`${name}：每天的提醒等于引擎在当天的挂单与收盘卖出`, () => {
      const bars = series(400);
      let buys = 0, sells = 0;
      for (let t = 150; t < bars.length; t++) {
        const window = bars.slice(0, t + 1), today = bars[t].date, points = allBull(window);
        const run = (b: PlanBar[]) => plan(b, points);
        const actions = todayActions(window, today, run);
        const result = run(window);
        const expectBuy = result.pendingBuy?.signalDate === today;
        const expectSellClose = result.signals.some(s => s.side === 'sell' && s.date === today && s.signalDate === today);
        expect(actions.some(a => a.action === 'buy-next-open')).toBe(expectBuy);
        expect(actions.some(a => a.action === 'sell-today-close')).toBe(expectSellClose);
        // 次日开盘卖出（T+1 顺延）由下一天的引擎结果核对
        const next = run(bars.slice(0, t + 2));
        const expectSellNext = t + 1 < bars.length && next.signals.some(s => s.side === 'sell' && s.date === bars[t + 1].date && s.signalDate === today);
        expect(actions.some(a => a.action === 'sell-next-open')).toBe(expectSellNext);
        buys += +expectBuy; sells += +expectSellClose;
      }
      expect(buys).toBeGreaterThan(3);
      expect(sells).toBeGreaterThan(3);
    });
  }
  it('最后一根不是今天时不给信号', () => {
    const bars = series(300);
    expect(todayActions(bars, day(400), b => hsPlan(b, allBull(b)))).toEqual([]);
  });
});

describe('formatMessage', () => {
  const group = PLAN_GROUPS[0];
  const holding = { code: '159819', name: '人工智能ETF易方达', buyDate: '2026-11-05', buyPrice: 1.2, ret: 0.05321 };
  it('既无信号也无持仓时不发', () => {
    expect(formatMessage([{ group, alerts: [], failed: [] }], '2026-11-16', 'close')).toBeUndefined();
  });
  it('只有持仓：收盘确认照发，盘中预估不发', () => {
    const results: GroupResult[] = [{ group, alerts: [], failed: [], holdings: [holding] }, { group: PLAN_GROUPS[1], alerts: [], failed: [], holdings: [] }];
    expect(formatMessage(results, '2026-11-16', 'pre')).toBeUndefined();
    expect(formatMessage(results, '2026-11-16', 'close')).toBe('🟢 买入\n无\n\n🔴 卖出\n无\n\n📌 持有\n159819 人工智能ETF易方达 +5.32%（11-05买入 1.200）');
  });
  it('不分择时分组，两组的信号与持仓合并到 买入 / 卖出 / 持有 三段', () => {
    const results: GroupResult[] = [
      { group, failed: ['159869'], holdings: [{ ...holding, ret: -0.0312 }], alerts: [
        { code: '159819', name: '人工智能ETF易方达', action: 'buy-next-open', reason: '金叉', price: 1.2346 },
        { code: '512760', name: '芯片ETF国泰', action: 'sell-next-open', reason: '死叉', price: 2 },
      ] },
      { group: PLAN_GROUPS[1], failed: [], holdings: [], alerts: [{ code: '512670', name: '国防ETF鹏华', action: 'sell-today-close', reason: '死叉', price: 0.67 }] },
    ];
    expect(formatMessage(results, '2026-11-16', 'pre')).toBe([
      '🟢 买入', '明日开盘 159819 人工智能ETF易方达（金叉，现价 1.235）', '',
      '🔴 卖出', '今日尾盘 512670 国防ETF鹏华（死叉，现价 0.670）', '明日开盘 512760 芯片ETF国泰（死叉，现价 2.000）', '',
      '📌 持有', '159819 人工智能ETF易方达 -3.12%（11-05买入 1.200）', '',
      '⚠️ 取数失败：159869',
    ].join('\n'));
    expect(formatMessage(results, '2026-11-16', 'close')).toContain('今日收盘（已触发） 512670 国防ETF鹏华（死叉，收盘 0.670）');
  });
});

describe('currentHolding 与规则引擎一致', () => {
  it('持有时给出最后一笔买入与按最新收盘的涨跌，空仓时为空', () => {
    const bars = series(400);
    let held = 0;
    for (let t = 150; t < bars.length; t++) {
      const window = bars.slice(0, t + 1), run = (b: PlanBar[]) => hsPlan(b, allBull(b)), result = run(window);
      const holding = currentHolding(window, run);
      expect(!!holding).toBe(result.holding);
      if (holding) {
        held++;
        const buy = result.signals.at(-1)!;
        expect(holding).toEqual({ buyDate: buy.date, buyPrice: buy.price, ret: window.at(-1)!.close / buy.price - 1 });
      }
    }
    expect(held).toBeGreaterThan(20);
  });
});

describe('buildPlanAlert', () => {
  it('红利 ETF 报价不是今天时视为非交易日', async () => {
    const result = await buildPlanAlert({ today: '2026-11-15', loadBars: async () => series(300), loadQuotes: async () => new Map([['sh510880', { date: '2026-11-13', price: 1, open: 1, high: 1, low: 1 }]]) }, 'close');
    expect(result.tradingDay).toBe(false);
  });
  it('交易日按每只日线算两组信号，择时比值来自对应的两只', async () => {
    const bars = series(400), today = bars.at(-1)!.date;
    const loaded: string[] = [];
    const result = await buildPlanAlert({ today, loadBars: async symbol => { loaded.push(symbol); return bars; }, loadQuotes: async () => new Map() }, 'close');
    expect(result.tradingDay).toBe(true);
    expect(loaded).toEqual(expect.arrayContaining(['sz159915', 'sh510880', 'sh000300', 'sh512760', 'sz159755']));
    // 比值恒为 1 → 均线相等、bull=false（熊市）：两组都不开新仓
    expect(styleRatio(bars, bars).at(-1)!.bull).toBe(false);
    if (!result.tradingDay) return;
    expect(result.results.flatMap(r => r.alerts).filter(a => a.action === 'buy-next-open')).toEqual([]);
  });
});

describe('择时比值用后复权', () => {
  it('创业板、红利 ETF 按后复权取数，指数与买卖标的仍用前复权；比值 ETF 不与买卖标的重叠', async () => {
    const { RATIO_HFQ_SYMBOLS } = await import('./plan-alert');
    expect([...RATIO_HFQ_SYMBOLS].sort()).toEqual(['sh510880', 'sz159915']);
    for (const group of PLAN_GROUPS) for (const item of group.items) expect(RATIO_HFQ_SYMBOLS.has(marketSymbol(item.code))).toBe(false);
    const asked: string[] = [];
    await buildPlanAlert({ today: '2026-11-13', loadBars: async (symbol, fq) => { asked.push(`${symbol}:${fq ?? 'qfq'}`); return []; }, loadQuotes: async () => new Map() }, 'close');
    expect(asked).toContain('sh510880:hfq');
    expect(asked).toContain('sz159915:hfq');
    expect(asked).toContain('sh000300:qfq');
    expect(asked.filter(entry => entry.endsWith(':hfq'))).toHaveLength(2);
  });
  it('后复权日线按涨跌幅并入实时价', async () => {
    const { mergeLiveByChange } = await import('./plan-alert');
    const bars = [{ date: '2026-11-12', open: 4, high: 4, low: 4, close: 4 }];
    const quote = { date: '2026-11-13', price: 3.1, open: 3, high: 3.2, low: 3, changePercent: 2.5 };
    const merged = mergeLiveByChange(bars, quote, '2026-11-13');
    expect(merged.at(-1)!.close).toBeCloseTo(4.1);
    expect(mergeLiveByChange(merged, { ...quote, changePercent: -1 }, '2026-11-13').at(-1)!.close).toBeCloseTo(3.96);
    expect(mergeLiveByChange(bars, { ...quote, changePercent: undefined }, '2026-11-13')).toBe(bars);
  });
});
