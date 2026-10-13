import React from 'react'

export default function EtfTrendRemark({ remark }: { remark: string }): JSX.Element {
  // 只给开头的趋势结论着色，正文中提及的产业增长或风险保持普通文字。
  const end = remark.indexOf('。')
  const summary = end < 0 ? remark : remark.slice(0, end)
  const rest = end < 0 ? '' : remark.slice(end)
  const parts = summary.split(/(上升趋势|下降趋势|震荡偏强|震荡偏弱)/)
  return <>{parts.map((part, index) => {
    const direction = part === '上升趋势' ? 'up'
      : part === '下降趋势' ? 'down'
        : part.startsWith('震荡') ? 'sideways' : null
    return direction
      ? <span key={index} className={`etf-trend etf-trend--${direction}`}>{part}</span>
      : <React.Fragment key={index}>{part}</React.Fragment>
  })}{rest}</>
}
