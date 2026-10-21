type MaPosition = { close: number; ma5: number | null; ma10: number | null; ma20: number | null }

export type MaSignal = 'up' | 'down' | 'neutral'
export type MaSegment = { text: string; signal: MaSignal }

const sign = (value: number) => Math.abs(value) <= 1e-10 ? 0 : value > 0 ? 1 : -1

/** 股价与 MA5/MA10 从大到小的 6 种顺序（如「价格 > MA5 > MA10」）；任意两者相等时为「均线粘合」。颜色按强弱：价格在两线上方红、下方绿、介于两线之间灰。 */
function arrangement(close: number, ma5: number, ma10: number): MaSegment {
  if (!sign(close - ma5) || !sign(close - ma10) || !sign(ma5 - ma10)) return { text: '均线粘合', signal: 'neutral' }
  const order = [['价格', close], ['MA5', ma5], ['MA10', ma10]] as const
  const text = [...order].sort((a, b) => b[1] - a[1]).map(([name]) => name).join(' > ')
  const rank = (name: string) => [...order].sort((a, b) => b[1] - a[1]).findIndex(([item]) => item === name)
  return { text, signal: rank('价格') === 0 ? 'up' : rank('价格') === 2 ? 'down' : 'neutral' }
}

const slope = (name: string, dir: number): MaSegment =>
  ({ text: `${name}${dir > 0 ? '↑' : dir < 0 ? '↓' : '→'}`, signal: dir > 0 ? 'up' : dir < 0 ? 'down' : 'neutral' })

/**
 * 日线 MA 状态分三段：股价与 MA5/MA10 的大小顺序、MA5 自身方向、MA10 自身方向；各段单独着色。
 * description 为三段拼接的纯文本，signal 由股价相对 MA10 决定（供只需单色的调用方使用）。
 */
export function describeDailyMaEvents(bars: { date: string; close: number }[]): { description: string; signal: MaSignal; segments: MaSegment[] } {
  if (bars.length < 11) return { description: '历史不足，暂不判断', signal: 'neutral', segments: [{ text: '历史不足，暂不判断', signal: 'neutral' }] }
  const average = (period: number) => bars.slice(-period).reduce((sum, bar) => sum + bar.close, 0) / period
  const close = bars[bars.length - 1].close, ma10 = average(10)
  // 均线本日变化 =（本日收盘价 − 移出窗口的收盘价）÷ 周期。
  const segments = [arrangement(close, average(5), ma10), slope('MA5', sign(close - bars[bars.length - 6].close)), slope('MA10', sign(close - bars[bars.length - 11].close))]
  return { description: segments.map(segment => segment.text).join('、'), signal: sign(close - ma10) > 0 ? 'up' : sign(close - ma10) < 0 ? 'down' : 'neutral', segments }
}

/**
 * 旧快照只存了单色文案（如「MA5上10下、M5回升10回落」）：排列名由快照里的收盘价与 MA5/MA10 重算，
 * 两条均线的方向从旧文案解析；解析不出时返回 null，由调用方沿用旧文案。
 */
export function upgradeLegacyMaSegments(description: string, { close, ma5, ma10 }: { close: number; ma5: number | null; ma10: number | null }): MaSegment[] | null {
  const match = /M5(回升|回落|走平)10(回升|回落|走平)/.exec(description)
  if (!match || ma5 === null || ma10 === null) return null
  const dir = (text: string) => text === '回升' ? 1 : text === '回落' ? -1 : 0
  return [arrangement(close, ma5, ma10), slope('MA5', dir(match[1])), slope('MA10', dir(match[2]))]
}

/** Describe observed positions, without implying a crossover that has not been checked. */
export function describeMa({ close, ma5, ma10, ma20 }: MaPosition): string {
  if (ma5 === null || ma10 === null || ma20 === null) return '历史不足，暂不判断'
  const lines = [[5, ma5], [10, ma10], [20, ma20]] as const
  const above = lines.filter(([, value]) => close - value > 1e-10).map(([period]) => period)
  const below = lines.filter(([, value]) => value - close > 1e-10).map(([period]) => period)
  const near = lines.filter(([, value]) => Math.abs(value - close) <= 1e-10).map(([period]) => period)
  const alignment = ma5 > ma10 && ma10 > ma20 ? '多头排列' : ma5 < ma10 && ma10 < ma20 ? '空头排列'
    : Math.max(ma5, ma10, ma20) - Math.min(ma5, ma10, ma20) <= 1e-10 ? '三线重合' : '均线交错'
  if (above.length === 3) return `站上全部均线，${alignment}`
  if (below.length === 3) return `低于全部均线，${alignment}`
  if (near.length === 3) return '贴近全部均线，三线重合'
  const position = [above.length && `高于MA${above.join('/')}`, below.length && `低于MA${below.join('/')}`, near.length && `贴近MA${near.join('/')}`].filter(Boolean).join('，')
  return `${alignment}；${position}`
}
