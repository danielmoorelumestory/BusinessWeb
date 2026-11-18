// 详情页「回测分组」标签：按 ETF 入选的回测优选分组，提示对应的择时与买卖方案。
// 只是历史回测分组的提示，不构成投资建议。
import cybTiming from '../../../src/data/etfMacdGood.json';
import hs300Timing from '../../../src/data/etfHs300Timing.json';
import watchPool from '../../../src/data/etfWatchPool.json';

export type PlanTag = {
  group: 'macd-good' | 'hs300-timing' | 'watch-pool';
  name: string;
  /** 择时口径 */
  timing: string;
  /** 买卖方案 */
  plan: string;
  /** 该 ETF 的回测数字 */
  stats: string;
  /** 页面上能直接勾选显示的开关 */
  views?: ('r2' | 'kd10Trades' | 'h1' | 'h1Trades')[];
};

type BacktestItem = {
  code: string; annual: number; drawdown: number; calmar: number; yearAvg: number; worstYear: number;
  positiveYears: number; countedYears: number; years: number; supplement?: boolean;
};

export const CYB_PLAN = 'Y1 · 牛市金叉或站上10日线且 K−D≥5.3 次日开盘买，熊市不开新仓；死叉，或熊市跌破10日线当日收盘卖';
export const HS_PLAN = '只认金叉 · 牛市 MACD 金叉次日开盘买，熊市不开新仓；死叉当日收盘卖';

const pct = (value: number) => `${value.toFixed(2)}%`;
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

function statsOf(item: BacktestItem): string {
  return `全历史年化 ${pct(item.annual)}，最大回撤 ${pct(item.drawdown)}，卡玛 ${item.calmar.toFixed(2)}（${item.years} 年）；`
    + `逐年平均 ${signed(item.yearAvg)}，${item.countedYears} 年中 ${item.positiveYears} 年赚钱，最差一年 ${signed(item.worstYear)}`
    + (item.supplement ? '；差一项条件补入（正收益年份不足 75%）' : '');
}

export function planTagsOf(code: string): PlanTag[] {
  const tags: PlanTag[] = [];
  const cyb = (cybTiming.items as BacktestItem[]).find(item => item.code === code);
  if (cyb) tags.push({
    group: 'macd-good', name: '创业板择时优选', timing: '创业板 ÷ 红利，高于 20 日均线为牛',
    plan: CYB_PLAN,
    stats: statsOf(cyb),
    views: ['r2', 'kd10Trades'],
  });
  const hs = (hs300Timing.items as BacktestItem[]).find(item => item.code === code);
  if (hs) tags.push({
    group: 'hs300-timing', name: '沪深300择时优选', timing: '沪深300 ÷ 红利，高于 20 日均线为牛',
    plan: HS_PLAN,
    stats: statsOf(hs),
    views: ['h1', 'h1Trades'],
  });
  const watch = (watchPool.items as { code: string; plan: string; industry: string; start: string; years: number; annual: number; drawdown: number; calmar: number; yearly: Record<string, number> }[])
    .find(item => item.code === code);
  if (watch) tags.push({
    group: 'watch-pool', name: watch.plan === 'cyb' ? '创业板择时待选' : '沪深300择时待选',
    timing: watch.plan === 'cyb' ? '创业板 ÷ 红利，高于 20 日均线为牛' : '沪深300 ÷ 红利，高于 20 日均线为牛',
    plan: watch.plan === 'cyb' ? CYB_PLAN : HS_PLAN,
    stats: `观察中（${watch.industry}），只看信号；全历史年化 ${pct(watch.annual)}，最大回撤 ${pct(watch.drawdown)}，卡玛 ${watch.calmar.toFixed(2)}（${watch.years} 年）；`
      + `逐年 ${Object.entries(watch.yearly).map(([year, value]) => `${year.slice(2)}:${signed(value)}`).join(' ')}` + (watch.years < 3 ? '；上市不足 3 年，参考意义有限' : ''),
    views: watch.plan === 'cyb' ? ['r2', 'kd10Trades'] : ['h1', 'h1Trades'],
  });
  return tags;
}
