import { Card, EmptyState, Stat, StatGrid, TableWrap } from '../../components/ui'
import type { DailySnapshot, DailySource, RankedStock } from './types'

export const valueText = (value: number | null, suffix = '') => value === null ? '—' : `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${suffix}`
export const timeText = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
const tone = (value: number) => value > 0 ? 'daily-up' : value < 0 ? 'daily-down' : ''

export function MarketOverview({ data }: { data: DailySnapshot }): JSX.Element {
  return <Card as="section" title="市场概况" className="daily-market">
    <div className="daily-market__amount"><span>沪深两市成交额</span><strong>{valueText(data.metrics.volume)}<small> 亿元</small></strong><span>沪深指数成交额合计，不重复叠加创业板</span></div>
    <div className="daily-indices">{['sh000001', 'sz399001', 'sz399006'].map(symbol => {
      const row = data.indices.find(index => index.symbol === symbol)
      const name = { sh000001: '上证指数', sz399001: '深证成指', sz399006: '创业板指' }[symbol]
      return <div key={symbol} className="daily-index"><span>{name}</span><strong>{row ? valueText(row.price) : '—'}</strong><span className={row ? tone(row.change) : ''}>{row ? `${row.change > 0 ? '+' : ''}${valueText(row.change, '%')}` : '—'}</span></div>
    })}</div>
  </Card>
}

export function MarketStats({ data }: { data: DailySnapshot }): JSX.Element {
  const m = data.metrics
  return <Card as="section" title="涨跌停与连板" description="涨跌停与连板按东方财富股池统计；封板率按收盘涨停数占当日涨停与炸板未回封股票总数计算。">
    <StatGrid>
      <Stat label="涨停股票" value={valueText(m.ztCount)} sub="只" className="daily-up" />
      <Stat label="跌停股票" value={valueText(m.dtCount)} sub="只" className="daily-down" />
      <Stat label="涨停封板率" value={valueText(m.ztSealRate, '%')} />
      <Stat label="炸板未回封" value={valueText(m.ztOpen)} sub="只，不是盘中开板次数" />
      <Stat label="连板股票" value={valueText(m.lbCount)} sub="连续涨停 ≥ 2 个交易日" />
      <Stat label="最高连板" value={valueText(m.maxBoard, ' 板')} />
      <Stat label="涨停晋级率" value={valueText(m.lbRate, '%')} sub={m.lbRate === null ? '需上一交易日同源完整快照' : '昨日涨停股今日再次涨停的比例'} />
      <Stat label="上涨 / 下跌" value={m.upCount === null || m.downCount === null ? '—' : `${m.upCount} / ${m.downCount}`} sub="全市场家数来源尚未覆盖" />
    </StatGrid>
    <div className="daily-missing"><div>跌停打开数 <strong>—</strong></div><div>跌停封板率 <strong>—</strong></div><p>尚无覆盖所有“曾跌停后打开”股票的可靠数据，保留缺失值。</p></div>
  </Card>
}

export function BoardLadder({ data }: { data: DailySnapshot }): JSX.Element {
  const available = data.sources.some(source => source.id === 'limitUp' && source.status === 'ready')
  return <Card as="section" title="连板梯队" description="只统计连续涨停；“3天2板”不计作“2连板”。">
    {data.ladder.length ? <div className="daily-ladder">{data.ladder.map(level => <div key={level.boards} className="daily-ladder__row"><strong>{level.boards} 板<small>{level.stocks.length} 只</small></strong><div>{level.stocks.map(stock => <span className="daily-stock-chip" key={stock.code}>{stock.name}<small>{stock.code}</small></span>)}</div></div>)}</div>
      : <EmptyState title={available ? '当日暂无连板股票' : '连板数据暂不可用'}>{available ? '已取得涨停股池，未发现连续涨停两日以上的股票。' : '刷新后重试，或查看已归档的交易日。'}</EmptyState>}
  </Card>
}

