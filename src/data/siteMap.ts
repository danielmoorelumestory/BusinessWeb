import { ETF_REVIEW_PATH, GRID_TRADING_PATH, PLATE_RANKING_PATH, SECTOR_ROTATION_PATH, STOCK_ANALYSIS_PATH } from './notesLinks'

export interface NavItem {
  path: string
  label: string
}

export interface HubLink {
  path: string
  label: string
  desc: string
}

export interface HubGroup {
  id: string
  step?: string
  title: string
  hint?: string
  collapsed?: boolean
  links: HubLink[]
}

// 首页就是投资页，所以「投资」指向根路径
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '投资' },
  { path: '/notes', label: '笔记' },
  { path: '/blog', label: '博客' },
  { path: '/about', label: '关于' },
]

// 顺序：读书 → 定规则 → 观察盘 → 分析筛选 → 工具与参考。
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
    hint: '先想清楚怎么投，写成今年的计划。',
    links: [
      { path: '/investment-plan-2026', label: '2026 投资计划', desc: '三笔钱、再平衡、红线与回撤补仓' },
    ],
  },
  {
    id: 'watch',
    step: '第三步',
    title: '观察盘',
    hint: '每天看一眼观察盘就够，细节页只在需要时打开。看环境，不据此下单。',
    collapsed: false,
    links: [
      { path: '/watch', label: '观察盘', desc: '宏观阶段、全球主要指数与商品汇率、A 股涨跌停与资金流向，一页看完' },
      { path: '/monitor', label: '宏观温度', desc: '中美经济温度、周期阶段与对应动作' },
      { path: '/pulse', label: '全球行情', desc: '全球指数、商品外汇与 A 股涨跌停' },
      { path: '/daily-analysis', label: 'A股每日复盘', desc: '自动获取 A 股行情、涨跌停与连板复盘，保留交易日快照' },
      { path: ETF_REVIEW_PATH, label: '复盘列表', desc: 'ETF 分组观察、每日复盘笔记；有网格的标的显示状态与盈亏' },
      { path: STOCK_ANALYSIS_PATH, label: '大涨股解读', desc: '涨停梯队与各板块涨停个股，可选日期' },
      { path: SECTOR_ROTATION_PATH, label: '板块轮动', desc: '近 7 个交易日板块涨幅，横向对比每日强弱' },
      { path: PLATE_RANKING_PATH, label: '板块排行', desc: '近 20 日板块涨幅矩阵，按涨幅 >1% 出现频次排序' },
    ],
  },
  {
    id: 'research',
    step: '第四步',
    title: '分析筛选',
    hint: '从行业到公司：先看行业怎么运转，再挑值得研究的公司。观察池按书第32、36章自己建，10到20家，每家一份决策记录。',
    links: [
      { path: '/industry-landscape', label: '产业格局', desc: '行业结构、龙头与格局：固态电池、半导体产业链，和一页纸主题研究卡' },
      { path: '/future-trends', label: '未来趋势', desc: 'AI、智驾、机器人、创新药、航空航天、新能源等赛道的产业链与中美参与公司' },
      { path: '/research-notes', label: '公司研究', desc: '四个市场的公司库、候选池与研究方法' },
      { path: '/invest/national-team', label: '国家队持仓', desc: '汇金、证金、社保等持有哪些 A 股：按机构、行业、个股看持仓与季度变化' },
      { path: '/notes', label: '行业研究笔记', desc: '机器人、猪周期等行业深度笔记，和 ETF 网格总方案等完整报告' },
      { path: '/industry-etf', label: '行业 ETF 清单', desc: '7 个行业组、59 只 ETF 的代码、行业分布与备注' },
    ],
  },
  {
    id: 'tools',
    step: '第五步',
    title: '工具与参考',
    hint: '估值看价格贵不贵，网格管买卖节奏，ETF 地图查选品。',
    links: [
      { path: '/valuation', label: '公司估值', desc: '六方法三情景估值与报告导出' },
      { path: '/dcf', label: '现金流折现 DCF', desc: 'WACC + 五年现金流折现估值与安全边际，可保存记录' },
      { path: GRID_TRADING_PATH, label: '网格交易', desc: 'ETF / 个股网格模拟、回测与记录' },
      { path: '/invest/etf', label: 'ETF 流派地图', desc: '宽基、因子、主题、债券、商品等流派的主要 ETF 与风险' },
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
  if (itemPath === '/') {
    // 「投资」即首页：根路径、/invest 下的子页面、投资页收纳的页面都点亮它；
    // 同时又是顶部导航独立一项的页面（如 /notes），只点亮它自己那一项
    const ownNavItem = NAV_ITEMS.some(i => i.path !== '/' && matchesPath(i.path, pathname))
    return pathname === '/' || matchesPath('/invest', pathname) || (findInvestEntry(pathname) !== null && !ownNavItem)
  }
  return matchesPath(itemPath, pathname)
}
