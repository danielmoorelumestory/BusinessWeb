// 行业研究笔记索引。正文是 public/notes/<slug>.md（不含 front matter，元数据都在这里），由 NoteDetail 运行时读取。
// 新增笔记：在 public/notes/ 放 Markdown，并在这里按日期倒序登记；notes.test.ts 会检查文件、slug 与日期。
export type NoteMeta = {
  slug: string
  title: string
  date: string
  summary: string
  tags: string[]
  /** 独立的完整 HTML 报告，相对站点根（public/ 下），例如 research/xxx.html */
  report?: string
}

export const NOTES: NoteMeta[] = [
  {
    slug: '159865-livestock-etf-analysis',
    title: '159865 养殖ETF国泰：估值、持仓与趋势全面分析（完善版）',
    date: '2026-10-12',
    summary: '结合 10 月 12 日量价与份额、指数估值分位和权重，研判猪周期、短中长期趋势及风险。',
    tags: ['ETF', '畜牧养殖', '估值分析', '技术分析', '交易研究'],
  },
  {
    slug: '159259-growth-etf-analysis',
    title: '159259 成长ETF易方达：估值、持仓与趋势全面分析（完善版）',
    date: '2026-10-12',
    summary: '结合指数估值、科技权重、10 月 12 日再探前低的量价与份额，分析成长风格短中长期风险。',
    tags: ['ETF', '成长风格', '估值分析', '技术分析', '交易研究'],
  },
  {
    slug: '513180-hang-seng-tech-etf-analysis',
    title: '513180 恒生科技ETF华夏：估值、持仓与趋势全面分析（完善版）',
    date: '2026-10-12',
    summary: '复核恒生科技估值分位、跟踪组合权重和 10 月 12 日量价，纳入指数改编与 QDII 时差风险。',
    tags: ['ETF', '恒生科技', 'QDII', '估值分析', '技术分析', '交易研究'],
  },
  {
    slug: '562500-robot-etf-analysis',
    title: '562500 机器人ETF华夏：估值、持仓与趋势全面分析（完善版）',
    date: '2026-10-12',
    summary: '结合机器人指数估值、前十大及行业分布、量价和产业政策，区分长期景气与短期破位风险。',
    tags: ['ETF', '机器人', '估值分析', '技术分析', '交易研究'],
  },
  {
    slug: '159566-energy-storage-battery-etf-analysis',
    title: '159566 储能电池ETF易方达：估值、持仓与趋势全面分析（完善版）',
    date: '2026-10-12',
    summary: '更新国证储能电池指数更名、估值与权重，结合最新招标和 10 月 12 日量价研判趋势。',
    tags: ['ETF', '储能电池', '估值分析', '技术分析', '交易研究'],
  },
  {
    slug: '516750-building-materials-etf-analysis',
    title: '516750 建材ETF富国：估值、持仓与趋势全面分析（完善版）',
    date: '2026-10-12',
    summary: '核对建材指数低 PB 与高 PE 的矛盾、房地产数据和小规模基金流动性，更新短中长期判断。',
    tags: ['ETF', '建筑材料', '估值分析', '技术分析', '交易研究'],
  },
  {
    slug: '516650-nonferrous-metals-etf-analysis',
    title: '516650 有色金属ETF华夏：估值、持仓与趋势全面分析（完善版）',
    date: '2026-10-12',
    summary: '区分工业金属、黄金与稀土的驱动，结合 10 月 12 日放量回落、估值分位和基金份额更新趋势判断。',
    tags: ['ETF', '有色金属', '估值分析', '技术分析', '交易研究'],
  },
  {
    slug: '159146-electric-power-etf-analysis',
    title: '159146 电力ETF华宝：估值、持仓与趋势全面分析（完善版）',
    date: '2026-10-12',
    summary: '核对电力指数估值、权重、交易电量与 10 月 12 日冲高回落，区分电力市场扩容和企业盈利。',
    tags: ['ETF', '电力', '估值分析', '技术分析', '交易研究'],
  },
  {
    slug: '159928-consumer-etf-analysis',
    title: '159928 消费ETF汇添富：估值、持仓与趋势全面分析（完善版）',
    date: '2026-10-11',
    summary: '结合截至 2026-10-09 的估值分位、最新指数权重、ETF份额、政策与行业景气，复核箱体筑底及短中长期趋势。',
    tags: ['ETF', '主要消费', '估值分析', '技术分析', '交易研究'],
  },
  {
    slug: '601318-ping-an-analysis',
    title: '601318 中国平安：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的复权与不复权日周线，复核区间震荡、分层确认位和复权敏感风险边界，并与项目既有保险基本面研究明确区分。',
    tags: ['个股', '保险', '技术分析', '交易研究'],
  },
  {
    slug: '600096-yuntianhua-analysis',
    title: '600096 云天化：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的复权与不复权日周线，复核升浪回调、分层确认位和动态风险边界，并与项目既有基本面研究明确区分。',
    tags: ['个股', '磷化工', '技术分析', '交易研究'],
  },
  {
    slug: '600989-baofeng-energy-analysis',
    title: '600989 宝丰能源：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的复权与不复权日周线，复核回调修复、分层确认位和动态风险边界，并与项目既有基本面研究明确区分。',
    tags: ['个股', '煤化工', '技术分析', '交易研究'],
  },
  {
    slug: 'etf-grid-trading-master-plan',
    title: 'ETF网格交易总方案（含逐只绝对价格网格）',
    date: '2026-09-23',
    summary: '配置框架、风险预算、17 只 ETF 的逐只绝对价格网格与执行纪律。完整报告为独立 HTML 页面，含图表。',
    tags: ['ETF', '网格交易', '资产配置', '投资方案'],
    report: 'research/etf-grid-master-plan-2026-09-23.html',
  },
  {
    slug: 'robotics-industry-research',
    title: '机器人行业研究：562500 与 159530 对比及产业链验证全景研报',
    date: '2026-09-22',
    summary: '主题比较中证机器人ETF华夏（562500.SH）与国证机器人产业ETF（159530.SZ），解析核心零部件定点放量逻辑、估值回撤与代表性成分股基本面。',
    tags: ['高端制造', '机器人', '行业研究'],
  },
  {
    slug: 'swine-poultry-research',
    title: '猪肉价格周期与头部生猪养殖企业股价联动及分化全景研报',
    date: '2026-09-15',
    summary: '历轮猪周期（2006—2026）演进复盘、官方宏观统计底座、股价与猪价传导机制及头部企业（牧原、温氏、新希望）异质性α全景深度研报。',
    tags: ['农业周期', '畜牧养殖', '行业研究'],
  },
]

export const findNote = (slug: string | undefined): NoteMeta | undefined => NOTES.find(n => n.slug === slug)

/** 全部标签，按出现的笔记数倒序，同数按名称排序 */
export function allNoteTags(notes: NoteMeta[] = NOTES): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>()
  for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'))
}
