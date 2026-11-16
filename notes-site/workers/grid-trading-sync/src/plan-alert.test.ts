import { describe, expect, it } from 'vitest';
import { cybPlan, hsPlan, type PlanBar } from '../../../src/lib/plan-trades';
import { styleRatio } from '../../../src/lib/chart-indicators';
import { alertPhaseOf, buildPlanAlert, formatMessage, marketSymbol, mergeLive, PLAN_GROUPS, todayActions, type GroupResult } from './plan-alert';

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
  it('没有信号时不发', () => {
    expect(formatMessage([{ group, alerts: [], failed: [] }], '2026-11-16', 'close')).toBeUndefined();
  });
  it('列出卖出在前、买入在后，并标注择时状态与失败', () => {
    const results: GroupResult[] = [
      { group, bull: true, failed: ['159869'], alerts: [
        { code: '159819', name: '人工智能ETF易方达', action: 'buy-next-open', reason: '金叉', price: 1.2346 },
        { code: '512760', name: '芯片ETF国泰', action: 'sell-today-close', reason: '死叉', price: 2 },
      ] },
      { group: PLAN_GROUPS[1], bull: false, alerts: [], failed: [] },
    ];
    const text = formatMessage(results, '2026-11-16', 'pre')!;
    expect(text).toContain('14:45 盘中预估');
    expect(text).toContain('创业板择时优选（创业板÷红利：偏进攻）');
    expect(text).toContain('沪深300择时优选（沪深300÷红利：偏防守（不开新仓））');
    expect(text.indexOf('512760')).toBeLessThan(text.indexOf('159819'));
    expect(text).toContain('🔴 尾盘卖出 512760 芯片ETF国泰（死叉，现价 2.000）');
    expect(text).toContain('🟢 明日开盘买入 159819 人工智能ETF易方达（金叉，现价 1.235）');
    expect(text).toContain('⚠️ 取数失败：159869');
    expect(text).toContain('无买卖信号');
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
