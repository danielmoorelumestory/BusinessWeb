import type { Company } from './companies'

export interface MarketRefreshQuote {
  price: number
  currency: string
  date: string
  marketTime: string
  checkedAt: string
  provider: string
  source: string
  session: string
  tradabilityNote?: string
  financialPeriod?: string | null
  trailingPE?: number | null
  forwardPE?: number | null
  low52?: number | null
  high52?: number | null
  financialSource?: string | null
  financialCheckedAt?: string | null
  valuationMarketTime?: string | null
}

export function applyCompanyMarketRefresh(company: Company, quote?: MarketRefreshQuote): Company {
  if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) return company
  const dateMs = Date.parse(`${quote.date}T00:00:00Z`)
  const checkedMs = Date.parse(quote.checkedAt)
  if (!Number.isFinite(dateMs) || !Number.isFinite(checkedMs) || new Date(dateMs).toISOString().slice(0, 10) !== quote.date || dateMs > checkedMs + 86_400_000) return company
  const oldPrice = company.metrics.find(([label]) => /价格锚点|收盘价|现价|9\/18 收盘/.test(label) && !label.startsWith('上轮'))
  const oldDate = oldPrice?.[1].match(/\d{4}-\d{2}-\d{2}/)?.[0]
  if (oldDate && quote.date < oldDate) return company
  if (company.marketRefresh?.adapterVersion === 3 && company.marketRefresh.checkedAt === quote.checkedAt && company.marketRefresh.evidenceCheckedAt === (quote.financialCheckedAt ?? quote.checkedAt) && company.marketRefresh.price === quote.price && oldDate === quote.date && company.asOf.startsWith('行情 ') && company.marketRefresh.programmatic === Boolean(company.auto)) return company

  const amount = quote.price.toLocaleString('en-US', { maximumFractionDigits: 4 })
  const money = quote.currency === 'CNY' ? `${amount} 元` : quote.currency === 'HKD' ? `HK$${amount}` : `${quote.currency === 'USD' ? 'US$' : quote.currency + ' '}${amount}`
  const restriction = quote.tradabilityNote || company.metrics.filter(([label]) => /价格锚点|收盘价|现价/.test(label)).map(([, text]) => text.match(/可交易性未认证|暂停交易|上市状态待核|终止上市/)?.[0]).find(Boolean)
  const metrics: [string, string][] = [
    ['价格锚点', `${money}（${quote.marketTime}；${quote.provider}；${quote.session}${restriction ? `；历史参考；${restriction}；可交易性未认证，供应商时间不证明实际成交或可交易` : ''}）`],
    ['行情核验时间', `${quote.checkedAt}；原始证据 ${quote.source}`],
    ['研究与模型状态', '本轮刷新行情及供应商摘要；原研究的财报、评级与估值假设未自动重新认证。'],
  ]
  if (quote.financialPeriod) metrics.push(['供应商最新财务期末', `${quote.financialPeriod}；核验 ${quote.financialCheckedAt ?? quote.checkedAt}；非一手报表认证`])
  if (quote.valuationMarketTime) metrics.push(['本轮供应商估值时间', `${quote.valuationMarketTime}；与腾讯报价可能有时点差异，未混算为公司原件指标`])
  if (quote.trailingPE != null && quote.trailingPE > 0) metrics.push(['本轮供应商 TTM PE', `${quote.trailingPE.toFixed(2)}×；供应商滚动口径，需核实原文`])
  if (quote.forwardPE != null && quote.forwardPE > 0) metrics.push(['本轮供应商 Forward PE', `${quote.forwardPE.toFixed(2)}×；一致预期口径待核，不等于研究者正常化盈利`])
  if (quote.low52 != null && quote.high52 != null) metrics.push(['本轮供应商52周区间', `${quote.currency} ${quote.low52}–${quote.high52}；供应商统计，非逐日独立复算`])
  if (quote.financialSource) metrics.push(['供应商摘要来源', quote.financialSource])
  for (const [label, value] of company.metrics) {
    if (label === '价格锚点' && company.marketRefresh?.price === quote.price && oldDate === quote.date) continue
    if (/^行情核验时间$|^研究与模型状态$|^本轮供应商|^供应商最新财务期末$|^供应商摘要来源$/.test(label)) continue
    const sensitive = /价格锚点|收盘价|现价|9\/18 收盘|52\s*周|PE|PEG|PB|PS|赔率|市值|股息率|最新单季/.test(label)
    metrics.push([sensitive && !label.startsWith('上轮') ? `上轮${label}（原研究口径）` : label, value])
  }
  const scenarioPrice = (text: string) => {
    const match = text.trim().match(/^(?:US\$|HK\$|CNY|USD|HKD|\$)?\s*([\d,]+(?:\.\d+)?)\s*(?:元|美元|港元)?$/)
    return match ? Number(match[1].replace(/,/g, '')) : null
  }
  const bear = company.scenarios?.find(s => /悲观|熊市/.test(s.name))
  const base = company.scenarios?.find(s => /基准|中性/.test(s.name))
  const bearPrice = bear ? scenarioPrice(bear.price) : null
  const basePrice = base ? scenarioPrice(base.price) : null
  let ratioNote = '旧情景未重估；Bear/Base/Bull 关键估值输入未完成认证，本轮不认证赔率。'
  const withdrawn = Boolean(restriction) || /不作为当前判断|已撤回|撤回旧|暂停沿用/.test(company.ratioNote ?? '')
  if (restriction) ratioNote = '可交易性未认证；报价仅作历史参考，估值与赔率未完成认证，待核上市状态。'
  else if (company.auto) ratioNote = '旧程序化情景未重估，不能因行情更新自动认证赔率或买入资格。'
  else if (withdrawn) ratioNote = '旧盈利模型已撤回／暂停使用，未重估；本轮不认证赔率，刷新行情不恢复原模型。'
  else if (bearPrice != null && basePrice != null) {
    ratioNote = bearPrice < quote.price && quote.price < basePrice
      ? `旧情景未重估；仅按本轮报价机械复算：基准 ${(100 * (basePrice / quote.price - 1)).toFixed(1)}% / 悲观下行 ${(100 * (1 - bearPrice / quote.price)).toFixed(1)}%，${((basePrice - quote.price) / (quote.price - bearPrice)).toFixed(2)}:1。关键估值输入未完成认证，原情景不等于已认证估值，悲观价不是止损保证。`
      : '旧情景未重估；新价不满足 Bear < P < Base，赔率不适用，关键估值输入未完成认证；须重新核对盈利、股本与下行情景。'
    const currency = quote.currency === 'USD' ? 'US$' : quote.currency === 'HKD' ? 'HK$' : `${quote.currency} `
    ratioNote += ` 旧情景2:1研究门槛约 ${currency}${((basePrice + 2 * bearPrice) / 3).toFixed(2)}，未认证为买点。`
  }
  const scenarios = company.scenarios?.map(s => {
    const target = scenarioPrice(s.price)
    return { ...s,
      assumption: s.assumption.startsWith('原研究假设（未重估）') ? s.assumption : `原研究假设（未重估）：${s.assumption}`,
      change: company.auto || withdrawn ? '原模型未认证／已暂停，待重估' : target != null && target > 0
        ? `${target >= quote.price ? '+' : ''}${(100 * (target / quote.price - 1)).toFixed(1)}%（旧情景／新报价）` : '不适用／待核',
    }
  })
  const originalAsOf = company.asOf.startsWith('行情 ') ? company.marketRefresh?.originalAsOf ?? company.asOf : company.asOf
  const oldHeadline = company.headline.replace(/^原研究（行情已更新，模型待复核）：/, '')
  return { ...company, metrics, scenarios, ratioNote,
    headline: `原研究（行情已更新，模型待复核）：${oldHeadline}`,
    asOf: `行情 ${quote.marketTime}；核验 ${quote.checkedAt}。原研究：${originalAsOf}`,
    marketRefresh: { adapterVersion: 3, checkedAt: quote.checkedAt, evidenceCheckedAt: quote.financialCheckedAt ?? quote.checkedAt, priceDate: quote.date, price: quote.price, source: quote.source, originalAsOf, programmatic: Boolean(company.auto), tradability: restriction ? 'unverified' : 'no-known-restriction', quoteDateKind: restriction ? 'provider-label' : 'provider-market-time' },
  }
}
