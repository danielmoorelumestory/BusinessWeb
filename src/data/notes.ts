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
    title: '159865 养殖ETF国泰：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的日周线、量价与基金数据，复核箱体偏弱整理、分层确认位和猪周期研究边界。',
    tags: ['ETF', '畜牧养殖', '技术分析', '交易研究'],
  },
  {
    slug: '159259-growth-etf-analysis',
    title: '159259 成长ETF易方达：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的日周线复算，校正 ATR、量价推断和风险表达，保留主跌段前低再试探判断。',
    tags: ['ETF', '成长风格', '技术分析', '交易研究'],
  },
  {
    slug: '159928-consumer-etf-analysis',
    title: '159928 消费ETF汇添富：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的前复权日周线，复核箱体筑底、零轴下方金叉及分层压力与确认条件。',
    tags: ['ETF', '主要消费', '技术分析', '交易研究'],
  },
  {
    slug: '513180-hang-seng-tech-etf-analysis',
    title: '513180 恒生科技ETF华夏：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的日周线与QDII净值时点差异，复核下降通道、反抽压力和折溢价风险边界。',
    tags: ['ETF', '恒生科技', 'QDII', '技术分析', '交易研究'],
  },
  {
    slug: '562500-robot-etf-analysis',
    title: '562500 机器人ETF华夏：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的日周线复算，修正阶段高点、ATR口径及确认位与压力位倒挂，保留短中期下跌未止的核心判断。',
    tags: ['ETF', '机器人', '技术分析', '交易研究'],
  },
  {
    slug: '159566-energy-storage-battery-etf-analysis',
    title: '159566 储能电池ETF易方达：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的日周线复算，校正 ATR、突破确认区与申赎判断边界，保留短中期偏空的核心结论。',
    tags: ['ETF', '储能电池', '技术分析', '交易研究'],
  },
  {
    slug: '516750-building-materials-etf-analysis',
    title: '516750 建材ETF富国：短期 / 中期买卖点分析（审核修订版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的日周线与流动性复核，修正周MA120、双底颈线和目标区口径，保留箱体筑底候选判断。',
    tags: ['ETF', '建筑材料', '技术分析', '交易研究'],
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
    slug: '516650-nonferrous-metals-etf-analysis',
    title: '516650 有色金属ETF华夏：短期 / 中期买卖点分析（最终版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的日线、周线、量价、Fib 与基金产品数据，复核短期反抽、中期确认位及分层风险框架。',
    tags: ['ETF', '有色金属', '技术分析', '交易研究'],
  },
  {
    slug: '159146-electric-power-etf-analysis',
    title: '159146 电力ETF华宝：短期 / 中期买卖点分析（最终版）',
    date: '2026-10-11',
    summary: '基于截至 2026-10-09 的日线、周线、量价、Fib 与产品数据，梳理短中期确认位、支撑压力和情景化操作框架。',
    tags: ['ETF', '电力', '技术分析', '交易研究'],
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
