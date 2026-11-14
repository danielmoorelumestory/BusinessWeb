import { describe, expect, it } from 'vitest';
import { planTagsOf } from './backtest-plan-tags';

describe('planTagsOf', () => {
  it('沪深300择时优选 的 ETF 给出沪深300择时方案', () => {
    const tags = planTagsOf('159755');
    expect(tags.map(tag => tag.group)).toEqual(['hs300-timing']);
    expect(tags[0].timing).toContain('沪深300');
    expect(tags[0].stats).toContain('13.25%');
  });
  it('两个分组都入选时都显示，MACD优秀在前', () => {
    expect(planTagsOf('562500').map(tag => tag.group)).toEqual(['macd-good', 'hs300-timing']);
  });
  it('未入选任何分组返回空', () => { expect(planTagsOf('000000')).toEqual([]); });
});
