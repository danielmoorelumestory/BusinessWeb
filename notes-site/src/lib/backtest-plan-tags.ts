// 详情页「回测分组」标签：按 ETF 入选的回测优选分组，提示对应的择时与买卖方案。
// 只是历史回测分组的提示，不构成投资建议。
import cybTiming from '../../../src/data/etfMacdGood.json';
import hs300Timing from '../../../src/data/etfHs300Timing.json';

export type PlanTag = {
  group: 'macd-good' | 'hs300-timing';
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
    group: 'macd-good', name: '创业板择时优选', timing: '创业板 ÷ 红利（页面「创业板择时」）',
    plan: 'Y1（页面「创业板择时+KD10买卖点」）：牛市金叉或站上10日线且 K−D≥5.3 次日开盘买，熊市不开新仓；死叉，或熊市跌破10日线当日收盘卖',
    stats: statsOf(cyb),
    views: ['r2', 'kd10Trades'],
  });
  const hs = (hs300Timing.items as BacktestItem[]).find(item => item.code === code);
  if (hs) tags.push({
    group: 'hs300-timing', name: '沪深300择时优选', timing: '沪深300 ÷ 红利，高于 20 日均线为牛（页面「沪深300择时」）',
    plan: '只认金叉（页面「沪深300择时金叉买卖点」）：牛市 MACD 金叉次日开盘买，熊市不开新仓；死叉当日收盘卖',
    stats: statsOf(hs),
    views: ['h1', 'h1Trades'],
  });
  return tags;
}
