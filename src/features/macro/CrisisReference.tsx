import React from 'react'
import type { Indicator, SeriesData } from './indicators'
import { ARCHIVED_US_CRISES, type ArchivedCrisis } from './crisisHistory'

type CrisisEvent = { event: string; phase: string; month: string; archive?: ArchivedCrisis['archive'] }
// 1997 年起取页面同一份月度历史，早期事件单独取已核对的档案口径。
const US_EVENTS: CrisisEvent[] = [
  ...ARCHIVED_US_CRISES,
  { event: '亚洲金融危机', phase: '全球股市受冲击当月', month: '1997-10' },
  { event: '俄罗斯违约／LTCM 危机', phase: '俄罗斯违约当月', month: '1998-08' },
  { event: '俄罗斯违约／LTCM 危机', phase: 'LTCM 救助当月', month: '1998-09' },
  { event: '互联网泡沫', phase: '泡沫高位附近', month: '2000-03' },
  { event: '互联网泡沫', phase: '熊市后期', month: '2002-10' },
  { event: '金融危机', phase: '股市高位附近', month: '2007-10' },
  { event: '金融危机', phase: '雷曼破产当月', month: '2008-09' },
  { event: '金融危机', phase: '熊市低位附近', month: '2009-03' },
  { event: '疫情冲击', phase: '暴跌启动当月', month: '2020-02' },
  { event: '疫情冲击', phase: '恐慌下跌当月', month: '2020-03' },
  { event: '2022 年加息熊市', phase: '此前杠杆高位附近', month: '2021-11' },
  { event: '2022 年加息熊市', phase: '熊市低位附近', month: '2022-10' },
]
const CN_EVENTS: CrisisEvent[] = [
  { event: '2015 年去杠杆', phase: '见顶与下跌启动当月', month: '2015-06' },
  { event: '2015 年去杠杆', phase: '大跌之后', month: '2015-09' },
  { event: '2016 年熔断', phase: '熔断当月', month: '2016-01' },
  { event: '2018 年熊市', phase: '年初高位附近', month: '2018-01' },
  { event: '2018 年熊市', phase: '年内大跌阶段', month: '2018-10' },
  { event: '疫情冲击', phase: '春节后下跌当月', month: '2020-02' },
  { event: '疫情冲击', phase: '全球恐慌当月', month: '2020-03' },
  { event: '2024 年初下跌', phase: '下跌阶段', month: '2024-01' },
  { event: '2024 年初下跌', phase: '探底与反弹当月', month: '2024-02' },
]

