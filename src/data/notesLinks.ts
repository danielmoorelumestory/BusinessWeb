// notes 的三个工具（网格交易、ETF 复盘、股市分析）随主站一起构建，放在 /note/ 下（见 scripts/build-cloudflare.mjs）。
// 站点只有 Cloudflare 一条构建线，所以入口地址是固定的站内路径。

/** 网格交易计算器 */
export const GRID_TRADING_PATH = '/note/lab/grid-trading/'

/** 网格列表（仅网格计算器保存的标的） */
export const GRID_SAVED_PATH = '/note/lab/grid-trading/saved'

/** ETF 复盘 hub：分组观察、每日复盘笔记；有网格的标的显示状态与盈亏 */
export const ETF_REVIEW_PATH = '/note/lab/etf-review/'

/** ETF 主升浪：同花顺主升浪榜单的每日快照（趋势回踩、新入池、分类筛选、历史上涨区间） */
export const ETF_UPTREND_PATH = '/note/lab/etf-uptrend'

/** 股市分析 lab（大涨股解读、板块轮动、板块排行），用 # 直接打开某个工具 */
export const STOCK_LAB_BASE = '/note/lab/stock/'
export const STOCK_ANALYSIS_PATH = `${STOCK_LAB_BASE}#stock-analysis`
export const SECTOR_ROTATION_PATH = `${STOCK_LAB_BASE}#sector-rotation`
export const PLATE_RANKING_PATH = `${STOCK_LAB_BASE}#plate-ranking`

/** 以 /note/ 开头的路径由静态托管提供，不属于前端路由，必须整页加载 */
export const isNotesPath = (path: string): boolean => path === '/note' || path.startsWith('/note/')

/** 完整的 http(s) 地址：不属于前端路由，也必须整页加载 */
export const isAbsoluteUrl = (path: string): boolean => /^https?:\/\//i.test(path)
