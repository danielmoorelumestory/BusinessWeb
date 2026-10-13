/** 元 → 「x.x 亿」/「x.xx 万亿」 */
export function formatYuan(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const yi = v / 1e8
  if (Math.abs(yi) >= 10000) return `${(yi / 10000).toFixed(2)} 万亿`
  if (Math.abs(yi) >= 100) return `${Math.round(yi).toLocaleString('zh-CN')} 亿`
  if (Math.abs(yi) >= 1) return `${yi.toFixed(1)} 亿`
  return `${(v / 1e4).toFixed(0)} 万`
}

/** 股 → 「x.xx 亿股」/「x 万股」 */
export function formatShares(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)} 亿股`
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)} 万股`
  return `${Math.round(v)} 股`
}

export function formatPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${v.toFixed(digits)}%`
}

/** 变化率：(cur-prev)/prev；prev 缺失或为 0 时返回 null */
export function changeRate(cur: number, prev: number | null | undefined): number | null {
  if (prev === null || prev === undefined || !prev) return null
  return (cur - prev) / prev
}

export function formatChange(rate: number | null): string {
  if (rate === null) return '—'
  const p = rate * 100
  return `${p > 0 ? '+' : ''}${p.toFixed(Math.abs(p) >= 100 ? 0 : 1)}%`
}

/** A 股习惯：增加为红、减少为绿 */
export function changeTone(rate: number | null): 'up' | 'down' | 'flat' {
  if (rate === null || Math.abs(rate) < 0.0005) return 'flat'
  return rate > 0 ? 'up' : 'down'
}

export function shortPeriod(end: string): string {
  const [y, m] = end.split('-')
  const q = { '03': 'Q1', '06': 'H1', '09': 'Q3', '12': '年报' }[m] ?? m
  return `${y.slice(2)}${q}`
}
