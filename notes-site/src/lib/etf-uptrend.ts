// ETF 主升浪实验页的数据类型与纯函数：筛选、排序、计数。数据由 scripts/etf_uptrend.py 每日导出到
// public/data/etf-uptrend/（index.json、detail.json、days/日期.json），口径说明见该脚本。

/** 与 scripts/etf_uptrend.py 的 TAG_KEYS 顺序一致；行数据第三列是这些标签的位掩码。 */
export const TAG_KEYS = ['trend_retracement', 'new_pool', 't0', 'industry', 'broad_index', 'unique_rep'] as const;
export type TagKey = (typeof TAG_KEYS)[number];
export const bit = (k: TagKey): number => 1 << TAG_KEYS.indexOf(k);

/** [同花顺代码 如 20:589200, 名称, 标签位掩码] */
export type Row = [string, string, number];

export interface DayMeta {
  d: string;
  asof: string | null;
  at: string;
  st: string;
  n: Partial<Record<'all' | TagKey, number>>;
  notes: string[];
}

export interface RunEntry {
  started_at?: string;
  finished_at?: string;
  status: string;
  message?: string | null;
  source_as_of?: string | null;
}

export interface UptrendIndex {
  days: DayMeta[];
  status: { last_run?: RunEntry; last_success?: RunEntry };
  schedule: { times: string[]; tz: string };
  source_page: string;
}

export interface Day {
  d: string;
  cats: TagKey[];
  rows: Row[];
}

export interface Period {
  start_day: string;
  end_day: string;
  duration?: number;
  period_rise?: number;
  period_change?: number;
  main_amount_in?: number;
  step_signal_count?: number;
  step_signal_dates?: string[];
}

export interface Detail {
  at: string;
  periods: Period[];
  reasons: Record<string, { title: string; content: string }[]>;
}

export type Tab = 'all' | 't0' | 'watch' | 'industry' | 'broad_index';
export const TABS: [Tab, string][] = [
  ['all', '全部'], ['t0', 'T+0'], ['watch', '自选'], ['industry', '行业板块'], ['broad_index', '宽基指数'],
];

export interface Filters {
  tab: Tab;
  retr: boolean;
  newPool: boolean;
  unique: boolean;
  entered: boolean;
  q: string;
}

export const DEFAULT_FILTERS: Filters = { tab: 'all', retr: false, newPool: false, unique: false, entered: false, q: '' };

export const securityCode = (thsCode: string): string => thsCode.split(':')[1] ?? thsCode;

/** 当前选择依赖、但这份快照没有采集到的标签（例如分类数据上线之前的快照）。 */
export function missingCats(day: Day, f: Filters): TagKey[] {
  const need: TagKey[] = [];
  if (f.tab === 't0' || f.tab === 'industry' || f.tab === 'broad_index') need.push(f.tab);
  if (f.retr) need.push('trend_retracement');
  if (f.newPool) need.push('new_pool');
  if (f.unique) need.push('unique_rep');
  return need.filter(k => !day.cats.includes(k));
}

/** 与来源一致：分类与各勾选项同时生效，取交集。prev 为上一份快照的代码集合，用于「较上次新进」。 */
export function filterRows(day: Day, f: Filters, watch: Set<string>, prev: Set<string> | null): Row[] {
  if (missingCats(day, f).length) return [];
  const q = f.q.trim().toLowerCase();
  return day.rows.filter(([code, name, flags]) => {
    if (f.tab === 'watch' && !watch.has(code)) return false;
    if ((f.tab === 't0' || f.tab === 'industry' || f.tab === 'broad_index') && !(flags & bit(f.tab))) return false;
    if (f.retr && !(flags & bit('trend_retracement'))) return false;
    if (f.newPool && !(flags & bit('new_pool'))) return false;
    if (f.unique && !(flags & bit('unique_rep'))) return false;
    if (f.entered && (!prev || prev.has(code))) return false;
    return !q || code.toLowerCase().includes(q) || name.toLowerCase().includes(q);
  });
}

/** 分类标签上的数字；该快照没有这一分类时返回 null。 */
export function tabCount(day: Day, tab: Tab, watch: Set<string>): number | null {
  if (tab === 'all') return day.rows.length;
  if (tab === 'watch') return day.rows.filter(r => watch.has(r[0])).length;
  if (!day.cats.includes(tab)) return null;
  return day.rows.filter(r => r[2] & bit(tab)).length;
}

export function latestPeriod(detail: Detail | undefined): Period | null {
  if (!detail?.periods?.length) return null;
  return detail.periods.reduce((a, b) => (b.start_day > a.start_day ? b : a));
}

export type SortKey = 'start' | 'dur' | 'rise' | 'steps';
export interface SortState { key: SortKey; dir: 'asc' | 'desc' }

/** 点击同一列：降序 → 升序 → 恢复接口原序。 */
export function nextSort(cur: SortState | null, key: SortKey): SortState | null {
  if (!cur || cur.key !== key) return { key, dir: 'desc' };
  return cur.dir === 'desc' ? { key, dir: 'asc' } : null;
}

function sortValue(p: Period | null, key: SortKey): string | number | null {
  if (!p) return null;
  const v = { start: p.start_day, dur: p.duration, rise: p.period_rise, steps: p.step_signal_count }[key];
  return v ?? null;
}

/** 稳定排序；没有区间数据的行始终排在最后。 */
export function sortRows(rows: Row[], sort: SortState | null, detail: Record<string, Detail>): Row[] {
  if (!sort) return rows;
  const m = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, v: sortValue(latestPeriod(detail[r[0]]), sort.key) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      return (a.v < b.v ? -1 : a.v > b.v ? 1 : 0) * m || a.i - b.i;
    })
    .map(x => x.r);
}

export function gridDetailHref(detailUrl: string, code: string, name: string): string {
  return `${detailUrl}?code=${encodeURIComponent(code)}&name=${encodeURIComponent(name || code)}`;
}
