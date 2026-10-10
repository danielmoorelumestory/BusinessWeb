import snapshot from './mcpSnapshot.json'

export const MCP = snapshot
export type McpCompany = typeof MCP.companies[number]
export const mcpCompany = (name: string) => MCP.companies.find(c => c.name === name)
export const primaryListing = (c: McpCompany | undefined) => c?.listings.find(l => l.available)
export const rawUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`
export function amount(value: number | null | undefined): string {
  return value == null ? '[MISSING]' : `${(value / 1e8).toLocaleString('zh-CN', { maximumFractionDigits: 3 })} 亿`
}
export function cashAssessment(c: McpCompany | undefined): string {
  const f = c?.financials
  const s = primaryListing(c)?.summary
  const values = f ?? s
  const prefix = f ? '2026H1' : '供应商滚动摘要'
  if (!values || values.cfo == null) return '经营现金数据缺失；不能据此推断盈利或偿债能力。'
  if (values.cfo < 0) return `${prefix}经营现金流为负，优先核回款、库存和融资；技术进展尚未形成现金证据。`
  if (values.fcf != null && values.fcf < 0) return `${prefix}经营现金流为正、FCF 为负，扩产消耗现金；需核验投资回报与融资来源。`
  return `${prefix}现金流提供经营支撑；仍需剔除预收款和营运资金波动，集团现金不代表固态利润。`
}

export const GROUP_QUESTIONS: Record<string, string> = {
  '电解质与材料': '验证路线、材料纯度、合格吨数、客户复购与加工利润；研发或送样不等于量产销售。',
  '电芯制造': '验证电芯组成、客户装车、运行压力、连续生产良率和质保成本；集团出货不能计作固态出货。',
  '制造设备': '验证专用订单、验收与回款，区分中试线与量产线；工艺变更可能带来重设计成本。',
}
export const PRIMARY_CHECKS: Record<string, string> = {
  '贝特瑞': '半年报摘要原件：H1 收入、归母、扣非与经营现金已核；营收 +30.40%，归母 −20.07%，现金为负。行情与完整三表仍缺。',
  '赢合科技': '半年报摘要原件：H1 收入、归母、扣非与经营现金流已核对；固态专用订单及收入待核。',
  '天赐材料': '半年报原件：H1 收入、归母、扣非与经营现金流已核对；经营现金约为归母的 13.9%，固态专用贡献待核。',
  '先导智能': '半年报原件：H1 收入、归母净利润与经营现金流已核对；FCF 为 MCP 报表派生值。',
  '上海洗霸': '半年报原件：H1 收入、归母净利润与经营现金流已核对；FCF 为 MCP 报表派生值。',
  '当升科技': '半年报原件：H1 收入、归母净利润与经营现金流已核对；净利润 +67.25%，经营现金流 −77.97%。',
  '新宙邦': '半年报原件：H1 收入、归母净利润与经营现金流已核对；固态电解质处于研发及千吨级规划阶段。',
  'QuantumScape': 'SEC 股东信原件：H1 净亏损、经营现金流及资本支出已核对。未列 GAAP 收入，供应商将其标准化为 0；Q2 客户账单 1,080 万美元不等于收入。',
  'Solid Power': '公司业绩原件：H1 收入、净亏损与经营现金流已核对；补助单列，未并入收入。',
  '赣锋锂业': '港交所 IFRS 原件：收入 228.84121 亿元、经营现金流 13.28246 亿元。下表 A 股供应商收入为 230.96945 亿元；差异桥未齐，不合并为同一口径。',
}
