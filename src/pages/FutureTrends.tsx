import React from 'react'
import { useSearchParams } from 'react-router-dom'
import FutureCompanyLink from '../components/FutureCompanyLink'
import { researchForCompany, researchPercent } from '../data/futureTrendsResearch'
import { PageTabs, PageTitle } from '../components/ui/PageTabs'
import { ADAS_LEVELS, ADAS_PICKS, ADAS_PICKS_ASOF, ADAS_RISK_RULES, ADAS_SUMMARY } from '../data/futureTrendsAdasPicks'
import { AI_LEVELS, AI_PICKS, AI_PICKS_ASOF, AI_RISK_RULES, AI_PICKS_PRICE_DATE, AI_PICKS_SUMMARY } from '../data/futureTrendsAiPicks'
import type { AiLevel, AiPick } from '../data/futureTrendsAiPicks'
import { FUTURE_TRENDS_ASOF, TRENDS, trendCoverage, TrendCompany } from '../data/futureTrends'
import FutureTrendsCore from './FutureTrendsCore'
import FutureTrendsPool from './FutureTrendsPool'
import FutureTrendsSolidState from './FutureTrendsSolidState'
import { ADAS_EXTRA_LEVELS, ADAS_EXTRA_PICKS, AI_EXTRA_LEVELS, AI_EXTRA_PICKS, SECTOR_PICKS, SECTOR_PICKS_ASOF, TREND_METRICS, US_PICKS } from '../data/futureTrendsSectorPicks'

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  padding: 20,
  marginBottom: 16,
}

