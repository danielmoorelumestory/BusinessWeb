import { href } from './url';

/**
 * B20 申赎篮子宽度：只读 scripts/grid_b20.py 生成的静态快照（notes-site/public/data/grid-b20/{code}.json），
 * 浏览器不请求 PCF 或个股行情。只有经过核验的代码才列在这里；其他 ETF 不显示 B20。
 */
export const B20_SNAPSHOTS: Readonly<Record<string, string>> = { '159593': 'data/grid-b20/159593.json' };

export type B20Reason = 'pcf' | 'coverage' | 'lm_late' | 'lm_missing';
export type B20Point = { date: string; value: number | null; above: number | null; valid: number | null; total: number | null; reason: B20Reason | null; detail: string | null };
export type B20Series = {
  code: string;
  through: string;
  generatedAt: string;
  reasons: Record<string, string>;
  summary: { days: number; value: number; firstValid: string | null; lastValid: string | null; coverage: number; pcf: number; lm_late: number; lm_missing: number; members: number; baskets: number };
  points: Map<string, B20Point>;
};

const FIELDS = ['date', 'value', 'above', 'valid', 'total', 'reason', 'detail'];
const REASONS = new Set(['pcf', 'coverage', 'lm_late', 'lm_missing']);
const count = (value: unknown) => value === null || (Number.isInteger(value) && (value as number) >= 0);

/** 校验快照结构；任何一行不合规就整体拒绝（不显示比显示错数好）。 */
export function parseB20Snapshot(payload: unknown, code: string): B20Series {
  const data = payload as Record<string, unknown> | null;
  if (!data || data.version !== 1 || data.code !== code) throw new Error('B20 快照与代码不符');
  if (JSON.stringify(data.fields) !== JSON.stringify(FIELDS) || !Array.isArray(data.rows)) throw new Error('B20 快照字段异常');
  const through = String(data.through ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error('B20 快照缺少截止日');
  const points = new Map<string, B20Point>();
  let previous = '';
  for (const row of data.rows as unknown[][]) {
    const [date, value, above, valid, total, reason, detail] = row;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= previous || date > through) throw new Error('B20 快照日期异常');
    if (!count(above) || !count(valid) || !count(total)) throw new Error(`B20 快照计数异常：${date}`);
    if (reason !== null && !REASONS.has(reason as string)) throw new Error(`B20 快照原因异常：${date}`);
    if (value !== null) {
      // 有值时必须等于 站上数 ÷ 有效数，且覆盖率 ≥ 95%
      if (typeof value !== 'number' || reason !== null || !valid || !total || (above as number) > (valid as number) || (valid as number) > (total as number)) throw new Error(`B20 快照数值异常：${date}`);
      if (Math.abs(value - (above as number) / (valid as number)) > 1e-6 || (valid as number) / (total as number) < .95) throw new Error(`B20 快照数值与计数不符：${date}`);
    } else if (reason === null) throw new Error(`B20 快照缺少原因：${date}`);
    points.set(date, { date, value: value as number | null, above: above as number | null, valid: valid as number | null, total: total as number | null, reason: reason as B20Reason | null, detail: typeof detail === 'string' ? detail : null });
    previous = date;
  }
  return { code, through, generatedAt: String(data.generatedAt ?? ''), reasons: (data.reasons ?? {}) as Record<string, string>, summary: data.summary as B20Series['summary'], points };
}

export async function fetchB20(code: string): Promise<B20Series> {
  const path = B20_SNAPSHOTS[code];
  if (!path) throw new Error('该标的没有已核验的 B20');
  const response = await fetch(href(path), { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseB20Snapshot(await response.json(), code);
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const SHORT: Record<B20Reason, string> = {
  pcf: '当日 PCF 缺失（404）',
  coverage: '有效成员不足篮子 95%',
  lm_late: 'Last-Modified 晚于 09:00:00（严格版留空）',
  lm_missing: 'PCF 缺 Last-Modified',
};

/** 悬浮三行：① 百分比或缺失原因 ② 站上 / 有效 / 篮子总数 ③ 未知成员明细或 PCF 问题。每行都控制在手机悬浮框宽度内。 */
export function b20TipLines(series: B20Series, date: string): [string, string, string] {
  const point = series.points.get(date);
  if (!point) return date > series.through ? ['B20 缺失 · 收盘后更新', `快照截至 ${series.through}`, ''] : ['B20 缺失 · 当日无记录', '', ''];
  const head = point.value !== null ? `B20 申赎篮子宽度 ${pct(point.value)}（收盘）` : `B20 缺失 · ${point.reason ? SHORT[point.reason] : '无记录'}`;
  const counts = point.total === null ? '' : `站上 ${point.above} / 有效 ${point.valid} / 篮子 ${point.total}`;
  return [head, counts, point.detail ?? ''];
}
