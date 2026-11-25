import { href } from './url';

/**
 * 申赎篮子宽度 B20 / B55 / B120：只读 scripts/grid_b20.py 生成的静态快照（notes-site/public/data/grid-b20/{code}.json），
 * 浏览器不请求 PCF 或个股行情。只有经过核验的代码才列在这里；其他 ETF 不显示。
 * 快照 v2 含三个周期（series.{20,55,120}）；v1 旧快照只有 B20，按 B20 读入（兼容迁移期间的缓存）。
 */
export const B20_SNAPSHOTS: Readonly<Record<string, string>> = { '159593': 'data/grid-b20/159593.json' };

export const B_WINDOWS = [20, 55, 120] as const;
export type BWindow = typeof B_WINDOWS[number];
/** 每个周期的线型：颜色 + 虚线样式同时区分，色弱也能分辨。 */
export const B_STYLE: Readonly<Record<BWindow, { color: string; dash: string; width: number }>> = {
  20: { color: '#0d9488', dash: '', width: 1.6 },
  55: { color: '#2563eb', dash: '6 3', width: 1.4 },
  120: { color: '#c2410c', dash: '2 2', width: 1.4 },
};

export type B20Reason = 'pcf' | 'coverage' | 'warmup' | 'lm_late' | 'lm_missing';
export type B20Point = { date: string; value: number | null; above: number | null; valid: number | null; total: number | null; reason: B20Reason | null; detail: string | null };
export type B20Summary = { days: number; value: number; coverage: number; pcf: number; lm_late: number; lm_missing: number; warmup: number; firstValid: string | null; lastValid: string | null; warmupFrom: string | null; warmupTo: string | null };
export type B20Period = { summary: B20Summary; points: Map<string, B20Point> };
export type B20Series = {
  code: string;
  through: string;
  generatedAt: string;
  /** 已取历史（A 股交易日历）的起点；v1 旧快照没有该字段。 */
  calendarFrom: string | null;
  reasons: Record<string, string>;
  summary: { days: number; members: number; baskets: number };
  periods: Map<BWindow, B20Period>;
};

