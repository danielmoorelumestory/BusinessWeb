import type { Company } from './companies'

// 腾讯自选股投研专家团 skill 的独立圆桌复核；公告事实与模型假设分开。
// 完整报告、旧结论与逐项审计位于 public/research/，不是收益保证或交易指令。
export const SP500_REVIEW_DATE = '2026-09-30'
export const SP500_REPORT = 'research/sp500-roundtable-2026-09-30.html'

export const sp500Reassessment = [
  { code: 'SPGI', name: '标普全球', price: 396.87, oldRatio: '2.20×', ratio: '2.59×（旧情景算术，未认证）',
    conclusion: '观察（待重建）：经营质量优先复核；分拆后 EPS 口径未桥接，旧赔率不能认证',
    evidence: '7/28 公告：剔除 Mobility 的调整后 EPS 同比 +23%；全年持续经营 GAAP EPS 16.35–16.60、调整后 17.50–17.75。旧 $513 基准缺少相同口径的 EPS/PE 依据。',
    next: '核对剥离后股数、正常化 EPS、评级发行收入与指数资产挂钩费；重建悲观与基准价值后再比较赔率。',
    source: 'https://www.sec.gov/Archives/edgar/data/64040/000006404026000040/spgi2q2026-earningsrelease.htm' },
  { code: 'CVS', name: 'CVS Health', price: 86.76, oldRatio: '2.09×（程序化）', ratio: '2.13×（旧整数情景算术，未认证）',
    conclusion: '观察（待重建）：经营改善已确认；旧归一化 EPS 不等于公司指引，撤回优先关注认证',
    evidence: '8/5 公告：Q2 营收 +7.3%，全年调整后 EPS 上调至 7.90–8.10、GAAP 6.84–7.04，经营现金流至少 $11.5bn。旧模型以归一化 TTM 9.18 外推 2027E 9.65，须重建盈利桥接；CFO 不等于 FCF。',
    next: '核对医疗成本率、下半年利润指引与现金资本开支；将 2027 盈利增长依据与 2026 指引分开。',
    source: 'https://www.cvshealth.com/news/company-news/cvs-health-corporation-reports-strong-second-quarter-2026-results-and-raises-full-year-2026-guidance.html' },
  { code: 'ZTS', name: '硕腾', price: 70.245, oldRatio: '2.97×', ratio: '3.65×（旧情景算术，未认证）',
    conclusion: '观察（待重建）：美国宠物业务未止跌；保留反转研究，撤回确定性机会表述',
    evidence: '8/6 公告：美国伴侣动物收入 −11%；全年调整后 EPS 下调至 6.15–6.25、GAAP 5.55–5.65，有机收入 −3% 至 −1%。旧页已记录收入下调，不能断言它完全遗漏，但 $93.8 基准缺少 EPS/PE 及恢复路径。',
    next: '美国伴侣动物、皮肤科与寄生虫产品降幅收窄，净价与份额稳定，指引停止下调后再验证恢复模型。',
    source: 'https://investor.zoetis.com/news/news-details/2026/Zoetis-Announces-Second-Quarter-2026-Results/default.aspx' },
  { code: 'PEP', name: '百事可乐', price: 128.89, oldRatio: '2.3:1（实际为乐观口径）', ratio: '0.73:1（基准）；2.10:1（乐观）',
    conclusion: '观察：基准赔率未达标；保留价值与收息逻辑，撤回“唯一达标”',
    evidence: '7/9 公告：Q2 有机收入 +2.4%、核心 EPS +4%，GAAP EPS +137% 含去年减值低基数。沿用旧 $115/$139/$158 情景，基准赔率 (139−128.89)/(128.89−115)=0.73；$123 仅是旧模型 2:1 数学门槛。旧 FCF 与股东返还不同期别，覆盖结论撤回。',
    next: '跟踪北美销量、核心利润率和指引；统一期间核对 FCF、股息与回购，不能只将股息加入上行端。',
    source: 'https://www.sec.gov/Archives/edgar/data/77476/000007747626000037/q220268-kxexhibit991.htm' },
  { code: 'AES', name: 'AES', price: 14.8901, oldRatio: '2.8×（程序化）', ratio: '旧成长赔率撤回；距 $15 现金价 +0.74%',
    conclusion: '观察（待重建）：转收购事件研究，撤回旧 $21 基准成长估值',
    evidence: '3/2 官方收购公告：每股 $15 现金，预计 2026 年末或 2027 年初交割，仍有交割条件。现价距现金价仅 +0.74%（未计股息和时间）；旧 EPS×PE 外推 $21 不适用于正常交割。',
    next: '核对监管审批、交割时点与交易失败价值；失败情景和现金交割价需要独立事件模型。',
    source: 'https://www.aes.com/energy-insights/consortium-led-global-infrastructure-partners-and-eqt-agrees-acquire-aes' },
  { code: 'CINF', name: '辛辛那提金融', price: 161.12, oldRatio: '2.5×（程序化）', ratio: '2.52×（旧情景算术，模型撤回）',
    conclusion: '观察（待重建）：投资重估收益不可永久化，旧 GAAP 盈利外推失效',
    evidence: '7/27 公告：Q2 GAAP EPS 8.05，但经营 EPS 1.43（上年 1.97），每股投资损益 6.62；旧 TTM 21.20→基准 EPS 25.44 把波动收益当增长，不能据此认证 $242。',
    next: '以正常化承保利润、投资收入、巨灾成本及 PB/可持续 ROE 重建，区分经营盈利和公允价值变动。',
    source: 'https://investors.cinfin.com/2026-07-27-Cincinnati-Financial-Reports-Second-Quarter-2026-Results' },
  { code: 'OMC', name: '宏盟集团', price: 74.485, oldRatio: '2.43×（程序化）', ratio: '2.36×（旧情景算术，未认证）',
    conclusion: '观察（待重建）：并购后盈利桥接不完整，旧 $111 基准不再认证',
    evidence: '7/28 公告：Q2 有机增长 6.1%，GAAP EPS 2.08、调整后 2.65；IPG 并表改变收入、股数及整合成本。旧营收 +63.4% 不等于内生增速，旧 EPS 7.18→8.61 需按并购后口径重建。',
    next: '统一并购后股数、利息、摊销与持续整合支出；跟踪有机增长而非并表收入增速。',
    source: 'https://investor.omc.com/news/news-details/2026/Omnicom-Reports-Second-Quarter-2026-Results/default.aspx' },
  { code: 'UHS', name: '环球医疗服务', price: 175.38, oldRatio: '2.1×（程序化）', ratio: '2.15×（旧情景算术，未认证）',
    conclusion: '观察（待重建）：全年盈利指引下调；旧 EPS 增长外推缺乏支持',
    evidence: '7/27 SEC 公告：全年调整 EPS 由 22.64–24.52 下调至 22.28–23.65。旧 2027E 25.97 超出 2026 指引上限，并非单凭此否定 2027，但必须提供新增增长证据；Florida Medicaid 追溯项目及保险准备金净增税前 $72m，非经常盈利需清洗。',
    next: '剔除追溯项目影响，核对新版全年指引、支付政策、Talkspace 整合与经营现金流。',
    source: 'https://www.sec.gov/Archives/edgar/data/352915/000119312526318940/uhs-ex99_1.htm' },
]

