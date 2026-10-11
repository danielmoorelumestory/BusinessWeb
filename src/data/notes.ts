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