function Companies({ title, list }: { title: string; list: TrendCompany[] }): JSX.Element {
  return (
    <div>
      <h4 style={{ margin: '0 0 6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{title}</h4>
      {list.length === 0 ? <p style={{ margin: 0, color: 'var(--system-gray)', fontSize: '0.85rem' }}>暂无</p> : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {list.map(c => (
            <li key={c.name + c.code} style={{ padding: '6px 0', borderTop: '1px solid var(--system-gray5)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong><FutureCompanyLink name={c.name} code={c.code} /></strong>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: '0.8rem' }}>{c.code}</span>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{c.role}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}><strong>{c.exposure}</strong> · {c.evidence}</div>
              <div style={{ fontSize: '0.75rem' }}>{c.sourceUrl
                ? <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">{c.sourceTitle}</a>
                : <span style={{ color: 'var(--text-secondary)' }}>{c.sourceTitle}</span>}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Bullets({ title, items }: { title: string; items: string[] }): JSX.Element {
  return (
    <div style={{ flex: '1 1 280px' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: '0.9rem' }}>
        {items.map(i => <li key={i}>{i}</li>)}
      </ul>
    </div>
  )
}

interface PicksSectionProps {
  id: string
  title: string
  intro: string
  picks: AiPick[]
  levels: AiLevel[]
  summary: { label: string; text: string }[]
  rules: string[]
  footer: string
}

function PicksSection({ id, title, picks }: PicksSectionProps): JSX.Element {
  return <section style={card} aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    <p>2026-10-09 复核：下表链接至每家公司二级研究页。旧程序化买点、固定胜率与买入评级已撤回；情景草稿未经第二种独立估值认证。行情时点、事实、假设与缺项逐页标明。</p>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
      <thead><tr>{['公司 / 代码', '行情 / 时间', '综合结论', '条件盈亏比 / 保本所需胜率', '护城河', '隐忧'].map(t => <th key={t} style={{ textAlign: 'left', padding: 10 }}>{t}</th>)}</tr></thead>
      <tbody>{picks.map(p => { const r = researchForCompany(p.name, p.code); return <tr key={p.code}>
        <td style={{ padding: 10 }}><FutureCompanyLink name={p.name} code={p.code} /><div>{p.code}</div></td>
        <td style={{ padding: 10 }}>{r?.priceText ?? '[MISSING]'}<small style={{ display: 'block' }}>{r?.priceDate}</small></td>
        <td style={{ padding: 10 }}>{r?.rating ?? '等待证据'}<small style={{ display: 'block' }}>{r?.valuationStatus}</small></td>
        <td style={{ padding: 10 }}>{r?.ratio == null ? '待建模／不适用' : `${r.ratio.toFixed(4)}:1（假设）`}<div>保本所需 {researchPercent(r?.breakEven)}</div><div>实际胜率：未校准</div></td>
        <td style={{ padding: 10 }}>{r?.moat}</td><td style={{ padding: 10 }}>{r?.concern}</td>
      </tr> })}</tbody>
    </table></div>
  </section>
}

function AiPicks(): JSX.Element {
  return (
    <PicksSection id="ai-picks" title="AI 候选公司综合排序：适合买吗？壁垒、增长、盈亏比 × 胜率"
      intro={`整理于 ${AI_PICKS_ASOF}；A 股价格截至 ${AI_PICKS_PRICE_DATE}（节前最后交易日），港股为 2026-10-07 延迟快照，不是收盘价。盈亏比 R = (基准价 − 现价) ÷ (现价 − 悲观价)，期望 = 胜率 × 上行 − (1 − 胜率) × 下行。基准、悲观价来自本站估值倍数假设，胜率是主观概率，不是回测胜率；壁垒、增长为研究者判断。基准价低于现价时不计算期望。仅供研究参考，不构成个人投资建议。`}
      picks={[...AI_PICKS, ...AI_EXTRA_PICKS]} levels={[...AI_LEVELS, ...AI_EXTRA_LEVELS]} rules={AI_RISK_RULES}
      summary={[{ label: '适合买', text: AI_PICKS_SUMMARY.buy }, { label: '有壁垒', text: AI_PICKS_SUMMARY.moat }, { label: '增长空间', text: AI_PICKS_SUMMARY.growth }, { label: '回避', text: AI_PICKS_SUMMARY.avoid }]}
      footer="中际旭创、新易盛、金山办公、用友网络为 2026-10-08 补入，PE、PEG、增速与价位按本站程序化倍数模型计算（AI 赛道中位 PE 41×），未经公司级三情景认证；各公司“估值与增速”列为同一快照（PE 为腾讯行情 TTM，PEG = PE ÷ H1 归母同比）。未建模项（佰维存储、申菱环境、科士达、海天瑞声、拓尔思、联发科、金山办公、用友网络）以及腾讯、阿里巴巴、百度缺少经认证的三情景，不参与赔率排序；其余公司分部、FCF、一致预期多数 [MISSING]。若股价回落至各公司 2:1 价位（如胜宏约 166 元、沪电约 76 元）再重估。本报告仅供研究参考，不构成个人投资建议。" />
  )
}

function AdasPicks(): JSX.Element {
  return (
    <PicksSection id="adas-picks" title="智能驾驶中国公司综合排序：适合买吗？壁垒、增长、盈亏比 × 胜率"
      intro={`整理于 ${ADAS_PICKS_ASOF}；A 股价格截至 2026-09-30 或腾讯行情，港股、中概为 2026-10-07 延迟快照，不是收盘价。仅含上市的中国公司（含港股、中概）；华为、九识智能未上市，不参与。有库内三情景的公司按 AI 赛道同一规则算盈亏比、胜率和价位；其余只有经营事实，不编造基准价、悲观价，价位以粗算重估价或基本面触发代替。胜率是主观概率，不是回测胜率。仅供研究参考，不构成个人投资建议。`}
      picks={[...ADAS_PICKS, ...ADAS_EXTRA_PICKS]} levels={[...ADAS_LEVELS, ...ADAS_EXTRA_LEVELS]} rules={ADAS_RISK_RULES}
      summary={[{ label: '适合买', text: ADAS_SUMMARY.buy }, { label: '优先建模', text: ADAS_SUMMARY.pick }, { label: '有壁垒', text: ADAS_SUMMARY.moat }, { label: '增长空间', text: ADAS_SUMMARY.growth }, { label: '回避', text: ADAS_SUMMARY.avoid }]}
      footer="伯特利、德赛西威、地平线、速腾聚创、禾赛、小马智行、文远知行、小鹏、理想、赛力斯、豪威、经纬恒润、华测导航、千方科技、拓普集团缺少经认证的三情景，不参与赔率排序；分部、FCF、一致预期多数 [MISSING]。重估价为粗算 PE 假设，不是目标价。舜宇光学、黑芝麻智能、四维图新、华阳集团、科博达、耐世特、星宇股份、宇瞳光学、万集科技为 2026-10-08 补入，按本站程序化倍数模型计算（智能驾驶中位 PE 27×），未经三情景认证。“估值与增速”列为 2026-10-08 补充快照：PE 为腾讯行情 TTM，PEG = PE ÷ H1 归母同比，与正文的粗算 PE 可能不同。本报告仅供研究参考，不构成个人投资建议。" />
  )
}

function SectorPicksSection({ id }: { id: string }): JSX.Element | null {
  const s = SECTOR_PICKS[id]
  if (!s) return null
  return (
    <PicksSection id={`${id}-picks`} title={`${s.title}中国公司研究：壁垒、隐忧、情景与待核项`}
      intro={`整理于 ${SECTOR_PICKS_ASOF}；A 股价格为 2026-09-30（节前最后交易日）腾讯行情，港股、中概为 2026-10-07 延迟快照，不是收盘价。财务为 2026H1 累计口径；PE 为 TTM，PEG = PE ÷ H1 归母同比（利润低基数时参考性弱，不是远期 PEG）。基准、悲观价来自本站程序化倍数模型：基准 EPS = TTM EPS × (1 + 0.7 × H1 营收同比，限 −5%~20%)，倍数取现 PE 与赛道中位 PE（${s.median}×）的中点，不超过现 PE 的 1.25 倍，限 7–40×；悲观 EPS 打 15–30% 折扣，倍数取 min(现 PE, 0.6 × 中位)。亏损、PE 过高或利润含一次性项的公司不建模，不设买入价。胜率是主观概率，不是回测胜率；壁垒、增长空间与风险为研究判断。仅供研究参考，不构成个人投资建议。`}
      picks={s.picks} levels={s.levels} rules={s.rules} summary={s.summary} footer={s.footer} />
  )
}

function UsPicksSection({ id }: { id: string }): JSX.Element | null {
  const s = US_PICKS[id]
  if (!s) return null
  return (
    <PicksSection id={`${id}-us-picks`} title={`${s.title}海外公司研究（美股及其他市场）：壁垒、隐忧、情景与待核项`}
      intro={`整理于 ${SECTOR_PICKS_ASOF}；价格为 Yahoo Finance 2026-10-07 延迟快照（各地交易所本币），不是收盘价。PE 为 TTM（括号内为远期 PE），增速为最近一季营收、盈利同比，PEG = TTM PE ÷ 最近季盈利同比（利润低基数时参考性弱）。基准、悲观价与中国公司同一程序化倍数模型，倍数中位取本赛道海外公司（${s.median}×）。亏损、PE 过高或利润含一次性项的公司不建模，不设买入价。胜率是主观概率，不是回测胜率；壁垒、增长空间与风险为研究判断。仅供研究参考，不构成个人投资建议。`}
      picks={s.picks} levels={s.levels} rules={s.rules} summary={s.summary} footer={s.footer} />
  )
}

const POOL_ID = 'pool'
const CORE_ID = 'core'
const SOLID_ID = 'solid-state'

export default function FutureTrends(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = searchParams.get('tab')
  const id = selected && [...TRENDS.map(t => t.id), POOL_ID, CORE_ID, SOLID_ID].includes(selected) ? selected : CORE_ID
  const setId = (next: string): void => { setSearchParams({ tab: next }) }
  const trend = TRENDS.find(t => t.id === id) ?? TRENDS[0]
  const coverage = trendCoverage()
  const selectedCoverage = trendCoverage([trend])
  return (
    <main>
      <PageTitle>未来趋势</PageTitle>
      <PageTabs label="未来趋势赛道" value={id} onChange={setId}
        items={[{ id: CORE_ID, label: '核心' }, { id: POOL_ID, label: '候选池' }, { id: SOLID_ID, label: '固态电池' }, ...TRENDS.map(t => ({ id: t.id, label: t.name.replace(/（.*?）/, '').replace(/，.*/, '') }))]} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 32px' }}>
        {id !== POOL_ID && id !== CORE_ID && id !== SOLID_ID && <p role="note" style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '14px 0' }}>产业目录截至 {FUTURE_TRENDS_ASOF}。点击公司名称查看详细研究；查看推荐顺序请进入核心或候选池。</p>}

        {id === SOLID_ID ? <FutureTrendsSolidState /> : id === POOL_ID ? <FutureTrendsPool /> : id === CORE_ID ? <FutureTrendsCore /> : (<>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>九个赛道 · {coverage.segments} 个细分环节 · {coverage.companies} 个公司或主体 · {coverage.entries} 条业务关联（跨环节可重复）</p>
        <section style={card} aria-labelledby="trend-name">
          <h2 id="trend-name" style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>{trend.name}</h2>
          <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)' }}>{trend.oneLine}</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedCoverage.segments} 个环节 · {selectedCoverage.companies} 个公司或主体。直接业务、多元业务、研发验证、间接配套说明业务关联程度，不代表已核实收入占比或收益排名。</p>
          <p style={{ margin: '0 0 8px', lineHeight: 1.8 }}><strong>阶段：</strong>{trend.stage}</p>
          <p style={{ margin: 0, lineHeight: 1.8 }}><strong>谁受益：</strong>{trend.why}</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--system-gray)' }}>对应书中：{trend.book}</p>
        </section>

        <nav aria-label="产业链环节索引" style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {trend.chain.map((l, index) => <a key={l.link} href={`#${trend.id}-chain-${index}`} style={{ fontSize: '0.85rem' }}>{l.link}</a>)}
        </nav>
        {trend.chain.map((l, index) => (
          <section key={l.link} id={`${trend.id}-chain-${index}`} style={card} aria-label={l.link}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>{l.link}</h3>
            <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>{l.desc}</p>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.7 }}><strong>本环节验证：</strong>{l.verify}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
              <Companies title="中国（含港股、中概）" list={l.cn} />
              <Companies title="海外（美股、ADR 及其他市场）" list={l.us} />
            </div>
          </section>
        ))}

        <section style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Bullets title="该查什么（验证指标）" items={trend.verify} />
          <Bullets title="主要风险" items={trend.risks} />
        </section>
        {trend.id === 'ai' && <AiPicks />}
        {trend.id === 'adas' && <AdasPicks />}
        <SectorPicksSection id={trend.id} />
        <UsPicksSection id={trend.id} />
        </>)}
      </div>
    </main>
  )
}