function StockRanking({ title, rows, kind, source }: { title: string; rows: RankedStock[]; kind: 'amount' | 'turnover'; source?: DailySource }): JSX.Element {
  return <Card as="section" title={title} description={`新浪 A 股排名（沪深北），腾讯核验报价日期。${source?.status === 'partial' ? ` ${source.note}。` : ''}`}>
    {rows.length ? <TableWrap label={title}><table className="ui-table daily-table"><thead><tr><th scope="col">股票</th><th scope="col">{kind === 'amount' ? '成交额 / 亿' : '换手率'}</th><th scope="col">涨跌幅</th></tr></thead><tbody>{rows.map(row => <tr key={row.symbol}><td><a href={`https://gu.qq.com/${row.symbol}`} target="_blank" rel="noopener noreferrer">{row.name}</a><small>{row.code}</small></td><td>{valueText(row[kind], kind === 'turnover' ? '%' : '')}</td><td className={tone(row.change)}>{row.change > 0 ? '+' : ''}{valueText(row.change, '%')}</td></tr>)}</tbody></table></TableWrap>
      : <EmptyState title="榜单暂不可用">尚未取得日期匹配的完整报价，请稍后刷新。</EmptyState>}
  </Card>
}

export function Rankings({ data }: { data: DailySnapshot }): JSX.Element {
  return <div className="daily-two-columns"><StockRanking title="成交金额前五" rows={data.rankings.amount} kind="amount" source={data.sources.find(source => source.id === 'amountRank')} /><StockRanking title="换手率前五" rows={data.rankings.turnover} kind="turnover" source={data.sources.find(source => source.id === 'turnoverRank')} /></div>
}

export function SectorFlows({ data }: { data: DailySnapshot }): JSX.Element {
  const available = data.sources.some(source => source.id === 'flows' && source.status === 'undated')
  return <Card as="section" title="行业资金流" description={`新浪资金流口径，非主力净流入；来源未标注交易日期。采集时间：${timeText(data.fetchedAt)}（北京时间）。`}>
    {available ? <div className="daily-two-columns">{(['inflow', 'outflow'] as const).map(key => <div key={key}><h3 className="daily-flow-title">{key === 'inflow' ? '净流入前五' : '净流出前五'}</h3>{data.flows[key].length ? <ol className="daily-flow-list">{data.flows[key].map(row => <li key={row.name}><span>{row.name}</span><strong className={key === 'inflow' ? 'daily-up' : 'daily-down'}>{valueText(row.amount, ' 亿')}</strong></li>)}</ol> : <p className="daily-note">当前快照暂无{key === 'inflow' ? '正' : '负'}净流入行业。</p>}</div>)}</div> : <EmptyState title="行业资金流暂不可用">请稍后刷新。</EmptyState>}
  </Card>
}

export function DataNotes({ data }: { data: DailySnapshot }): JSX.Element {
  const labels = { ready: '已核验日期', partial: '部分可用', unavailable: '暂不可用', undated: '未标注日期' }
  return <details className="ui-card daily-notes"><summary>数据来源与统计口径</summary><div className="daily-notes__body">
    <p>所有时间使用北京时间。不同来源的统计范围可能不同；接口缺失显示「—」，有效的零值显示 0。</p>
    <TableWrap label="数据来源"><table className="ui-table daily-sources"><thead><tr><th scope="col">来源</th><th scope="col">交易日期</th><th scope="col">状态与说明</th></tr></thead><tbody>{data.sources.map(source => <tr key={source.id}><td><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></td><td>{source.date ?? '未标注'}</td><td>{labels[source.status]}{source.note && <small>{source.note}</small>}</td></tr>)}</tbody></table></TableWrap>
    <ul><li>两市成交额使用腾讯上证指数与深证成指的成交额字段，不含北交所，不叠加创业板。</li><li>涨停封板率 = 涨停股池数量 ÷（涨停股池数量 + 炸板未回封股池数量）。</li><li>涨停晋级率 = 昨日涨停且今日再次涨停的股票数 ÷ 昨日涨停股票数；仅使用相邻交易日的同源快照。</li><li>全市场上涨/下跌家数、跌停打开数及跌停封板率尚未覆盖；不会用板块家数、开板次数替代。</li><li>排行榜展示股票及各自数值。行业资金流为采集快照，不能据此认定未标注的交易日期。</li><li>历史交易日来自收盘后自动归档及本机已取得的快照；旧版手工复盘在「历史旧版」页面查看。</li></ul>
  </div></details>
}
