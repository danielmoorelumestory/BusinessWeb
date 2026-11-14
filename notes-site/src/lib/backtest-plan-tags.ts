// 详情页「回测分组」标签：按 ETF 入选的回测优选分组，提示对应的择时与买卖方案。
// 只是历史回测分组的提示，不构成投资建议。
import macdGood from '../../../src/data/etfMacdGood.json';
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
  /** 页面上能直接勾选显示的开关；沪深300择时 页面暂未提供 */
  views?: ('r2' | 'kd10Trades' | 'macdTrades')[];
};

const pct = (value: number) => `${value.toFixed(2)}%`;

export function planTagsOf(code: string): PlanTag[] {
  const tags: PlanTag[] = [];
  const macd = macdGood.items.find(item => item.code === code);
  if (macd) tags.push({
    group: 'macd-good', name: 'MACD优秀', timing: '创业板 ÷ 红利（页面「择时」）',
    plan: '择时+KD10 买卖点：牛市金叉或站上10日线且 K−D≥5.3 次日开盘买；死叉，或熊市跌破10日线当日收盘卖',
    stats: `纯 MACD 回测年化 ${pct(macd.macdAnnual)}，一直持有 ${pct(macd.holdAnnual)}；最大回撤 ${pct(macd.macdDrawdown)}（持有 ${pct(macd.holdDrawdown)}）；${macd.years} 年`,
    views: ['r2', 'kd10Trades'],
  });
  const hs = hs300Timing.items.find(item => item.code === code);
  if (hs) tags.push({
    group: 'hs300-timing', name: '沪深300择时优选', timing: '沪深300 ÷ 红利（高于 20 日均线为牛）',
    plan: '只认金叉：牛市 MACD 金叉次日开盘买，熊市不开新仓；死叉当日收盘卖（页面暂未画出这套买卖点，可先看「MACD收盘卖买卖点」里牛市的金叉）',
    stats: `沪深300择时年化 ${pct(hs.hs300Annual)}，创业板择时 ${pct(hs.cybAnnual)}（+${hs.liftAnnual.toFixed(2)} 个百分点）；最大回撤 ${pct(hs.hs300Drawdown)}（创业板择时 ${pct(hs.cybDrawdown)}）；${hs.years} 年`,
    views: ['macdTrades'],
  });
  return tags;
}
