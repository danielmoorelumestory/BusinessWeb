import originals from './companies.json'
import { MCP, PRIMARY_CHECKS, amount, cashAssessment, primaryListing, type McpCompany } from './mcpResearch'
import { FOCUS, SOURCES, VALUATIONS, evaluate } from './research'
import { COMPANY_LENSES, INDUSTRY_LENSES } from './coverage'
import coreReview from './coreReview.json'

export const solidCompanyPath = (c: Pick<McpCompany, 'id'>) => `/future-trends/solid-state/${encodeURIComponent(c.id)}`
export const solidCompanyById = (id: string) => MCP.companies.find(c => c.id === id)
const pct = (n: number | null | undefined) => n == null ? '[MISSING]' : `${(n * 100).toFixed(1)}%`
const ratio = (a: number | null | undefined, b: number | null | undefined) => a == null || b == null || b === 0 ? null : a / b
export function solidCompanyReport(c: McpCompany) {
  const authored = COMPANY_LENSES.get(c.name)!
  const lens = INDUSTRY_LENSES[authored.lens]
  const focus = FOCUS.find(f => f.name === c.name)
  const selection = coreReview.outcomes.find(r => r.id === c.id)
  const listing = primaryListing(c)
  const f = c.financials
  const original = originals.find(o => o.name === c.name)
  const normal = VALUATIONS.find(v => v.name === c.name)
  const draft = normal && listing?.price === normal.price ? { input: normal, result: evaluate(normal) } : null
  const sources: Array<{ title: string; url: string; status: string }> = [
    { title: '产业格局原始树', url: 'industry/solid-state.json', status: `原目录只支持研究线索；${original?.path ?? c.origin}，不证明固态收入。` },
    ...c.listings.map(l => ({ title: `${l.symbol} · MCP 公司资料及行情`, url: l.source, status: `${l.retrievedAt ?? '抓取时间缺失'}；市场时间 ${l.marketTime ?? '[MISSING]'}；第三方数据需核实原文。` })),
    ...(f?.sources ?? []).map((url, i) => ({ title: f?.sourceKind === 'filing' ? '公司半年报原件摘录与字段出处' : ['MCP 利润表', 'MCP 资产负债表', 'MCP 现金流量表'][i], url, status: f?.sourceKind === 'filing' ? '摘要原件直接披露 H1 累计；非 MCP 数据，未取得资本支出与季度表。' : '供应商单季标准化；H1=Q1+Q2，资产负债表为6月末；部分指标原件核对见下。' })),
    ...(focus?.sources ?? []).filter(id => id !== 'mcp').map(id => { const s = SOURCES.find(s => s.id === id)!; return { title: s.title, url: s.url, status: `${s.date}；${s.status}` } }),
  ]
  if (c.name === '长远锂科') {
    const s = SOURCES.find(s => s.id === 'minmetals')!
    sources.push({ title: s.title, url: s.url, status: s.status })
  }
  const incomeRows = [
    ['2026 上半年 · 财报币种', f?.currency ?? '[MISSING]'],
    ['收入', amount(f?.revenue)], ['归母 / 普通股净利润', amount(f?.netIncome)],
    ['毛利润', amount(f?.grossProfit)], ['毛利率（派生）', pct(ratio(f?.grossProfit, f?.revenue))],
    ['净利率（派生）', pct(ratio(f?.netIncome, f?.revenue))],
    ['经营现金流', amount(f?.cfo)], ['数据源资本支出', amount(f?.capex)], ['简化 FCF', amount(f?.fcf)],
    ['经营现金流 / 净利润', f && f.netIncome != null && f.netIncome > 0 && f.cfo != null ? `${(f.cfo / f.netIncome).toFixed(2)} 倍` : '亏损 / 缺失，不据此计算现金转换率'],
  ]
  const balanceRows = [
    ['2026-06-30 总资产', amount(f?.assets)], ['总负债', amount(f?.liabilities)], ['归属权益', amount(f?.equity)],
    ['数据源债务（可能含租赁）', amount(f?.totalDebt)], ['现金及短期投资', amount(f?.cashAndShortTermInvestments)],
    ['现金及现金等价物', amount(f?.cash)], ['应收账款 / 应收款（按源科目）', amount(f?.receivables)],
    ['存货', amount(f?.inventory)], ['商誉', amount(f?.goodwill)],
    ['负债 / 总资产（派生）', pct(ratio(f?.liabilities, f?.assets))],
  ]
  const marketRows = [
    ['证券价格与币种', listing ? `${listing.currency} ${listing.price}` : '[MISSING]'],
    ['市场当地时间', listing?.marketTime ?? '[MISSING]'], ['数据抓取时间', listing?.retrievedAt ?? '[MISSING]'],
    ['总市值 · 报价币种', amount(listing?.marketCap)], ['TTM PE', listing?.peTtm?.toFixed(2) ?? '亏损 / 缺失，不适用'],
    ['供应商 Forward PE（未核预测口径）', listing?.valuation.forwardPE && listing.valuation.forwardPE > 0 ? listing.valuation.forwardPE.toFixed(2) : '[MISSING] / 不适用'],
    ['PB（账面检查，不代替独立估值）', listing?.valuation.priceToBook?.toFixed(2) ?? '[MISSING]'],
    ['PS TTM', listing?.valuation.priceToSalesTrailing12Months?.toFixed(2) ?? '[MISSING]'],
    ['52 周低 / 高 · 报价币种', listing ? `${listing.valuation.fiftyTwoWeekLow ?? '[MISSING]'} / ${listing.valuation.fiftyTwoWeekHigh ?? '[MISSING]'}` : '[MISSING]'],
    ['供应商 ROE（滚动口径待核）', pct(listing?.valuation.returnOnEquity)],
    ['ROIC / 规范净杠杆', '[MISSING]：税率、投入资本、租赁及受限资金桥未齐，不由总资产或现金简单替代'],
  ]
  const missing = [
    ...(listing ? [] : ['有效行情与独立发行人身份；不能借用合作企业代码或旧价格。']),
    ...(f?.sourceKind === 'mcp' ? [] : [f ? '仅有公司摘要，完整三张报表、资本支出及季度明细仍需补齐。' : '可比 H1 三张报表；港股部分公司仅半年披露，空季度不能拼接。']),
    '固态专用收入、销量、单位毛利与可持续自由现金流；集团金额不能代表固态贡献。',
    '客户名称与实际验收 / 复购、产品测试条件、合格率及质保成本。',
    '分部 / 产品 / 地区利润结构与正常化一次性项目桥；未核实的占比不填估计数。',
    '可校准的未来销量、利润、资本开支与摊薄假设；DCF / 第二种独立估值尚未完成。',
  ]
  const evidence = focus?.evidence ?? `事实边界：${original ? `原树在“${original.path}”提及${c.name}` : `${c.name}属于${c.origin}`}。MCP 可支持公司业务摘要及已返回的合并财务；未取得该公司的固态专用商业收入证明。关联角色是待验证的研究假设。`
  const conclusion = selection?.decision ?? focus?.conclusion ?? (listing ? '观察：先验证实际业务敞口与现金回报' : '等待证据：主体或公开资料尚未齐备')
  const calendar = [
    focus?.verify ?? `下一份公司定期报告及产品公告：${lens.check}`,
    '下一次正式客户合同或认证公告：桥接产品 → 订单 → 交付 → 验收 → 收入 → 回款；框架合作不计正式订单。',
    '2027 年底研究检查点：至少跨两个披露期有可归属业务的稳定复购、毛利与现金；这是研究规则，并非公司投产承诺。',
    '失效条件：关键里程碑推迟一个完整披露期；两期回款恶化；规模扩大时单位毛利持续下降；摊薄抵消每股经营增量。',
  ]
  const sections = [
    ...(selection ? [{ title: '核心候选池竞选复核', items: [selection.decision, selection.reason, '本轮重新通过 Yahoo Finance 与 AKShare MCP 查询。核心表示长期研究优先级；独立双方法估值未齐，不认证新增现价买入。'] }] : []),
    { title: '公司与赚钱机制', items: [focus?.profile ?? `研究判断：${authored.role}`, `收费链条：向${lens.customer}收费。${lens.mechanism}`, '业务分布：现有集团业务与固态新增业务分开；固态收入占比及地区 / 产品利润分布未取得足够原件，不能替代为目录权重。'] },
    { title: '固态业务敞口与证据边界', items: [authored.role, evidence, '阶段判断：产品存在、送样、中试、认证、商业交付、稳定复购是不同证据。无订单与毛利时不升级为规模盈利。', '研究身份：本页为固态专题视角；原有通用公司研究独立保留，不把原有目标价迁移为本页结论。'] },
    { title: '产业位置、竞争与替代', items: [`研究环节：${lens.title}。${lens.check}`, lens.moat, lens.risk, '判断：技术渗透率、可服务市场与本公司可得份额分开；新路线既可能创造增量，也可能替代既有产品。AI 未取得可量化财务传导，本轮不作估值加分。'] },
    { title: '盈利驱动与持续性', items: [focus?.drivers ?? lens.mechanism, ...lens.variables.map(v => `主导变量：${v}；需要客户、财报或实际运营证据，不能以规划替代。`), '盈利可持续性：核销量、价格、份额、结构、成本和营运资金各自贡献；一次性收益、商品价格反弹及低基数增长不自动外推到 2027 年。'] },
    { title: '财务质量与资本约束', items: [PRIMARY_CHECKS[c.name] ?? '第三方财务尚未完成公司公告逐项核对；可用来发现问题，不能据此认证固态盈利。', cashAssessment(c), '利润桥：需要扣非 / 调整后盈利、减值、投资及重估收益、税费与少数股东权益解释；未披露或未核数字保留缺项。', '现金桥：经营现金流减数据源资本支出得到简化 FCF；预收、应付增加可能暂时提升现金，扩产也可能压低现金，不将其机械等同永久竞争力。', '资本结构：债务可能含租赁，现金及短期投资可能含受限资金，未完成桥接前不宣称已核净现金、净杠杆或可分红金额。'] },
    { title: '护城河与回报验证', items: [focus?.bull ?? `多头假设：${lens.moat}`, `反证：${focus?.bear ?? lens.risk}`, '验证方法：比较同环节企业的加工利润、验收率、客户复购和现金回收；规模、专利数量、合作方名气均不能单独证明定价权。', '优势的代价：研发、定制、资本投入和质保可能吃掉售价溢价，必须观察增量投入资本能否带来可持续回报。'] },
    { title: '定价方法与三情景', items: [focus?.valuation ?? lens.valuation, '悲观：认证或量产延迟、价格竞争和资本投入先发生；固态新增利润按零或负值处理，成熟业务采用压力现金流。', '基准：只纳入可归属的实际验收及复购，按正常化加工利润和必要资本开支建模；集团增长不全归固态。', '乐观：跨期稳定交付、良率、系统成本及毛利同时达标后扩大销量假设；计入质保、维护资本支出和新增营运资金。', '估值边界：现价只是观察锚点，PB 和现金转换是质量检查。缺第二种独立估值、悲观回收值或摊薄桥时，不认证目标价、交易门槛或 2:1 盈亏比。'] },
    { title: 'PM 七问与多空复核', items: ['错误定价在哪里：尚未由市场隐含增长模型证实，本页结论为持续观察。', '现价反映什么：需把市值桥接到成熟业务正常化利润、固态项目成功率与未来摊薄；不能用题材热度反推。', `现在为何研究：${authored.role}；原件和 MCP 证据使相关变量可继续跟踪。`, `什么能证明：${lens.check}`, `什么能推翻：${lens.risk}`, '如何改变判断：实际验收、复购、毛利及回款同向改善后提高经营证据等级；不能只因股价上涨提高确定性。', '仍缺什么：见缺项清单。以下为单模型多视角复核，没有独立专家投票或子代理参与。', `产业多头：${focus?.bull ?? lens.moat}`, `财报空头：${focus?.bear ?? lens.risk}`, `估值裁决：${conclusion}；证据不足继续观察，不从主观概率推导实际胜率。`] },
    { title: '风险、证伪与验证日历', items: calendar },
    { title: '数据口径与未决问题', items: ['报价币种与财报币种分开；多上市地同一发行人不重复加总合并财务。', '本页财务流量为 2026-01-01 至 2026-06-30 自然期间 Q1+Q2，海外公司自身财年可能不同；季度缺失时不强拼 H1 / TTM。', '供应商滚动摘要、单季财务、半年累计和公司指引分开；远期 PE 未核预测来源，不当作市场共识。', ...missing] },
  ]
  return { id: c.id, name: c.displayName, asOf: MCP.asOf, period: '研究至 2027 年底，持续性与失效条件动态复核',
    origin: c.origin, role: authored.role, industry: lens.title, conclusion,
    depth: focus ? '重点专题研究；估值仍待验证' : '基础覆盖；固态贡献待补证',
    evidence, sections, incomeRows, balanceRows, marketRows, calendar, missing, sources,
    financials: f, listings: c.listings, businessSummary: listing?.businessSummary ?? null,
    draft, peers: MCP.companies.filter(p => p.id !== c.id && COMPANY_LENSES.get(p.name)?.lens === authored.lens).slice(0, 6).map(p => ({ id: p.id, name: p.displayName, financials: p.financials })),
    disclaimer: '本报告仅供研究参考，不构成个人投资建议。' }
}
