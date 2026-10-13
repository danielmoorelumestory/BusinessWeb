import { SIGNALS, signalTone, type Stage } from './stages'

const fmt = (n: number): string => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, ''))

/** 自动解读：哪几项越线、哪几项离预警线还有多远。只描述读数与阈值的关系，不预测。 */
export function signalReadout(values: Record<string, number>, stage: Stage): { headline: string; lines: string[] } {
  const known = SIGNALS.filter(s => Number.isFinite(values[s.id]))
  const over = known.filter(s => signalTone(s, values[s.id]) !== 'green')
  const missing = SIGNALS.length - known.length
  const lines = known.map(s => {
    const v = values[s.id]
    const unit = s.unit && s.unit !== 'pp' ? ` ${s.unit}` : ''
    const tone = signalTone(s, v)
    if (tone === 'red') return `${s.name}：${fmt(v)}${unit}，已越过危险线 ${s.red}`
    if (tone === 'yellow') return `${s.name}：${fmt(v)}${unit}，已越过预警线 ${s.yellow}，距危险线还差 ${fmt(s.red - v)}${unit}`
    return `${s.name}：${fmt(v)}${unit}，正常，距预警线还差 ${fmt(s.yellow - v)}${unit}`
  })
  const headline = known.length < 3
    ? '可用读数不足 3 项，暂不下结论。'
    : over.length === 0
      ? `${known.length} 项信号全部正常，阶段「${stage.name}」。`
      : `${known.length} 项信号中 ${over.length} 项越线（${over.map(s => s.name).join('、')}），阶段「${stage.name}」。`
  return { headline: missing ? `${headline}另有 ${missing} 项暂缺。` : headline, lines }
}