const FIELDS = ['date', 'value', 'above', 'valid', 'total', 'reason', 'detail'];
const REASONS = new Set(['pcf', 'coverage', 'warmup', 'lm_late', 'lm_missing']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const count = (value: unknown) => value === null || (Number.isInteger(value) && (value as number) >= 0);

function parseRows(rows: unknown, through: string, label: string): Map<string, B20Point> {
  if (!Array.isArray(rows)) throw new Error(`${label} 快照字段异常`);
  const points = new Map<string, B20Point>();
  let previous = '';
  for (const row of rows as unknown[][]) {
    const [date, value, above, valid, total, reason, detail] = row;
    if (typeof date !== 'string' || !DATE.test(date) || date <= previous || date > through) throw new Error(`${label} 快照日期异常`);
    if (!count(above) || !count(valid) || !count(total)) throw new Error(`${label} 快照计数异常：${date}`);
    if (reason !== null && !REASONS.has(reason as string)) throw new Error(`${label} 快照原因异常：${date}`);
    if (value !== null) {
      // 有值时必须等于 站上数 ÷ 有效数，且覆盖率 ≥ 95%
      if (typeof value !== 'number' || reason !== null || !valid || !total || (above as number) > (valid as number) || (valid as number) > (total as number)) throw new Error(`${label} 快照数值异常：${date}`);
      if (Math.abs(value - (above as number) / (valid as number)) > 1e-6 || (valid as number) / (total as number) < .95) throw new Error(`${label} 快照数值与计数不符：${date}`);
    } else if (reason === null) throw new Error(`${label} 快照缺少原因：${date}`);
    points.set(date, { date, value: value as number | null, above: above as number | null, valid: valid as number | null, total: total as number | null, reason: reason as B20Reason | null, detail: typeof detail === 'string' ? detail : null });
    previous = date;
  }
  return points;
}

const summaryOf = (raw: unknown): B20Summary => {
  const s = (raw ?? {}) as Partial<B20Summary>;
  return { days: s.days ?? 0, value: s.value ?? 0, coverage: s.coverage ?? 0, pcf: s.pcf ?? 0, lm_late: s.lm_late ?? 0, lm_missing: s.lm_missing ?? 0, warmup: s.warmup ?? 0,
    firstValid: s.firstValid ?? null, lastValid: s.lastValid ?? null, warmupFrom: s.warmupFrom ?? null, warmupTo: s.warmupTo ?? null };
};

/** 校验快照结构；任何一行不合规就整体拒绝（不显示比显示错数好）。 */
export function parseB20Snapshot(payload: unknown, code: string): B20Series {
  const data = payload as Record<string, unknown> | null;
  if (!data || (data.version !== 1 && data.version !== 2) || data.code !== code) throw new Error('B20 快照与代码不符');
  if (JSON.stringify(data.fields) !== JSON.stringify(FIELDS)) throw new Error('B20 快照字段异常');
  const through = String(data.through ?? '');
  if (!DATE.test(through)) throw new Error('B20 快照缺少截止日');
  const periods = new Map<BWindow, B20Period>();
  let summary: B20Series['summary'];
  if (data.version === 1) {
    const s = (data.summary ?? {}) as Record<string, number>;
    periods.set(20, { summary: summaryOf(s), points: parseRows(data.rows, through, 'B20') });
    summary = { days: s.days ?? 0, members: s.members ?? 0, baskets: s.baskets ?? 0 };
  } else {
    const windows = data.windows as unknown[];
    const series = (data.series ?? {}) as Record<string, { summary?: unknown; rows?: unknown }>;
    if (!Array.isArray(windows) || !windows.includes(20) || windows.some(n => !(B_WINDOWS as readonly unknown[]).includes(n))) throw new Error('B20 快照周期异常');
    for (const n of windows as BWindow[]) {
      if (!series[n]) throw new Error(`B${n} 快照缺失`);
      periods.set(n, { summary: summaryOf(series[n].summary), points: parseRows(series[n].rows, through, `B${n}`) });
    }
    summary = data.summary as B20Series['summary'];
  }
  return { code, through, generatedAt: String(data.generatedAt ?? ''), calendarFrom: typeof data.calendarFrom === 'string' ? data.calendarFrom : null,
    reasons: (data.reasons ?? {}) as Record<string, string>, summary, periods };
}

export async function fetchB20(code: string): Promise<B20Series> {
  const path = B20_SNAPSHOTS[code];
  if (!path) throw new Error('该标的没有已核验的申赎篮子宽度');
  const response = await fetch(href(path), { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseB20Snapshot(await response.json(), code);
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/** 一个周期在某日的悬浮文字：百分比 + 站上 / 有效 / 篮子，或缺失原因（预热 / 覆盖 / PCF / Last-Modified 分开写）。控制在手机悬浮框宽度内。 */
export function bWindowLine(series: B20Series, n: BWindow, date: string): string {
  const tag = `B${n}`, period = series.periods.get(n);
  if (!period) return `${tag} 缺失 · 快照无此周期`;
  const point = period.points.get(date);
  if (!point) return date > series.through ? `${tag} 缺失 · 收盘后更新（快照截至 ${series.through}）` : `${tag} 缺失 · 当日无记录`;
  if (point.value !== null) return `${tag} ${pct(point.value)} · 站上 ${point.above} / 有效 ${point.valid} / 篮子 ${point.total}`;
  switch (point.reason) {
    case 'coverage': return `${tag} 缺失 · 覆盖不足 有效 ${point.valid} / 篮子 ${point.total}`;
    case 'warmup': return `${tag} 缺失 · 预热不足（需前 ${n} 日）`;
    case 'pcf': return `${tag} 缺失 · 当日 PCF 缺失（404）`;
    case 'lm_late': return `${tag} 缺失 · Last-Modified 晚于 09:00:00`;
    case 'lm_missing': return `${tag} 缺失 · PCF 缺 Last-Modified`;
    default: return `${tag} 缺失`;
  }
}

/** 悬浮补充行：各周期未计入有效数的成员数（缺 K 线或复权未核实）；都齐全时为空。 */
export function bNoteLine(series: B20Series, windows: readonly BWindow[], date: string): string {
  const parts = windows.flatMap(n => {
    const point = series.periods.get(n)?.points.get(date);
    if (!point || point.valid === null || point.total === null || point.total === point.valid) return [];
    return [`B${n} ${point.total - point.valid}`];
  });
  return parts.length ? `未计入成员 ${parts.join(' · ')}（缺K线或复权未核实）` : '';
}
