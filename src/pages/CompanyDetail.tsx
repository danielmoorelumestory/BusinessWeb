import React, { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import { useCompanies, useLynch, Market } from '../data/companies'
import { usePageSeo } from '../components/RouteSeo'
import ResearchNotice from '../components/research/ResearchNotice'
import { toneOf, Tone } from '../data/notionNotes'
import { CN_REPORT } from '../data/cnReassessment'
import { SP500_REPORT } from '../data/sp500Reassessment'
import CandidateButton from '../components/CandidateButton'
import { useCandidates } from '../features/candidates/useCandidates'
import { priceAnchorAge } from '../features/dcf/priceAnchor'
import { buildDcfLink } from '../features/dcf'

const toneColors: Record<Tone, { bg: string; color: string }> = {
  green: { bg: 'color-mix(in srgb, var(--system-green) 12%, transparent)', color: 'var(--system-green)' },
  blue: { bg: 'color-mix(in srgb, var(--system-blue) 10%, transparent)', color: 'var(--system-blue)' },
  orange: { bg: 'color-mix(in srgb, var(--system-orange) 12%, transparent)', color: 'var(--system-orange)' },
  red: { bg: 'color-mix(in srgb, var(--system-red) 12%, transparent)', color: 'var(--system-red)' },
  gray: { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
}

export default function CompanyDetail(): JSX.Element {
  const { market, code } = useParams()
  const navigate = useNavigate()
  const mk = (market === 'cn' ? 'cn' : market === 'hk' ? 'hk' : market === 'adr' ? 'adr' : market === 'ndx' ? 'ndx' : 'us') as Market
  const { list, loading } = useCompanies(mk)
  const lynchAll = useLynch()
  const company = list.find(c => c.code === decodeURIComponent(code || ''))
  const cand = useCandidates(true)
  usePageSeo(company ? `${company.name}（${company.code}）研究笔记` : undefined, company ? `${company.name}（${company.code}）：${company.headline}`.slice(0, 160) : undefined)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [market, code])

  const card: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px 28px',
    marginBottom: '16px',
    boxShadow: 'var(--shadow-md)',
  }
  const sectionTitle: React.CSSProperties = { fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }
  const cardTitle: React.CSSProperties = { fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' }

  const row = (text: string, accent: string, key: number, warn = false): JSX.Element => (
    <div key={key} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
      {warn
        ? <AlertTriangle size={16} color={accent} style={{ flexShrink: 0, marginTop: '3px' }} />
        : <CheckCircle2 size={16} color={accent} style={{ flexShrink: 0, marginTop: '3px' }} />}
      <span>{text}</span>
    </div>
  )

  const badgeStyle = (t: Tone): React.CSSProperties => ({ display: 'inline-block', fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '6px', background: toneColors[t].bg, color: toneColors[t].color })

  const back = (
    <Link
      to={`/research-notes?tab=companies&m=${mk}`}
      onClick={e => {
        // 有站内历史就原路返回（保留页签、市场、板块和滚动位置）
        if (window.history.state && window.history.state.idx > 0) {
          e.preventDefault()
          navigate(-1)
        }
      }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', textDecoration: 'none', fontSize: '13px', marginBottom: '14px' }}
    >
      <ArrowLeft size={14} /> 返回公司研究
    </Link>
  )

  if (!company) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '40px 20px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <Link to="/research-notes" style={{ color: 'var(--system-blue)', textDecoration: 'none', fontSize: '14px' }}>← 返回公司研究</Link>
          <div style={{ ...card, marginTop: '16px' }}>
            <h3 style={cardTitle}>{loading ? '正在加载…' : '未找到该公司'}</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>{loading ? '正在读取补全公司数据。' : '该公司还没有整理进公司库。'}</p>
          </div>
        </div>
      </div>
    )
  }

  const tone = toneOf(company.rating)

  // ── 按“最终返回标准”整理：三情景表、买入纪律、完整度 ──
  const nums = (t: string): number[] => (t.match(/[\d,]+(?:\.\d+)?/g) || []).map(x => Number(x.replace(/,/g, ''))).filter(n => !Number.isNaN(n))
  // 存档仍显示在指标表，但不能自动回填已经撤回的情景与纪律。
  const activeMetrics = company.metrics.filter(([label]) => !label.startsWith('上轮'))
  const metric = (re: RegExp): string | undefined => activeMetrics.find(([l]) => re.test(l))?.[1]
  const priceText = metric(/价格锚点|收盘价|现价|9\/18 收盘/)
  const price = priceText ? nums(priceText)[0] : undefined
  const priceAge = priceAnchorAge(priceText)
  const scenText = metric(/Bear \/ Base \/ Bull/)
  const scenNums = scenText && !/市值/.test(scenText) ? nums(scenText) : []
  const scenRows: [string, string, string, string][] | null = scenNums.length === 3
    ? (['悲观', '基准', '乐观'] as const).map((n, i) => {
        const v = scenNums[i]
        const pct = price && v > price * 0.1 && v < price * 10 ? `${v >= price ? '+' : ''}${((v / price - 1) * 100).toFixed(1)}%` : '—'
        const trigger = n === '悲观' ? '盈利下修或估值压缩' : n === '基准' ? '正常兑现路径' : '增长/利润率超预期'
        return [n, v.toLocaleString(), pct, trigger] as [string, string, string, string]
      })
    : null
  const pool = [...company.next, ...company.thesis, ...company.risk, ...activeMetrics.map(([l, v]) => `${l}：${v}`)]
  const pick = (re: RegExp): string | undefined => pool.find(t => re.test(t))
  const dz = company.discipline
  const discipline: [string, string | undefined][] = [
    ['条件价格（研究假设）', dz?.zone || pick(/买入区|买入观察|观察买入|买入区间|首次关注|重仓区|核心买入/)],
    ['加仓条件（研究假设）', dz?.add || pick(/确认加仓|加仓|突破|确认.{0,6}(后|才)/)],
    ['减仓 / 止盈', dz?.trim || pick(/减仓|止盈|兑现|卖出区|首减/)],
    ['失效条件', dz?.invalid || company.risk.find(t => /证伪|失效|跌破|连续|低于|恶化/.test(t)) || company.risk[0]],
    ['仓位原则', dz?.position || pick(/仓位|建议仓位|不超过|上限/)],
  ]
  // 缺项时按研究标准补默认条款，并明确标注（不冒充公司专属结论）
  const bullPrice = company.scenarios?.find(x => x.name === '乐观' || x.name === '牛市')?.price || (scenRows ? `${scenRows[2][1]}` : undefined)
  const std = '（按研究标准默认条款）'
  if (!discipline[2][1]) discipline[2][1] = `${bullPrice ? `接近乐观情景价 ${bullPrice}，` : ''}或盈利预期不再改善、赔率变差时分批处理${std}`
  if (!discipline[4][1] && /观察|回避|暂不|等待|不追|谨慎/.test(company.rating)) discipline[4][1] = `赔率未达约 2:1，按研究标准只放观察名单，不建仓${std}`
  const disciplineFilled = discipline.filter(d => d[1]).length
  const completeness: [string, boolean][] = [
    ['公司简介', !!company.profile],
    ['业务分布', !!company.segments],
    ['优缺点', !!company.pros && !!company.cons],
    ['行业趋势', !!company.industry],
    ['结论卡', !!company.rating && !!company.headline],
    ['关键指标', company.metrics.length > 0],
    ['增长与护城河', company.thesis.length > 0 && (!!company.moat || company.thesis.length >= 3)],
    ['三情景表', !!scenRows || !!company.scenarios],
    ['买入纪律', disciplineFilled >= 3],
    ['风险与证伪', company.risk.length > 0],
    ['多空交锋', !!company.bullBear],
    ['口径说明', !!company.asOf],
    ['验证日历', company.next.length > 0 || !!company.calendar],
  ]
  const done = completeness.filter(c => c[1]).length
  const pending = (label: string): JSX.Element => (
    <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>待补充{label}（可在 Notion 原页查看）</span>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '80px' }}>
      {/* 页面头部 */}
      <div className="page-hero">
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          {back}
          <Link to={`/valuation?market=${mk === 'adr' || mk === 'ndx' ? 'us' : mk}&code=${encodeURIComponent(company.code)}`} style={{display:'inline-block',marginLeft:'18px',color:'var(--accent)',fontSize:'13px'}}>建立估值模型 →</Link>
          <Link to={buildDcfLink({ company: company.name, code: company.code, researchMarket: mk, price })} style={{display:'inline-block',marginLeft:'18px',color:'var(--accent)',fontSize:'13px'}}>用当前价格测算 DCF →</Link>
          <h1 style={{ fontSize: '24px', margin: '0 0 6px' }}>{company.name}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
            {company.market === 'us' ? '标普500' : company.market === 'hk' ? '港股' : company.market === 'adr' ? '美股非标普' : company.market === 'ndx' ? '纳指100' : '沪深'} · {company.code} · {company.sector} · {company.batch}
          </p>
          <span style={{ display: 'inline-block', fontSize: '13px', fontWeight: 600, padding: '4px 12px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: toneColors[tone].color }}>
            {company.rating}
          </span>
          <span style={{ marginLeft: '10px' }}>
            <CandidateButton on={cand.items.some(i => i.market === company.market && i.code === company.code)} onClick={() => cand.toggle(company.market, company.code)} />
          </span>
          {priceAge && (
            <p role="status" style={{ fontSize: '12px', margin: '10px 0 0', color: priceAge.stale ? 'var(--system-orange)' : 'var(--text-secondary)' }}>
              价格锚点 {priceAge.date}（{priceAge.days === 0 ? '今天' : `${priceAge.days} 天前`}）
              {priceAge.stale && '：盈亏比与买入价按这个价格算，重新取价后再用'}
            </p>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '28px 20px' }}>
        <ResearchNotice />
        {(company.market === 'us' || company.market === 'cn' || company.market === 'hk' || company.market === 'adr') && (company.researchReport || company.metrics.some(([key]) => key === '圆桌复核日期')) && (
          <div style={card}>
            <h3 style={cardTitle}>{company.researchReport ? '公司研究 · 本轮事实复核与估值初稿' : '腾讯自选股投研专家团 · 本轮公告复核'}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>{(company.market === 'hk' || company.market === 'adr') && company.researchReport ? '已逐家核读公司业绩原件并补充新行情，报告列明来源、旧结论修正及待补证据。部分公司有数值敏感性草案；两种独立估值、现金与股本桥接仍待补，旧评级和价位不作为当前结论。' : company.researchReport ? '已按公司核对财报与现金流，完整报告列明来源、旧结论调整及待补证据。估值假设尚未认证；林奇分类仍为此前的程序化筛选结果。' : '本轮已补充公司公告；证据分为公告原件、公告转载及待核实；旧情景价值的认证状态以本轮结论为准。“上轮”指标保留历史口径，林奇分类仍为此前的程序化筛选结果。'}</p>
            <a href={`${import.meta.env.BASE_URL}${company.researchReport ?? (company.market === 'cn' ? CN_REPORT : SP500_REPORT)}`} target="_blank" rel="noreferrer" style={{ fontSize: '13px' }}>查看本轮完整报告与一手来源</a>
          </div>
        )}
        {(() => {
          const ly = lynchAll[`${company.market}:${company.code}`]
          if (!ly || ((company.market === 'hk' || company.market === 'adr') && company.researchReport)) return null
          const tone = ly.r === '高' ? 'color-mix(in srgb, var(--system-green) 45%, transparent)' : ly.r === '中' ? 'color-mix(in srgb, var(--system-blue) 35%, transparent)' : 'var(--border-primary)'
          return (
            <div style={{ ...card, border: `1.5px solid ${tone}` }}>
              <h3 style={{ ...cardTitle, margin: '0 0 8px' }}>林奇分类：{ly.t}（同类关注度 {ly.r}）{ly.m ? ` · ${ly.m.l}` : ''}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 8px' }}>
                {[...ly.w, ly.v].filter(Boolean).join('；')}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.7, margin: '0 0 8px' }}>
                {ly.pe ? `PE ${ly.pe}×` : 'PE 不适用'}{ly.g !== null && ly.g !== undefined ? ` · 利润近一年 ${ly.g > 0 ? '+' : ''}${ly.g}%` : ''}{ly.c !== null && ly.c !== undefined ? `（两年年化 ${ly.c > 0 ? '+' : ''}${ly.c}%）` : ''}{ly.peg ? ` · PEG ${ly.peg}` : ''}{ly.ph ? ` · 周期位置：${ly.ph}` : ''}{ly.dy !== null && ly.dy !== undefined ? ` · 股息率 ${ly.dy}%` : ''}
              </p>
              {ly.f.map(x => <p key={x} style={{ fontSize: '12px', color: 'var(--system-orange)', margin: '0 0 4px' }}>⚠ {x}</p>)}
              {ly.m && (
                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <tbody>
                      {ly.m.i.map(([name, ok, note]) => (
                        <tr key={name} style={{ borderTop: '1px solid var(--border-primary)' }}>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', width: '84px' }}>{name}</td>
                          <td style={{ padding: '6px 8px', width: '32px' }}>{ok === null ? '—' : ok ? '✓' : '✗'}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '8px 0 0', lineHeight: 1.7 }}>护城河只看财务证据（{ly.m.s}/{ly.m.n} 项通过）：它检验品牌、网络效应、转换成本等通常留下的痕迹，不能证明护城河本身；无 FCF/股息（A 股、美股）。规则见「研究笔记 → 分类数据 → 林奇分组」。</p>
                </div>
              )}
            </div>
          )
        })()}
        {company.auto && (
          <div style={{ ...card, border: '1.5px solid color-mix(in srgb, var(--system-orange) 45%, transparent)', background: 'color-mix(in srgb, var(--system-orange) 6%, transparent)' }}>
            <h3 style={{ ...cardTitle, margin: '0 0 8px' }}>{company.reviewed ? '程序化研究页（已人工复核）' : '程序化研究页'}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{company.metrics.some(([key]) => key === '圆桌复核日期') ? '本页源自程序化补全；本轮圆桌已另行核实公告并更正结论，旧模型已暂停认证。旧数值存档不等于逐项一手财务验证，分部占比、正常化估值与完整现金流仍需补齐。' : <>本页的财务数值、估值、三情景与买入区由脚本按统一规则计算（规则见「研究笔记 → 研究标准」），业务描述与行业判断为简述；{company.reviewed ? '已用最新半年报/指引人工复核评级与关键风险（见指标表「人工复核」行），但情景数值仍是脚本结果；' : ''}不含公司特有催化与风险，一手公告、分部占比、一致预期、自由现金流均未取到。结论用于筛选与排序，深度判断需回到公司公告。</>}</p>
          </div>
        )}
        <div style={card}>
          <h3 style={cardTitle}>公司简介与业务分布</h3>
          {company.profile ? <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 16px' }}>{company.profile}</p> : <div style={{ marginBottom: '12px' }}>{pending('公司简介')}</div>}
          {company.segments ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['业务 / 分部', '占比', '说明'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '0.5px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {company.segments.map((r, i) => (
                    <tr key={r.name} style={{ background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500, borderBottom: '0.5px solid var(--border-primary)', verticalAlign: 'top' }}>{r.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--border-primary)', verticalAlign: 'top' }}>{r.share || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', lineHeight: 1.6, borderBottom: '0.5px solid var(--border-primary)', verticalAlign: 'top' }}>{r.note || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : pending('业务分布')}
        </div>

        <div style={card}>
          <h3 style={cardTitle}>优势与缺点</h3>
          {company.pros || company.cons ? (
            <>
              <p style={{ ...sectionTitle, margin: '0 0 10px' }}>优势</p>
              {(company.pros || []).map((t, i) => row(t, 'var(--system-green)', i))}
              <p style={{ ...sectionTitle, margin: '16px 0 10px' }}>缺点</p>
              {(company.cons || []).map((t, i) => row(t, 'var(--system-red)', i, true))}
            </>
          ) : pending('优缺点')}
        </div>

        <div style={card}>
          <h3 style={cardTitle}>行业趋势</h3>
          {company.industry ? company.industry.map((t, i) => row(t, 'var(--system-blue)', i)) : pending('行业趋势')}
          {company.industry && <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '10px 0 0' }}>行业趋势含研究者判断，需随最新数据更新。</p>}
        </div>

        <div style={{ ...card, border: '1.5px solid color-mix(in srgb, var(--system-blue) 35%, transparent)', background: 'color-mix(in srgb, var(--system-blue) 4%, transparent)' }}>
          <p style={{ fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 14px', lineHeight: 1.7, fontWeight: 500 }}>{company.headline}</p>
          {(company.certainty || company.duration || company.ratioNote) && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '14px' }}>
              {company.certainty && <div><strong style={{ color: 'var(--text-primary)' }}>确定性：</strong>{company.certainty}</div>}
              {company.duration && <div><strong style={{ color: 'var(--text-primary)' }}>增长可持续期限：</strong>{company.duration}</div>}
              {company.ratioNote && <div><strong style={{ color: 'var(--text-primary)' }}>盈亏比：</strong>{company.ratioNote}</div>}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '4px' }}>最终返回标准完整度 {done}/{completeness.length}</span>
            {completeness.map(([n, ok]) => (
              <span key={n} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: ok ? 'color-mix(in srgb, var(--system-green) 12%, transparent)' : 'var(--bg-secondary)', color: ok ? 'var(--system-green)' : 'var(--text-tertiary)' }}>{ok ? '✓' : '○'} {n}</span>
            ))}
          </div>
        </div>

        {company.metrics.length > 0 && (
          <>
            <p style={sectionTitle}>关键指标</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {company.metrics.map(([label, value]) => (
                <div key={label} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>{label}</p>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>{value}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={card}>
          <h3 style={cardTitle}>增长与护城河 / 核心逻辑</h3>
          {company.thesis.length > 0 ? company.thesis.map((t, i) => row(t, 'var(--system-green)', i)) : pending('')}
          {company.growth && (
            <>
              <p style={{ ...sectionTitle, margin: '18px 0 10px' }}>增长来源与持续性</p>
              {company.growth.map((t, i) => row(t, 'var(--system-blue)', i))}
            </>
          )}
          {company.moat && (
            <>
              <p style={{ ...sectionTitle, margin: '18px 0 10px' }}>护城河</p>
              {company.moat.map((t, i) => row(t, 'var(--system-teal)', i))}
            </>
          )}
        </div>

        <div style={card}>
          <h3 style={cardTitle}>三情景估值</h3>
          {company.scenarios ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['情景（概率）', '盈利与倍数假设', '隐含价', '相对现价', '触发 / 证伪'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '0.5px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {company.scenarios.map((r, i) => (
                    <tr key={r.name} style={{ background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--border-primary)', verticalAlign: 'top' }}>{r.name}{r.prob ? `（${r.prob}）` : ''}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', lineHeight: 1.6, minWidth: '200px', borderBottom: '0.5px solid var(--border-primary)', verticalAlign: 'top' }}>{r.assumption}{r.multiple ? `；倍数 ${r.multiple}` : ''}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--border-primary)', verticalAlign: 'top' }}>{r.price}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--border-primary)', verticalAlign: 'top' }}>{r.change}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', lineHeight: 1.6, minWidth: '160px', borderBottom: '0.5px solid var(--border-primary)', verticalAlign: 'top' }}>{r.trigger}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : scenRows ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {['情景', '隐含价', '相对价格锚点', '触发 / 证伪方向'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '0.5px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {scenRows.map((r, i) => (
                    <tr key={r[0]} style={{ background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent' }}>
                      {r.map((c, j) => <td key={j} style={{ padding: '10px 14px', color: j === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: j === 0 ? 500 : 400, borderBottom: '0.5px solid var(--border-primary)' }}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            scenText ? <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>{scenText}</p> : pending('三情景估值表')
          )}
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '12px 0 0', lineHeight: 1.6 }}>情景价 = 正常化 EPS × 合理倍数，为研究假设，不是目标价；概率与期望收益如有，也不是历史回测胜率。</p>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>结论与买入纪律</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                {discipline.map(([label, text], i) => (
                  <tr key={label} style={{ background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', verticalAlign: 'top', borderBottom: '0.5px solid var(--border-primary)' }}>{label}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', lineHeight: 1.7, borderBottom: '0.5px solid var(--border-primary)' }}>{text || pending('')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '12px 0 0', lineHeight: 1.6 }}>价位均为条件化研究区间，不是交易指令；未列出的项按“最终返回标准”尚待补充。</p>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>风险与证伪</h3>
          {company.risk.length > 0 ? company.risk.map((t, i) => row(t, 'var(--system-orange)', i, true)) : pending('')}
        </div>

        <div style={card}>
          <h3 style={cardTitle}>多空交锋</h3>
          {company.bullBear ? (
            <>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ ...badgeStyle('green') }}>多头最强论点</span>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '6px 0 0' }}>{company.bullBear.bull}</p>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ ...badgeStyle('red') }}>空头最强论点</span>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '6px 0 0' }}>{company.bullBear.bear}</p>
              </div>
              <div>
                <span style={{ ...badgeStyle('blue') }}>裁决</span>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '6px 0 0' }}>{company.bullBear.verdict}</p>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '12px 0 0' }}>整理自研究页内容，不是独立的多空对抗检验。</p>
            </>
          ) : pending('（本页未做多空对抗检验）')}
        </div>

        <div style={card}>
          <h3 style={cardTitle}>后续验证 / 操作参考</h3>
          {(company.next.length > 0 || company.calendar) ? [...company.next, ...(company.calendar || [])].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <ArrowRight size={16} color="var(--system-blue)" style={{ flexShrink: 0, marginTop: '3px' }} />
              <span>{t}</span>
            </div>
          )) : pending('')}
        </div>

        {(company.pitfalls || company.aiNote) && (
          <div style={card}>
            <h3 style={cardTitle}>口径与陷阱</h3>
            {(company.pitfalls || []).map((t, i) => row(t, 'var(--system-orange)', i, true))}
            {company.aiNote && row(`AI 的位置：${company.aiNote}`, 'var(--system-blue)', 99)}
          </div>
        )}

        <div style={card}>
          <h3 style={cardTitle}>数据口径</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.7 }}>{company.asOf}</p>
          {company.url && (
            <a
              href={company.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--system-blue)', textDecoration: 'none' }}
            >
              <ExternalLink size={14} /> 在 Notion 查看完整研究页
            </a>
          )}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          内容整理自 Notion 个人研究笔记，仅为研究记录，不构成投资建议。情景价值与价位为研究假设，非目标价。
        </p>
      </div>
    </div>
  )
}
