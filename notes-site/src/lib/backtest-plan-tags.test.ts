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
    expect(tags.map(tag => tag.group)).toEqual(['macd-good']);
    expect(tags[0].name).toBe('创业板择时优选');
    expect(tags[0].plan).toContain('Y1');
    expect(tags[0].stats).not.toContain('差一项');
  });
  it('每只 ETF 只归一组', () => {
    for (const code of ['513310', '512480', '588000', '159819']) expect(planTagsOf(code)).toHaveLength(1);
  });
  it('未入选任何分组返回空', () => { expect(planTagsOf('000000')).toEqual([]); });
});
