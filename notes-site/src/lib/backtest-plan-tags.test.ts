import { describe, expect, it } from 'vitest';
import { planTagsOf } from './backtest-plan-tags';

describe('planTagsOf', () => {
  it('沪深300择时优选 的 ETF 给出沪深300择时方案，补入的标注差一项', () => {
    const tags = planTagsOf('159755');
    expect(tags.map(tag => tag.group)).toEqual(['hs300-timing']);
    expect(tags[0].timing).toContain('沪深300');
    expect(tags[0].stats).toContain('差一项');
  });
  it('创业板择时优选 的 ETF 给出 Y1 方案', () => {
    const tags = planTagsOf('562500');
    expect(tags.map(tag => tag.group)).toEqual(['macd-good', 'timing-portfolio']);
    expect(tags[0].name).toBe('创业板择时优选');
    expect(tags[0].plan).toContain('Y1');
    expect(tags[0].stats).not.toContain('差一项');
  });
  it('A/B 两组之间每只 ETF 只归一组', () => {
    for (const code of ['513310', '512480', '588000', '159819']) expect(planTagsOf(code).filter(tag => tag.group !== 'timing-portfolio')).toHaveLength(1);
  });
  it('择时组合成员按所属方案给出开关，不在 A/B 组的也有标签', () => {
    expect(planTagsOf('513630').map(tag => tag.group)).toEqual(['timing-portfolio']);
    expect(planTagsOf('513630')[0].views).toEqual(['h1', 'h1Trades']);
    expect(planTagsOf('562500').map(tag => tag.group)).toEqual(['macd-good', 'timing-portfolio']);
    expect(planTagsOf('562500')[1].views).toEqual(['r2', 'kd10Trades']);
  });
  it('未入选任何分组返回空', () => { expect(planTagsOf('000000')).toEqual([]); });
});
