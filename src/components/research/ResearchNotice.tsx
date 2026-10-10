import React from 'react'
import { Link } from 'react-router-dom'

/**
 * 研究页的固定说明：评级与条件价格是作者按规则算出的研究假设，不是买卖建议。
 * 和书的立场一致（不荐股；盈亏比没计入概率与时间），公司库与公司详情页共用。
 */
export default function ResearchNotice(): JSX.Element {
  return (
    <p role="note" className="section-archived" style={{ margin: '0 0 16px' }}>
      这里是作者的个人研究笔记，不是买卖建议。评级与条件价格由统一规则或研究假设算出：盈亏比只比较情景价差，没有计入各情景发生的概率和兑现所需的时间，数据口径和核验状态见各页说明。是否研究、何时买卖，请按书里的方法自己做决策记录（<Link to="/first-book/read/第37章-犯错与复盘.md">第37章 37.4</Link>）。
    </p>
  )
}
