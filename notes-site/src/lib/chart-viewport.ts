// 日K图的显示窗口（按日线下标，首尾都包含）：缩放与平移的纯计算，供详情页拖动、双指、滚轮和按钮共用。

export type Viewport = { start: number; end: number };

/** 最少显示的日线根数，避免放大到只剩几根看不出形态。 */
export const MIN_VIEW_BARS = 20;

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/**
 * 以 anchor（0 = 窗口最左，1 = 最右）处的日线为不动点缩放。factor > 1 显示更多日线（缩小），< 1 显示更少（放大）。
 * 结果夹在 [0, total-1] 内，根数不少于 MIN_VIEW_BARS（总数不足时显示全部）。
 */
export function zoomViewport(total: number, view: Viewport, factor: number, anchor = .5, minBars = MIN_VIEW_BARS): Viewport {
  if (total <= 0) return { start: 0, end: -1 };
  const length = view.end - view.start + 1;
  const next = clamp(Math.round(length * factor), Math.min(minBars, total), total);
  const ratio = clamp(anchor, 0, 1), pivot = view.start + ratio * (length - 1);
  const start = clamp(Math.round(pivot - ratio * (next - 1)), 0, total - next);
  return { start, end: start + next - 1 };
}

/** 平移 delta 根日线（正数向右，看更新的日期），窗口长度不变，到头为止。 */
export function panViewport(total: number, view: Viewport, delta: number): Viewport {
  if (total <= 0) return { start: 0, end: -1 };
  const length = Math.min(view.end - view.start + 1, total);
  const start = clamp(view.start + Math.round(delta), 0, total - length);
  return { start, end: start + length - 1 };
}
