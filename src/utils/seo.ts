import { findDirection } from '../data/aiLab'
import { publishedManifest } from '../features/blog/generated-manifest'
import type { BlogEntry } from '../features/blog/catalog'

export const SITE_NAME = 'Live'
// canonical 始终指向主站（Vercel）；GitHub Pages 副本也会指向这里，避免重复收录
export const SITE_ORIGIN = (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://businessweb-c0u.pages.dev'

export interface RouteSeo {
  title: string
  description?: string
  /** 工具页、个人数据页不希望被收录 */
  noindex?: boolean
}

const DEFAULT_DESCRIPTION = '投资 · AI · 独立开发 · 自由生活。《正念投资》作者的长期实验。'

// 精确路径优先；其次按前缀匹配（最长前缀胜出）
const EXACT: Record<string, RouteSeo> = {
  '/': { title: 'Live｜投资 · AI · 独立开发 · 自由生活', description: DEFAULT_DESCRIPTION },
  '/invest': { title: '投资｜A 股与美股研究、方法与工具', description: '沪深 A 股与美股标普 500 的研究笔记、投资方法、ETF 指南与网格交易工具。' },
  '/ai/ai-skills': { title: 'AI Skills 工具库｜AI实验室', description: '可下载的 AI Skills：Orca 开发团队、投资分析、视频创作与小说写作，含安装方法和提示词示例。' },
  '/invest/etf': { title: 'ETF 投资指南', description: 'ETF 的选择、定投与网格交易思路。' },
  '/invest/national-team': { title: '国家队持仓｜汇金、证金、社保的 A 股持仓', description: '按报告期追踪中央汇金、证金公司、社保基金等持有的 A 股：机构、行业、个股持仓与季度变化。' },
  '/ai': { title: 'AI 工作室｜独立开发与 AI 学习路线', description: '用 AI 做独立开发：学习路线、实验方向与工具笔记。' },
  '/blog': { title: '博客｜投资、AI 与自由生活', description: '关于投资的耐心、AI 的实践，和通往自由生活的每一步。' },
  '/ai/fullstack-roadmap': { title: 'AI 全栈学习路线', description: '从零到独立开发者的 AI 全栈学习计划。' },
  '/ai/dev-team': { title: 'dev-team 使用说明｜Orca 开发团队', description: 'Orca 开发团队 dev-team 的完整使用说明：安装、自检、项目配置、日常派工、交接与验证范围，含完整 ZIP 和原文下载。' },
  '/life': { title: '生活实验室', description: '自由生活的长期实验记录。' },
  '/about': { title: '关于', description: '《正念投资》作者，投资、AI 与独立开发的长期实验。' },
  '/pulse': { title: '市场脉搏', description: '每日市场情绪与宏观数据快照。' },
  '/investment-plan-2026': { title: '投资计划', description: '资产配置、纪律红线、风险阶段与产业趋势判断。' },
  '/investment-targets': { title: '投资标的清单', description: '美股与港股重点投资标的研究清单。' },
  '/mainland-investment-targets': { title: 'A 股投资标的清单', description: '沪深 A 股重点投资标的研究清单。' },
  '/limit-up-analysis': { title: '已迁移', noindex: true },
  '/daily-analysis': { title: '每日分析', description: '自动获取 A 股指数、成交额、涨跌停、连板梯队和股票排行榜，保留交易日快照。' },
  '/trading-philosophy': { title: '交易哲学', description: '长期主义的交易原则与纪律。' },
  '/sector-rotation': { title: '已迁移', noindex: true },
  '/investment-strategy': { title: '投资策略', description: '长期投资的策略框架与执行方法。' },
  '/first-book': { title: '我的书｜《正念投资》', description: '《正念投资》及相关写作全文在线阅读。' },
  '/first-book/slow-is-fast': { title: '正念投资｜在线阅读', description: '从家庭资金安排到公司研究，用规则管理投资。选择适合自己的阅读路线，学习配置、估值、风险与复盘。' },
  '/future-trends': { title: '主题研究', description: 'AI、机器人、固态电池等主题的产业链、核心公司与逐家研究。' },
  '/watch': { title: '观察盘', description: '宏观阶段、全球主要指数与 A 股情绪，一页看完。', noindex: true },
  '/candidates': { title: '候选池', description: '我的候选公司与研究筛出的可买卖、价格太贵公司，一键进入估值、DCF 与网格。', noindex: true },
  '/industry-landscape': { title: '产业格局', description: '重点产业链与竞争格局梳理。' },
  '/notes': { title: '行业研究笔记', description: '机器人、猪周期等行业深度笔记，以及 ETF 网格交易总方案等完整报告。' },
  '/industry-etf': { title: 'ETF 与债券基金清单', description: '10类宽基、2只策略、1只商品、1只货币ETF及6只场外债基；7个行业组、58只行业ETF，备注展示最新分析文档结论速览中的综合判断。' },
  '/research-notes': { title: '研究笔记｜公司与行业研究', description: '沪深 A 股、港股、美股的公司研究笔记与审计报告。' },
  '/grid-trading': { title: '网格交易已迁移', noindex: true },
  '/valuation': { title: '公司估值工作台', noindex: true },
  '/dcf': { title: 'DCF 估值', noindex: true },
  '/monitor': { title: '监控面板', noindex: true },
}

const PREFIX: Array<[string, RouteSeo]> = [
  ['/grid-trading/', { title: '网格交易已迁移', noindex: true }],
  ['/limit-up-analysis/', { title: '已迁移', noindex: true }],
  ['/first-book/read/', { title: '《正念投资》在线阅读', description: '《正念投资》章节全文在线阅读。' }],
  ['/notes/', { title: '行业研究笔记', description: '行业深度笔记与完整报告。' }],
  ['/research-notes/', { title: '公司研究笔记', description: '单家公司的研究笔记、财务与估值要点。' }],
  ['/future-trends/solid-state/', { title: '固态电池｜公司研究', description: '固态电池公司业务敞口、财务质量、估值假设、多空观点与证据。' }],
  ['/future-trends/company/', { title: '主题研究｜公司研究', description: '公司经营、护城河、隐忧、情景估值与研究证据。' }],
  ['/ai/', { title: 'AI 实验方向', description: 'AI 独立开发的实验方向与笔记。' }],
]

export function resolveSeo(pathname: string, blogEntries: BlogEntry[] = publishedManifest): RouteSeo & { known: boolean } {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const exact = EXACT[path]
  if (exact) return { ...exact, known: true }
  if (path.startsWith('/blog/')) {
    const slug = path.slice('/blog/'.length)
    const post = blogEntries.find(entry => entry.status === 'published' && entry.slug === slug)
    return post ? { title: `${post.title}｜博客`, description: post.summary, known: true } : { title: '页面不存在', noindex: true, known: false }
  }
  const direction = path.startsWith('/ai/') ? findDirection(path.slice('/ai/'.length)) : undefined
  if (direction) return { title: `${direction.title}｜AI实验室`, description: direction.reason, known: true }
  let best: [string, RouteSeo] | undefined
  for (const entry of PREFIX) {
    const [prefix] = entry
    if (path.startsWith(prefix) && (!best || prefix.length > best[0].length)) best = entry
  }
  if (best) return { ...best[1], known: true }
  return { title: '页面不存在', noindex: true, known: false }
}

export function formatTitle(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
}
