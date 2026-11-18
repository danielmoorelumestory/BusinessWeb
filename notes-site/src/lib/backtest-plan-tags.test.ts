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
  it('A/B 两组之间每只 ETF 只归一组', () => {
    for (const code of ['513310', '512480', '588000', '159819']) expect(planTagsOf(code)).toHaveLength(1);
  });
  it('择时组合已删除，原组合成员不再有该标签', () => {
    expect(planTagsOf('513630')).toEqual([]);
    expect(planTagsOf('562500').map(tag => tag.group)).toEqual(['macd-good']);
  });
  it('行业观察池给出创业板择时方案，上市不足 3 年的注明', () => {
    expect(planTagsOf('512400').map(tag => tag.group)).toEqual(['watch-pool']);
    expect(planTagsOf('512400')[0].views).toEqual(['r2', 'kd10Trades']);
    expect(planTagsOf('512400')[0].stats).not.toContain('不足 3 年');
    expect(planTagsOf('588170')[0].stats).toContain('不足 3 年');
    expect(planTagsOf('512880')[0].views).toEqual(['h1', 'h1Trades']);
    expect(planTagsOf('512880')[0].timing).toContain('沪深300');
    expect(planTagsOf('512400')[0].name).toBe('创业板择时待选');
    expect(planTagsOf('512880')[0].name).toBe('沪深300择时待选');
  });
  it('未入选任何分组返回空', () => { expect(planTagsOf('000000')).toEqual([]); });
});
