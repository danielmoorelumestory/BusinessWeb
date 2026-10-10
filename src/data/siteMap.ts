import { GRID_TRADING_PATH, PLATE_RANKING_PATH, SECTOR_ROTATION_PATH, STOCK_ANALYSIS_PATH } from './notesLinks'

export interface NavItem {
  path: string
  label: string
}

export interface HubLink {
  path: string
  label: string
  desc: string
  /** 已舍弃的页面：保留可访问，子页面顶部显示这条说明 */
  archived?: string
}

export interface HubGroup {
  id: string
  step?: string
  title: string
  hint?: string
  collapsed?: boolean
  links: HubLink[]
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '首页' },
  { path: '/invest', label: '投资' },
  { path: '/ai', label: 'AI实验室' },
  { path: '/life', label: '自由空间' },
  { path: '/about', label: '关于' },
]

// 顺序即书里的流程：读书 → 定规则 → 选标的 → 用工具执行 → 少看行情；已舍弃的页面折叠在最后。
// 分组同时决定子页面顶部的「同组切换条」，同一组只放同一件事。
export const INVEST_GROUPS: HubGroup[] = [
  {
    id: 'read',
    step: '第一步',
    title: '读这本书',
    links: [
      { path: '/first-book', label: '我的书', desc: '《正念投资：普通人用规则代替盯盘的投资方法》全文与目录' },
    ],
  },
  {
    id: 'method',
    step: '第二步',
    title: '定规则',
    hint: '先想清楚怎么投，写成今年的计划；宏观温度用来判断所处阶段。',
    links: [
      { path: '/investment-plan-2026', label: '2026 投资计划', desc: '三笔钱、再平衡、红线与回撤补仓' },
      { path: '/monitor', label: '宏观温度', desc: '中美经济温度、周期阶段与对应动作' },
    ],
  },
  {
    id: 'research',
    step: '第三步',
    title: '选标的',
    hint: '研究什么：公司研究与产业链。观察池按书第32、36章自己建，10到20家，每家一份决策记录。',
    links: [
      { path: '/research-notes', label: '公司研究', desc: '四个市场的公司库、候选池与研究方法' },
      { path: '/invest/etf', label: 'ETF 流派地图', desc: '宽基、因子、主题、债券、商品等流派的主要 ETF 与风险' },
      { path: '/future-trends', label: '未来趋势', desc: 'AI、智驾、机器人、创新药、航空航天、新能源等赛道的产业链与中美参与公司' },
      { path: '/industry-landscape', label: '产业格局', desc: '固态电池、半导体产业链，和一页纸主题研究卡' },
    ],
  },
  {
    id: 'tools',
    step: '第四步',
    title: '用工具执行',
    hint: '估值定价格，网格管节奏，AI 工具辅助研究。',
    links: [
      { path: '/valuation', label: '公司估值', desc: '六方法三情景估值与报告导出' },
      { path: '/dcf', label: '现金流折现 DCF', desc: 'WACC + 五年现金流折现估值与安全边际，可保存记录' },
      { path: GRID_TRADING_PATH, label: '网格交易', desc: 'ETF / 个股网格模拟、回测与记录' },
      { path: '/invest/ai-tools', label: 'AI 工具', desc: '投资分析、视频创作与小说写作 Skills 的介绍和下载包' },
    ],
  },
  {
    id: 'watch',
    title: '看行情（选看）',
    hint: '书里主张少看行情，这几页只作参考。',
    collapsed: false,
    links: [
      { path: '/pulse', label: '全球行情', desc: '全球指数、商品外汇与 A 股涨跌停' },
      { path: STOCK_ANALYSIS_PATH, label: '大涨股解读', desc: '涨停梯队与各板块涨停个股，可选日期' },
      { path: SECTOR_ROTATION_PATH, label: '板块轮动', desc: '近 7 个交易日板块涨幅，横向对比每日强弱' },
      { path: PLATE_RANKING_PATH, label: '板块排行', desc: '近 20 日板块涨幅矩阵，按涨幅 >1% 出现频次排序' },
    ],
  },
  {
    id: 'archived',
    title: '已舍弃',
    hint: '和书里的方法不一致，不再更新，只留存档。',
    collapsed: true,
    links: [
      { path: '/trading-philosophy', label: '道与术（短线策略）', desc: '早期短线交易体系', archived: '已舍弃：这是早期的短线交易体系，需要盯盘，和书里「不盯盘、不预测」的方法相反，仅留存档。' },
      { path: '/investment-strategy', label: '综合投资策略框架', desc: '巴菲特 · 邓普顿 · 双阶段轮动', archived: '已舍弃：这套框架已不再使用，方法以书和 2026 投资计划为准，仅留存档。' },
      { path: '/mainland-investment-targets', label: 'A 股观察池（AI 扩散）', desc: '2026 年 1 月的 AI 主题标的清单', archived: '已舍弃：这是 2026 年 1 月按 AI 主题整理的具体标的清单，含“立即配置”“回调加仓”等买卖建议和未注明来源的预测数字，与书里“不荐股、无来源的数字不写”相悖，内容已过期，仅留存档，不构成投资建议。观察池请按书第32、36章自己建立。' },
      { path: '/investment-targets', label: '美股观察池', desc: '未完成的占位页', archived: '已舍弃：这一页从未完成。观察池请按书第32、36章自己建立：10到20家，每家一份统一决策记录（37.4）。' },
    ],
  },
]

const ALL_LINKS: Array<{ group: HubGroup; link: HubLink }> = INVEST_GROUPS.flatMap(group =>
  group.links.map(link => ({ group, link }))
)

function matchesPath(base: string, pathname: string): boolean {
  return pathname === base || pathname.startsWith(base + '/')
}

export function findInvestEntry(pathname: string): { group: HubGroup; link: HubLink } | null {
  let best: { group: HubGroup; link: HubLink } | null = null
  for (const entry of ALL_LINKS) {
    if (!matchesPath(entry.link.path, pathname)) continue
    if (!best || entry.link.path.length > best.link.path.length) best = entry
  }
  return best
}

export function isNavActive(itemPath: string, pathname: string): boolean {
  if (itemPath === '/') return pathname === '/'
  if (itemPath === '/invest') {
    return matchesPath('/invest', pathname) || findInvestEntry(pathname) !== null
  }
  return matchesPath(itemPath, pathname)
}
