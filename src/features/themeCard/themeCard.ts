/** 书第31章 31.12「一页纸未来产业研究卡」的字段与复核规则。卡片内容由使用者自己填，这里不预设任何产业判断。 */
export interface FieldDef {
  key: string
  label: string
  hint: string
}

export const FIELDS: FieldDef[] = [
  { key: 'stage', label: '产业与技术阶段', hint: '实验室、样机、小批量还是规模量产？写日期，写依据（31.3 问题1）' },
  { key: 'cost', label: '成本曲线位置', hint: '成本是否随累计产量下降，离不靠补贴也成立还有多远（问题2）' },
  { key: 'penetration', label: '渗透率阶段', hint: '谁是第一批付费客户，S 曲线处于早期、拐点还是成熟期（问题3）' },
  { key: 'profitPool', label: '利润池与公司所处环节', hint: '算力、材料、设备、平台、应用，谁真正赚钱，你研究的公司在哪一环（问题4）' },
  { key: 'economics', label: '一笔经济性的账', hint: '回收期或收入门槛，写明假设；教学假设不是真实数据' },
  { key: 'indicator', label: '关键验证指标与时间窗', hint: '从哪类公开资料查、多久查一次（行业协会月报、定期报告、监管文件）' },
  { key: 'policy', label: '政策与地缘风险', hint: '准入、补贴退坡、出口管制与标准；政策是变量，不是长期回报的唯一理由（问题5）' },
  { key: 'scenarios', label: '十年后的三个情景', hint: '公司份额与利润率的乐观、基准、悲观，各写一句依据（问题6）' },
  { key: 'priced', label: '估值隐含的预期', hint: '当前价格已经反映了什么，需要什么增速才能回本' },
  { key: 'evidence', label: '加分证据、减分证据', hint: '都要能追到公开原文，券商预测不能当事实' },
  { key: 'falsify', label: '证伪条件', hint: '出现什么情况，说明这个判断不成立' },
]

export interface ThemeCard {
  id: string
  name: string
  /** 仓位上限，占总资产百分比；空字符串表示还没定 */
  cap: string
  /** 上次复核日期 YYYY-MM-DD；空字符串表示还没复核 */
  reviewed: string
  values: Record<string, string>
}

export const REVIEW_DAYS = 365

export function emptyCard(id: string, name: string): ThemeCard {
  return { id, name, cap: '', reviewed: '', values: {} }
}

export function filledCount(card: ThemeCard): number {
  return FIELDS.filter(f => (card.values[f.key] || '').trim()).length
}

export function daysSince(date: string, today: Date): number | null {
  const t = Date.parse(date + 'T00:00:00')
  if (Number.isNaN(t)) return null
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.floor((start - t) / 86400000)
}

/** 返回这张卡当前该提醒的问题，空数组表示没有。 */
export function cardWarnings(card: ThemeCard, today: Date): string[] {
  const out: string[] = []
  if (!(card.values.falsify || '').trim()) out.push('还没写证伪条件：没有证伪条件的判断，等于没有判断。')
  const cap = Number(card.cap)
  if (!card.cap.trim() || !(cap > 0)) out.push('还没定仓位上限。')
  else if (cap > 100) out.push('仓位上限不能超过 100%。')
  if (!card.reviewed) out.push('还没有复核日期。')
  else {
    const d = daysSince(card.reviewed, today)
    if (d === null) out.push('复核日期格式不对。')
    else if (d < 0) out.push('复核日期在未来，请检查。')
    else if (d > REVIEW_DAYS) out.push(`距上次复核已 ${d} 天，超过一年，判断可能已过期，需要重新复核。`)
  }
  return out
}

/** 主题卡的仓位上限合计，超过主动额度时提示（书第9章：主题只放主动额度）。 */
export function capTotal(cards: ThemeCard[]): number {
  return cards.reduce((s, c) => s + (Number(c.cap) > 0 ? Number(c.cap) : 0), 0)
}

export const SUGGESTED = ['固态电池', '半导体', '人形机器人与具身智能', '低空经济与eVTOL', '商业航天', '创新药与合成生物', '新型储能与电网升级', '量子计算', '脑机接口']