export default function CrisisReference({ ind, d }: { ind: Indicator<string>; d: SeriesData }): JSX.Element | null {
  const us = ind.module === 'leverage' && ['marginGdp', 'cashDebt'].includes(ind.key)
  const cn = ind.module === 'cn-leverage' && ['marginGdp', 'marginMcap'].includes(ind.key)
  if (!us && !cn) return null
  const events = us ? US_EVENTS : CN_EVENTS
  const valueByMonth = new Map(d.long?.map(([date, value]) => [date.slice(0, 7), value]))
  const format = (value: number | undefined): string => value === undefined || !Number.isFinite(value) ? '暂无该月数据' : `${value.toFixed(ind.digits)}${d.unit}`
  return (
    <section className="macro-crisis" aria-label={`${ind.name}典型危机参考`}>
      <h4>典型股市危机 · 历史参考</h4>
      <p className="macro-muted">对照高位附近与下跌阶段。以下均为月末读数，不是危机当天值，也不是期间最高或最低值。{us && '1997 年以前补用美联储档案：NYSE 旧口径仅作近似参照，1929 年另列经纪商借款金额。'}</p>
      <div className="macro-table-wrap">
        <table className="macro-table" aria-label={`${ind.name}危机参考读数`}>
          <thead><tr><th>事件与阶段</th><th>参考月份</th><th>{ind.name}</th>{us && <th>数据口径与出处</th>}</tr></thead>
          <tbody>
            <tr className="macro-crisis__current"><th scope="row">当前读数</th><td className="macro-num">{d.latest.date.slice(0, 7)}</td><td className="macro-num"><b>{format(d.latest.value)}</b></td>{us && <td>FINRA</td>}</tr>
            {events.map(e => {
              const a = e.archive
              // 档案的分子与分母必须来自同一个月；1929 年的借款不能冒充这两项比例。
              const value = a ? (a.kind === 'customer'
                ? (ind.key === 'marginGdp' ? a.debt / 1000 / a.gdp * 100 : (a.cash + a.marginCash) / a.debt * 100)
                : undefined) : valueByMonth.get(e.month)
              return <tr key={e.month}>
                <th scope="row">{e.event}<div className="macro-muted">{e.phase}</div></th>
                <td className="macro-num">{e.month}</td>
                <td>
                  <span className="macro-num">{a?.kind === 'broker' ? '无可比比例' : format(value)}</span>
                  {a && <div className="macro-muted">{a.kind === 'broker'
                    ? `经纪商抵押借款 ${(a.borrowing / 100).toFixed(2)} 亿美元（历史代理）`
                    : ind.key === 'marginGdp'
                      ? `券商融资 ${(a.debt / 100).toFixed(2)} 亿美元 ÷ ${a.gdpQuarter} 名义 GDP ${(a.gdp / 1000).toFixed(2)} 万亿美元`
                      : `自由现金余额 ${((a.cash + a.marginCash) / 100).toFixed(2)} 亿美元 ÷ 券商融资 ${(a.debt / 100).toFixed(2)} 亿美元`}</div>}
                </td>
                {us && <td>{a ? <a href={a.url} target="_blank" rel="noreferrer">{a.label}</a> : 'FINRA 月度统计'}</td>}
              </tr>
            })}
          </tbody>
        </table>
      </div>
      <p className="macro-muted">口径：{d.note ?? (ind.key === 'cashDebt' ? '现金账户和保证金账户的自由贷方余额之和 ÷ 保证金债务。' : ind.name)}{ind.key === 'cashDebt' && ' 比例回升也可能来自债务下降，不能直接理解为新增现金流入。'}{ind.key === 'marginGdp' && ' GDP 为现有历史修订值，非当时实时公布版本。'}</p>
      {us ? <>
        <p className="macro-muted">来源：<a href="https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics" target="_blank" rel="noreferrer">FINRA 保证金统计</a>{ind.key === 'marginGdp' && <> · <a href="https://fred.stlouisfed.org/series/GDP" target="_blank" rel="noreferrer">FRED 名义 GDP</a></>}。2010 年 2 月起 FINRA 统一覆盖会员券商；1973–1974、1987 年为 NYSE 会员券商旧版统计，覆盖范围与证券类别不同，不能视为完全可比。早期档案比例单独计算，不纳入长历史曲线与历史分位。{ind.key === 'marginGdp' && '档案分母使用 2026-10-07 读取的对应季度 GDP 修订值（季调折年），不是当时已公布的实时值。'}</p>
        <p className="macro-muted">1929 年记录的是经纪商自身的抵押借款，不是 FINRA 客户保证金账户债务；本次核对的档案未提供可比的客户现金余额，因此只展示借款原始金额，不据此估算这两项比例。</p>
      </>
        : <p className="macro-muted">来源：沪深交易所两融统计（经东方财富整理；<a href="https://www.sse.com.cn/market/othersdata/margin/detail/" target="_blank" rel="noreferrer">上交所原始统计</a>）{ind.key === 'marginGdp' && <> · <a href="https://data.stats.gov.cn/" target="_blank" rel="noreferrer">国家统计局 GDP</a></>}。只含场内融资，不含场外配资；2010 年才启动两融，不列 2008 年。</p>}
      <p className="macro-muted">这些读数用于理解风险背景，不构成统一的危机触发线。</p>
    </section>
  )
}