export const sp500AiEvidence = [
  { code: 'MSFT', evidence: '7/29 官方 FY26Q4 营收约 $90.0bn、同比 +18%；经营现金 $55.441bn − 现金固定资产投入 $35.802bn = 季度 FCF $19.639bn（本轮计算）。盈利兑现有证据，现价安全边际仍未认证。', source: 'https://www.microsoft.com/en-us/Investor/earnings/FY-2026-Q4/press-release-webcast' },
  { code: 'NVDA', evidence: '8/26 官方 FY27Q2 营收 $96.221bn、同比 +106%，数据中心 $89.0bn、+117%，季度 FCF $21.341bn；AI 收入已兑现，但旧模型与现价安全边际仍需独立验证。', source: 'https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027' },
  { code: 'ORCL', evidence: '9/10 官方 FY27Q1 经营现金 $23.103bn、现金 capex $28.499bn、FCF −$5.396bn；近四季 FCF −$28.720bn（相加计算）。经营现金含融资性客户预付款 $11.363bn，增长融资与摊薄风险仍成立；不采用第三方 −$45.854bn FCF 字段。', source: 'https://investor.oracle.com/files/content_files/1q27-pressrelease-September_FINAL.pdf' },
]

export function applySp500Reassessment(company: Company): Company {
  // 最新Q3原件复核优先于9月圆桌；后者仍保留在日期报告中。
  if (company.code === 'PEP' && /2026Q3/.test(company.asOf) && /2026-10-13/.test(company.asOf)) return company
  if (company.market !== 'us') return company
  // 保证初始手工数据与异步加载数据一致；重复应用不会重复追加档案。
  if (company.metrics.some(([key]) => key === '圆桌复核日期')) return company
  const row = sp500Reassessment.find(r => r.code === company.code)
  if (!row) {
    const ai = sp500AiEvidence.find(r => r.code === company.code)
    if (!ai) return company
    return {
      ...company,
      headline: `观察：${ai.code === 'ORCL' ? '增长融资与现金流风险已确认' : 'AI 收入与正现金流已确认'}；现价安全边际未认证`,
      metrics: [
        ['圆桌复核日期', SP500_REVIEW_DATE], ['本轮一手现金流证据', ai.evidence],
        ['上轮结论（存档）', company.headline], ...company.metrics,
      ],
      ratioNote: `本轮只验证经营事实，未认证旧情景价值。上轮模型记录：${company.ratioNote || '未给出'}。`,
      pitfalls: [`本轮一手来源：${ai.source}`, '以下旧情景与价格为上轮模型，不代表本轮已确认安全边际。', ...(company.pitfalls || [])],
      asOf: `2026-09-30 增补公告复核（现金流必须按标注的财季与定义比较）；其余保留上轮口径：${company.asOf}`,
    }
  }
  return {
    ...company,
    rating: row.code === 'PEP' ? '观察（基准赔率未达标）' : '观察（待重建）',
    headline: row.conclusion,
    certainty: '公告事实已核实；情景价值未认证，不能视为确定收益',
    duration: '旧研究的增长期限未重新认证；公司指引与未来增长预测分开',
    asOf: '2026-09-30 圆桌复核；报价为 14:41–14:48 UTC 的美元盘中快照，非收盘价。旧结论与旧情景仅供存档；一手公告日期见证据。',
    metrics: [
      ['圆桌复核日期', SP500_REVIEW_DATE],
      ['价格锚点', `$${row.price}（2026-09-30 盘中，yfinance，USD）`],
      ['本轮结论', row.conclusion],
      ['本轮赔率口径', row.ratio],
      ['一手公告证据', row.evidence],
      ['上轮结论（存档）', company.headline],
      ['上轮赔率（存档）', row.oldRatio],
      ...company.metrics.map(([key, value]): [string, string] => [`上轮·${key}`, value]),
    ],
    ratioNote: `${row.ratio}。统一按 (Base−P)/(P−Bear) 计算，不含股息；旧整数情景有舍入误差，不是模型认证。`,
    thesis: [row.conclusion, row.evidence],
    risk: [...company.risk, '旧估值模型尚未认证，不能用数值达标代替盈利与悲观情景证据。'],
    next: [row.next],
    scenarios: undefined,
    discipline: { zone: '未给出已认证的价位区间', add: row.next, trim: '未提供已认证的兑现区间；需先重建估值', invalid: '指引、经营趋势或事件条件变化时重新评估', position: '本轮不提供仓位指令' },
    bullBear: undefined,
    pitfalls: [row.evidence, `一手来源：${row.source}`, '详情中的“上轮”指标为历史存档，不应当作本轮确认数据。', ...(company.pitfalls || [])],
    pros: [row.code === 'AES' ? '现金收购条款已核实' : '保留既有业务研究方向，公告证据见本轮结论'],
    cons: [row.conclusion],
    growth: [row.evidence],
    calendar: [row.next],
  }
}
