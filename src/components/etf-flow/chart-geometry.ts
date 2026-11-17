// EtfFlowChart 的纯几何助手：与 React/DOM 无关，便于单测。

/** 数组极值 [min,max]；空数组回退 [0,1]。 */
export function extent(values: number[]): [number, number] {
  if (!values.length) return [0, 1]
  let mn = values[0]
  let mx = values[0]
  for (const v of values) {
    if (v < mn) mn = v
    if (v > mx) mx = v
  }
  return [mn, mx]
}

/** 把窗口 [s,e] 夹到 [0,n-1]，保证 s<=e 且至少 minSpan 个点。 */
export function clampWindow(s: number, e: number, n: number, minSpan = 5): [number, number] {
  const last = Math.max(0, n - 1)
  let a = Math.max(0, Math.min(Math.round(s), last))
  let b = Math.max(0, Math.min(Math.round(e), last))
  if (a > b) [a, b] = [b, a]
  const span = Math.min(minSpan, n) - 1
  if (b - a < span) {
    b = Math.min(last, a + span)
    a = Math.max(0, b - span)
  }
  return [a, b]
}

/** 绘图区内的相对位置 frac(0..1) → 最近的数据索引 [0,n-1]。 */
export function fracToIndex(frac: number, n: number): number {
  if (n <= 1) return 0
  return Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))))
}

/** 指针 clientX + svg 外框 rect → 绘图区数据索引。viewW 为 viewBox 宽。 */
export function pointerToIndex(
  clientX: number,
  rect: { left: number; width: number },
  viewW: number,
  padL: number,
  plotW: number,
  n: number,
): number {
  if (!rect.width) return 0
  const sx = ((clientX - rect.left) / rect.width) * viewW
  return fracToIndex((sx - padL) / plotW, n)
}
