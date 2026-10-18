export type Lab = {
  slug: string;
  title: string;
  summary: string;
};

export const labs: Lab[] = [
  {
    slug: 'etf-review',
    title: 'ETF 复盘',
    summary: '按分组观察 ETF：每日结构化笔记、行情摘要；有网格的标的显示状态与盈亏。',
  },
  {
    slug: 'stock',
    title: '股市分析',
    summary: '大涨股解读、板块轮动、板块排行；财联社行情 + IndexedDB 本地缓存。',
  },
  {
    slug: 'grid-trading',
    title: '网格交易计算器',
    summary: '按历史日线高低价回测 ETF / A 股网格的买卖触发与盈亏。',
  },
  {
    slug: 'grid-trading/saved',
    title: '网格列表',
    summary: '仅网格回测标的的参数、成交与盈亏。',
  },
  {
    slug: 'grid-trading/minute',
    title: '分钟线',
    summary: '查看云端每日自动同步的 1 分钟线：分时价格与成交量，支持前复权。',
  },
];
