import React from 'react'
import snapshot from '../data/etfTechnical.json'
import { describeMa } from '../utils/etfMaDescription'
import { tone, macdDescription, rsiDescription, type Period } from '../utils/etfTechnicalDescription'

type RecordState = { applicable: boolean; reason?: string; day?: Period; week?: Period; month?: Period }
const records = snapshot.records as Record<string, RecordState>
const periods = [['day', '日线'], ['week', '周线'], ['month', '月线']] as const
const fmt = (value: number | null, digits = 3) => value === null ? '—' : value.toFixed(digits)

export function EtfTechnicalColumns(): JSX.Element {
  return <>{periods.map(([key]) => <col key={key} style={{ width: '230px' }} />)}</>
}
export function EtfTechnicalHeaders(): JSX.Element {
  return <>{periods.map(([key, name]) => <th key={key} className="etf-technical-heading" title={`${name}独立计算 MA5/10/20、MACD(12,26,9)、RSI(14)；截至${snapshot.asOf}${key === 'month' ? '，本月未收盘' : ''}`}>{name}</th>)}</>
}
export default function EtfTechnicalCells({ code }: { code: string }): JSX.Element {
  const record = records[code]
  if (!record || !record.applicable) return <td colSpan={3} className="etf-technical-cell etf-technical-unavailable" title={record?.reason ?? '尚无指标数据'}>{record ? '不适用' : '—'}</td>
  return <>{periods.map(([key, name]) => {
    const state = record[key]
    if (!state) return <td key={key} className="etf-technical-cell">—</td>
    const dateHint = `${name} · ${state.asOf} · ${state.count}期${state.complete ? ' · 已收盘' : ' · 未收盘暂态'}`
    return <td key={key} className="etf-technical-cell" title={dateHint}>
      <div className="etf-technical-lines">
        <div title={`${dateHint}；MA5/10/20：${fmt(state.ma5)}/${fmt(state.ma10)}/${fmt(state.ma20)}；排列分别比较MA5、MA10、MA20的高低，另列价格相对三条均线的位置；不据此认定发生突破`}><span>MA</span><strong className={`etf-signal--${tone(state.ma)}`}>{describeMa(state)}</strong></div>
        <div title={`${dateHint}；DIF ${fmt(state.dif, 5)} / DEA ${fmt(state.dea, 5)}；${state.limitedMacdHistory ? '样本少于60期，初始化影响较大，仅作辅助' : '金叉/死叉仅标记本期新交叉，其余按DIF与DEA关系显示'}${state.macd === '不足' ? '；不足26期，暂不计算' : ''}`}><span>MACD</span><strong className={`etf-signal--${tone(state.macd)}`}>{macdDescription(state)}</strong></div>
        <div title={`${dateHint}；Wilder RSI(14) ${fmt(state.rsi, 2)}；≤30超卖，≥70超买，30至50偏弱，50至70偏强；不足15期不计算`}><span>RSI</span><strong className={`etf-signal--${tone(state.rsi !== null && state.rsi >= 45 && state.rsi <= 55 ? '中性' : state.rsiState)}`}>{rsiDescription(state)}</strong></div>
      </div>
      {(!state.complete || state.limitedMacdHistory) && <small className="etf-technical-context">{[!state.complete && '未收盘暂态', state.limitedMacdHistory && 'MACD样本较短'].filter(Boolean).join(' · ')}</small>}
    </td>
  })}</>
}
