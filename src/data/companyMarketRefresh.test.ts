import { describe, expect, it } from 'vitest'
import { applyCompanyMarketRefresh } from './companyMarketRefresh'
import type { Company } from './companies'

const company = (): Company => ({
  market:'us',code:'TEST',name:'测试公司',sector:'测试',batch:'测试',rating:'观察',
  headline:'基于旧价格的研究判断',asOf:'研究 2026-09-30',
  metrics:[['价格锚点','$100（2026-09-30 收盘）'],['TTM PE','20×'],['最新单季','2026Q2']],
  thesis:[],risk:[],next:[],ratioNote:'旧赔率 2:1',
  scenarios:[{name:'悲观',price:'$80',change:'−20%',assumption:'旧假设',trigger:'待验证'},
    {name:'基准',price:'$140',change:'+40%',assumption:'旧假设',trigger:'待验证'}],
})
const quote = {price:120,currency:'USD',marketTime:'2026-10-12T16:00:02-04:00',date:'2026-10-12',
  checkedAt:'2026-10-13T09:00:00Z',source:'research/data-refresh-2026-10-13/tencent-quotes.json',
  provider:'腾讯延迟行情',session:'收盘后最后报价（非交易所认证）',
  financialPeriod:'2026-06-30',trailingPE:24,forwardPE:null,low52:70,high52:150}

describe('本轮行情与旧研究模型分别标时',()=>{
  it('刷新当前价与来源时间，保留旧价格及研究日期',()=>{
    const old=company(),updated=applyCompanyMarketRefresh(old,quote)
    expect(updated.metrics.find(([k])=>k==='价格锚点')?.[1]).toContain('120')
    expect(updated.metrics.find(([k])=>k==='价格锚点')?.[1]).toContain('2026-10-12')
    expect(updated.metrics.some(([k,v])=>k.startsWith('上轮')&&v.includes('$100'))).toBe(true)
    expect(updated.asOf).toContain('2026-09-30')
    expect(updated.asOf).toContain('2026-10-13')
    expect(old.metrics[0][1]).toContain('$100')
  })
  it('只重算旧情景相对新价的收益，明确模型未重估',()=>{
    const updated=applyCompanyMarketRefresh(company(),quote)
    expect(updated.scenarios?.[1].change).toContain('+16.7%')
    expect(updated.ratioNote).toContain('0.50:1')
    expect(updated.ratioNote).toContain('未重估')
    expect(updated.headline).toContain('原研究')
  })
  it('价格越过基准或悲观端时不产生负数/无穷赔率',()=>{
    for(const price of [70,80,140,150]){
      const updated=applyCompanyMarketRefresh(company(),{...quote,price})
      expect(updated.ratioNote).toContain('不适用')
      expect(updated.ratioNote).not.toMatch(/Infinity|NaN/)
    }
  })
  it('拒绝无效价格、未来/无效日期及早于旧锚点的报价',()=>{
    for(const q of [{...quote,price:0},{...quote,price:NaN},{...quote,date:'2026-09-01',marketTime:'2026-09-01T16:00:00-04:00'},
      {...quote,date:'2026-10-99'},{...quote,date:'2026-10-20',marketTime:'2026-10-20T16:00:00-04:00'}]){
      const c=company();expect(applyCompanyMarketRefresh(c,q)).toBe(c)
    }
  })
  it('重复应用不重复添加历史指标或更新时间',()=>{
    const once=applyCompanyMarketRefresh(company(),quote)
    expect(applyCompanyMarketRefresh(once,quote)).toEqual(once)
  })
  it('程序化旧情景不因新行情得到认证赔率',()=>{
    const updated=applyCompanyMarketRefresh({...company(),auto:true},quote)
    expect(updated.ratioNote).toContain('程序化')
    expect(updated.ratioNote).not.toContain('0.50:1')
  })
  it('旧复核层再次覆盖价格时，本轮报价仍在最后生效',()=>{
    const once=applyCompanyMarketRefresh(company(),quote)
    const staleOverride={...once,metrics:company().metrics,asOf:'旧复核 2026-09-30'}
    expect(applyCompanyMarketRefresh(staleOverride,quote).metrics[0][1]).toContain('120')
  })
  it('上市状态待核的供应商报价只作历史参考，不重新认证赔率',()=>{
    const updated=applyCompanyMarketRefresh(company(),{...quote,tradabilityNote:'换股/终止上市流程，当前可交易性未认证'})
    expect(updated.metrics[0][1]).toContain('历史参考')
    expect(updated.marketRefresh?.tradability).toBe('unverified')
    expect(updated.ratioNote).toContain('可交易性未认证')
    expect(updated.ratioNote).not.toContain('0.50:1')
    expect(updated.scenarios?.[1].change).toContain('待重估')
  })
  it('已撤回的盈利模型不因新价格被重新算为有效赔率',()=>{
    const updated=applyCompanyMarketRefresh({...company(),ratioNote:'指引下调后，旧赔率不作为当前判断'},quote)
    expect(updated.ratioNote).toContain('已撤回')
    expect(updated.ratioNote).not.toContain('0.50:1')
  })
})
