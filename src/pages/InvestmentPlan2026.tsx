import React, { useEffect, useMemo, useState } from 'react'
import { SIGNALS, STAGES, computeStage, signalTone, type Stage } from '../features/macro/stages'
import { PageTabs, PageTitle } from '../components/ui/PageTabs'
import { fetchEarningsCalendar, type EarningsCalendarItem } from '../services/api'

// 同源 /api/*；GitHub Pages 构建时通过 VITE_API_BASE 指向 Vercel
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
import {
  Target,
  LayoutDashboard,
  PieChart,
  Gauge,
  CalendarDays,
  Thermometer,
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Circle,
  RefreshCw,
  ExternalLink,
  Info,
  Plus,
  Trash2,
  RotateCcw,
  Ban
} from 'lucide-react'
import { tableWrapperStyle, tableStyle, thStyle, tdStyle } from '../components/TableStyles'

/* ───────────────────────── 基础工具 ───────────────────────── */

const STORE_PREFIX = 'plan2026:'

function usePersisted<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value))
    } catch {
      /* 隐私模式等场景下忽略 */
    }
  }, [key, value])
  return [value, setValue]
}

const num = (s: string) => (s.trim() === '' ? NaN : parseFloat(s))
const fmtMoney = (n: number) => (Number.isFinite(n) ? n.toLocaleString('zh-CN', { maximumFractionDigits: 1 }) : '—')
const fmtPct = (n: number, d = 1) => (Number.isFinite(n) ? `${n.toFixed(d)}%` : '—')
const dayDiff = (a: Date, b: Date) =>
  Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000)

type Tone = 'green' | 'yellow' | 'red' | 'blue' | 'gray'
const TONE: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: 'var(--system-green)', bg: 'var(--system-green-light)' },
  yellow: { fg: 'var(--warm-ink)', bg: 'color-mix(in srgb, var(--system-orange) 12%, transparent)' },
  red: { fg: 'var(--system-red)', bg: 'var(--system-red-light)' },
  blue: { fg: 'var(--system-blue)', bg: 'var(--system-blue-light)' },
  gray: { fg: 'var(--text-secondary)', bg: 'var(--system-gray6)' }
}

const Pill: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 'var(--radius-chip)',
      background: TONE[tone].bg,
      color: TONE[tone].fg,
      fontSize: '0.78rem',
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }}
  >
    {children}
  </span>
)

const Card: React.FC<{
  title?: string
  icon?: React.ReactNode
  right?: React.ReactNode
  accent?: string
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ title, icon, right, accent, children, style }) => (
  <section
    className="glass-panel"
    style={{
      background: 'white',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 20,
      boxShadow: 'var(--shadow-sm)',
      borderTop: accent ? `3px solid ${accent}` : undefined,
      ...style
    }}
  >
    {(title || right) && (
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {title && (
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
            {icon}
            {title}
          </h3>
        )}
        {right}
      </header>
    )}
    {children}
  </section>
)

const Note: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'blue', children }) => (
  <div
    style={{
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      padding: '10px 14px',
      borderRadius: 'var(--radius-sm)',
      background: TONE[tone].bg,
      color: 'var(--text-primary)',
      fontSize: '0.88rem',
      lineHeight: 1.65
    }}
  >
    <Info size={16} style={{ color: TONE[tone].fg, flexShrink: 0, marginTop: 3 }} />
    <div>{children}</div>
  </div>
)

const grid = (min: number): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
  gap: 16
})

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--system-gray4)',
  fontSize: '0.92rem',
  background: 'white',
  color: 'var(--text-primary)',
  boxSizing: 'border-box'
}

const btnStyle = (primary = false): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 10,
  border: primary ? 'none' : '1px solid var(--system-gray4)',
  background: primary ? 'var(--system-blue)' : 'white',
  color: primary ? 'white' : 'var(--text-primary)',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer'
})

const Bullets: React.FC<{ items: string[]; tone?: Tone }> = ({ items, tone = 'gray' }) => (
  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
    {items.map(t => (
      <li key={t} style={{ display: 'flex', gap: 8, fontSize: '0.9rem', lineHeight: 1.6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE[tone].fg, marginTop: 9, flexShrink: 0 }} />
        <span>{t}</span>
      </li>
    ))}
  </ul>
)

/* ───────────────────────── 数据：风险信号与阶段 ───────────────────────── */

const DRAWDOWN_LADDER = [
  { dd: '-15%', step: '检查而不是行动', detail: '确认备用金与压力损失预算；把下面两档的资金来源写清楚' },
  { dd: '-25%', step: '补第一批', detail: '底仓内权益低于目标时，按再平衡规则补到目标的约1/3差额' },
  { dd: '-35%', step: '补第二批', detail: '同上，再补约1/3；此前确认备用金仍满足压力期限' },
  { dd: '-45%', step: '补第三批', detail: '补齐剩余差额。资金只来自底仓内的债、黄金、现金，不来自备用金' }
]

const SCENARIOS: { name: string; tone: Tone; watch: string[]; effect: string; act: string[] }[] = [
  {
    name: '软着陆延续',
    tone: 'green',
    watch: ['失业率平稳，初请低于25万', '通胀缓慢回落', '信用利差处于低位'],
    effect: '权益通常受益，但估值已高时上行空间有限；债券与黄金拖累不大。',
    act: ['按目标权重运行', '不追涨加仓', '用再平衡把涨多的部分收回来']
  },
  {
    name: '滞胀',
    tone: 'yellow',
    watch: ['通胀回升，薪资增速居高不下', '增长数据转弱', '长端利率上行'],
    effect: '股债可能同时承压，黄金与短债相对更稳；长久期债券最受伤。',
    act: ['检查债券的久期，避免全是长债', '黄金权重只在阈值内微调', '不为“躲通胀”临时买没研究过的资产']
  },
  {
    name: '衰退',
    tone: 'red',
    watch: ['萨姆规则触发', '信用利差快速走阔', '银行拨备连续上升'],
    effect: '权益回撤，高质量债券与黄金通常提供缓冲；小盘与周期股受损更重。',
    act: ['升级到“防御”阶段并执行清单', '备用金优先于一切', '按回撤梯度分批，而不是一次抄底']
  },
  {
    name: '政策重置',
    tone: 'blue',
    watch: ['央行降息或扩表', '财政大规模刺激', '利差明显回落'],
    effect: '风险资产常先于经济数据反弹；此时多数人仍在观望。',
    act: ['不因为“已经涨了一截”就放弃再平衡', '主动额度仍只用于看得懂的公司', '把这次的触发过程写进复盘']
  }
]

/* ───────────────────────── 数据：日历与例行事务 ───────────────────────── */

interface CalEvent {
  date: string // YYYY-MM-DD
  label: string
  detail: string
  region: '美国' | '中国' | '个人'
  firm: boolean // true=官方已公布的固定日期；false=按往年规律估算
}

// 日期以官方发布为准；估算项标“约”。
const CALENDAR: CalEvent[] = [
  { date: '2026-10-14', label: '美股三季报季开启', detail: '大型银行先发，看拨备与消费信贷质量', region: '美国', firm: false },
  { date: '2026-10-27', label: 'FOMC 议息（10/27–28）', detail: '关注对降息路径与缩表的措辞', region: '美国', firm: true },
  { date: '2026-10-29', label: '大型科技财报密集周', detail: '微软、谷歌、Meta、亚马逊、苹果：看资本开支与AI回报', region: '美国', firm: false },
  { date: '2026-10-31', label: 'A股三季报披露截止', detail: '更新观察库与逻辑卡，为年度复盘收集材料', region: '中国', firm: true },
  { date: '2026-11-03', label: '美国中期选举', detail: '政策不确定性上升；只检查，不据此交易', region: '美国', firm: true },
  { date: '2026-11-06', label: '10月非农就业', detail: '更新“萨姆规则读数”与“初请”', region: '美国', firm: false },
  { date: '2026-11-12', label: '10月 CPI', detail: '看核心服务通胀是否回落', region: '美国', firm: false },
  { date: '2026-11-20', label: '英伟达财报', detail: 'AI算力需求的风向标', region: '美国', firm: false },
  { date: '2026-12-04', label: '11月非农就业', detail: '更新信号仪表盘', region: '美国', firm: false },
  { date: '2026-12-09', label: 'FOMC 议息（12/8–9）+ 点阵图', detail: '2027年利率路径的最重要一次沟通', region: '美国', firm: true },
  { date: '2026-12-15', label: '中央经济工作会议（约）', detail: '定下一年宏观政策基调', region: '中国', firm: false },
  { date: '2026-12-20', label: '检查明年资金需求', detail: '大额支出、应急、税费；决定2027年主动额度', region: '个人', firm: true },
  { date: '2026-12-31', label: '账户与税费整理', detail: '对账、整理持仓记录、移出长期无研究价值的标的', region: '个人', firm: true },
  { date: '2027-01-08', label: '12月非农就业', detail: '更新信号仪表盘', region: '美国', firm: false },
  { date: '2027-01-15', label: '年度复盘', detail: '用本页“年度复盘”页签，对照年初判断与实际', region: '个人', firm: true }
]

const MONTHLY_TASKS = [
  '更新「风险仪表盘」的六项信号',
  '核对备用金能覆盖几个月必要支出',
  '检查配置权重是否触及偏离阈值（到检查日才动）',
  '给本月每笔买卖补一条决策记录（37.4）',
  '主动持仓：有无证伪条件被触发？'
]
const YEAR_END_TASKS = [
  '算出全年净收益、费用、最大回撤',
  '对照年初判断，填写「年度复盘」',
  '确认2027年的主动额度（可以是零）',
  '检查应急储备与已知大额支出',
  '修订愿望账本（第38章）'
]

const FOCUS = new Set(['NVDA', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'AAPL', 'TSLA', 'AVGO', 'TSM', 'JPM', 'BAC', 'WFC', 'C', 'NFLX'])

/* ───────────────────────── 页签：总览 ───────────────────────── */

const PRINCIPLES = [
  { title: '不预测，先划线', body: '年初写下“某月会衰退”的剧本，错一次就全盘作废。现在改成：写下什么信号出现、我做什么，没出现就什么也不做。', icon: <Target size={20} /> },
  { title: '钱分三笔', body: '配置底仓管长期，主动额度管学习，备用金管生活。三笔钱互不借用，主动亏了不动底仓。', icon: <PieChart size={20} /> },
  { title: '动作写在事前', body: '再平衡有阈值，危机有回撤梯度，卖出有证伪条件。事到临头只执行，不重新讨论。', icon: <ShieldCheck size={20} /> }
]

const Overview: React.FC<{ stage: Stage; entered: number; today: Date; nextEvent?: CalEvent }> = ({ stage, entered, today, nextEvent }) => {
  const [total, setTotal] = usePersisted<string>('fund-total', '100')
  const [split, setSplit] = usePersisted<{ base: string; active: string; reserve: string }>('fund-split', { base: '75', active: '20', reserve: '5' })
  const [cap, setCap] = usePersisted<string>('fund-cap', '5')

  const t = num(total)
  const parts = [
    { key: 'base' as const, label: '配置底仓', tone: 'blue' as Tone, role: '长期主体，靠规则管理' },
    { key: 'active' as const, label: '主动额度', tone: 'yellow' as Tone, role: '研究与验证，可以为零' },
    { key: 'reserve' as const, label: '备用金', tone: 'green' as Tone, role: '生活与意外，不投股票' }
  ]
  const sum = parts.reduce((a, p) => a + (num(split[p.key]) || 0), 0)
  const quarter = Math.floor(today.getMonth() / 3) + 1
  const daysLeft = dayDiff(new Date(today.getFullYear(), 11, 31), today)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card title={`${today.getFullYear()} 年 Q${quarter} 收官：这一季只做三件事`} icon={<LayoutDashboard size={18} />} accent="var(--system-blue)">
        <div style={grid(220)}>
          {[
            ['1', '更新信号，确认阶段', `当前阶段「${stage.name}」${entered < 3 ? '（信号不足3项，暂不可靠）' : ''}`],
            ['2', '检查配置偏离与备用金', '到检查日再动，不因为单日涨跌动手'],
            ['3', '为年度复盘收集材料', `距年末还有 ${daysLeft} 天；三季报10/31前披露完`]
          ].map(([n, h, d]) => (
            <div key={n} style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--system-blue-light)', color: 'var(--system-blue)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{h}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.55 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
        {nextEvent && (
          <div style={{ marginTop: 16 }}>
            <Note>
              下一个关键节点：<b>{nextEvent.date.slice(5).replace('-', '月')}日 {nextEvent.label}</b>
              {nextEvent.firm ? '' : '（约）'}，还有 {dayDiff(new Date(nextEvent.date), today)} 天。{nextEvent.detail}。
            </Note>
          </div>
        )}
      </Card>

      <div style={grid(260)}>
        {PRINCIPLES.map(p => (
          <Card key={p.title}>
            <div style={{ color: 'var(--system-blue)', marginBottom: 8 }}>{p.icon}</div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{p.title}</div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{p.body}</div>
          </Card>
        ))}
      </div>

      <Card title="资金三笔钱" icon={<PieChart size={18} />}>
        <div style={{ ...grid(160), alignItems: 'end', marginBottom: 16 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            参考总额（万元）
            <input style={{ ...inputStyle, marginTop: 4 }} inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} />
          </label>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            单一主动标的上限（% 总额）
            <input style={{ ...inputStyle, marginTop: 4 }} inputMode="decimal" value={cap} onChange={e => setCap(e.target.value)} />
          </label>
        </div>
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['用途', '占比 %', '金额（万元）', '任务'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parts.map(p => (
                <tr key={p.key}>
                  <td style={tdStyle}><Pill tone={p.tone}>{p.label}</Pill></td>
                  <td style={{ ...tdStyle, width: 110 }}>
                    <input style={inputStyle} inputMode="decimal" value={split[p.key]} onChange={e => setSplit(s => ({ ...s, [p.key]: e.target.value }))} />
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtMoney((t * (num(split[p.key]) || 0)) / 100)}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{p.role}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...tdStyle, fontWeight: 700 }}>单一主动标的上限</td>
                <td style={tdStyle}>{cap}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtMoney((t * (num(cap) || 0)) / 100)}</td>
                <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>上限而非目标，分母是参考总额</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Math.abs(sum - 100) > 0.01 && <Note tone="red">三项占比合计 {sum}%，应为 100%。</Note>}
          <Note tone="gray">75 / 20 / 5 是书中第9章的作者案例，不是通用比例。已知近期大额支出与自住房不计入参考总额；主动额度可以从零开始。底仓怎么搭，见第9章9.10的宽基三档模板（下方「再平衡检查器」可直接套用）。</Note>
        </div>
      </Card>
    </div>
  )
}

/* ───────────────────────── 页签：配置与纪律 ───────────────────────── */

interface Holding {
  id: string
  name: string
  role: string
  target: string // 底仓内目标占比 %
  band: string // 相对偏离阈值 %
  amount: string // 当前金额
}

// 书第9章9.10「先用宽基搭底仓」：权益占比是档位旋钮，权益内 A股宽基60%、标普500 30%、红利10%。
const broad = (equity: number): Holding[] => [
  { id: 'h1', name: 'A股宽基', role: '本土权益核心（沪深300、中证800这类）', target: String(equity * 0.6), band: '25', amount: '' },
  { id: 'h2', name: '标普500', role: '境外宽基，先查额度、溢价与汇率', target: String(equity * 0.3), band: '25', amount: '' },
  { id: 'h3', name: '红利低波', role: '风格倾斜，不替代宽基', target: String(equity * 0.1), band: '25', amount: '' },
  { id: 'h4', name: '中短债/纯债', role: '稳定与缓冲，查久期与信用', target: String(100 - equity), band: '25', amount: '' }
]
const TEMPLATES: Array<{ id: string; label: string; rows: Holding[] }> = [
  { id: 'conservative', label: '保守档', rows: broad(30) },
  { id: 'balanced', label: '均衡档', rows: broad(50) },
  { id: 'aggressive', label: '积极档', rows: broad(70) },
  // 作者本人的五项等权案例，含主题指数恒生科技；书第9章9.2说明了它的问题，保留作对照
  { id: 'author', label: '作者案例', rows: [
    { id: 'h1', name: '红利低波', role: '现金流与低波动权益', target: '20', band: '25', amount: '' },
    { id: 'h2', name: '纯债基金', role: '稳定与缓冲', target: '20', band: '25', amount: '' },
    { id: 'h3', name: '标普500', role: '境外权益', target: '20', band: '25', amount: '' },
    { id: 'h4', name: '黄金ETF', role: '对冲货币与通胀', target: '20', band: '25', amount: '' },
    { id: 'h5', name: '恒生科技', role: '主题指数（书中建议放主动额度）', target: '20', band: '35', amount: '' }
  ] }
]
const DEFAULT_HOLDINGS: Holding[] = TEMPLATES[1].rows

const RULES = [
  '不借钱、不加杠杆、不融资买入',
  '备用金不投股票，也不用来补仓',
  '主动亏损不动用配置底仓，各管各的',
  '单一主动标的不超过参考总额的4%到5%',
  '再平衡只在检查日做，用相对偏离阈值判断',
  '没看懂的不买；买入前写好证伪条件',
  '不依据宏观预测买卖（第16章），宏观只用来检查预算'
]

const Allocation: React.FC = () => {
  const [rows, setRows] = usePersisted<Holding[]>('holdings', DEFAULT_HOLDINGS)

  const total = rows.reduce((a, r) => a + (num(r.amount) || 0), 0)
  const targetSum = rows.reduce((a, r) => a + (num(r.target) || 0), 0)
  const patch = (id: string, k: keyof Holding, v: string) => setRows(rs => rs.map(r => (r.id === id ? { ...r, [k]: v } : r)))

  const computed = rows.map(r => {
    const tgt = num(r.target)
    const band = num(r.band)
    const cur = total > 0 ? ((num(r.amount) || 0) / total) * 100 : NaN
    const dev = Number.isFinite(cur) && tgt > 0 ? ((cur - tgt) / tgt) * 100 : NaN
    const hit = Number.isFinite(dev) && Number.isFinite(band) && Math.abs(dev) > band
    const gap = total > 0 && Number.isFinite(tgt) ? (tgt / 100) * total - (num(r.amount) || 0) : NaN
    return { r, cur, dev, hit, gap }
  })
  const anyHit = computed.some(c => c.hit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card
        title="再平衡检查器"
        icon={<PieChart size={18} />}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnStyle()} onClick={() => setRows(rs => [...rs, { id: `h${Date.now()}`, name: '新资产', role: '', target: '', band: '25', amount: '' }])}>
              <Plus size={14} /> 添加
            </button>
            {TEMPLATES.map(t => (
              <button key={t.id} style={btnStyle()} onClick={() => setRows(t.rows)} title={`换成「${t.label}」示例（会覆盖当前填写）`}>
                {t.id === 'balanced' && <RotateCcw size={14} />} {t.label}
              </button>
            ))}
          </div>
        }
      >
        <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          只在配置底仓内部检查。填入各项当前金额，偏离按「相对目标」计算：目标20%、阈值±25%，则15%到25%之间不动。默认是书第9章9.10的宽基均衡档（权益50%），可换保守、积极档，或对照作者本人的五项案例；都可以直接改成你自己的。数据只保存在本机浏览器。
        </p>
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['资产', '角色', '目标 %', '阈值 ±%', '当前金额', '当前占比', '相对偏离', '状态 / 回到目标需', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computed.map(({ r, cur, dev, hit, gap }) => (
                <tr key={r.id}>
                  <td style={{ ...tdStyle, minWidth: 120 }}><input style={inputStyle} aria-label={`资产名称 ${r.name}`} value={r.name} onChange={e => patch(r.id, 'name', e.target.value)} /></td>
                  <td style={{ ...tdStyle, minWidth: 140 }}><input style={inputStyle} value={r.role} onChange={e => patch(r.id, 'role', e.target.value)} /></td>
                  <td style={{ ...tdStyle, width: 80 }}><input style={inputStyle} aria-label={`目标占比 ${r.name}`} inputMode="decimal" value={r.target} onChange={e => patch(r.id, 'target', e.target.value)} /></td>
                  <td style={{ ...tdStyle, width: 80 }}><input style={inputStyle} inputMode="decimal" value={r.band} onChange={e => patch(r.id, 'band', e.target.value)} /></td>
                  <td style={{ ...tdStyle, width: 110 }}><input style={inputStyle} inputMode="decimal" placeholder="万元" value={r.amount} onChange={e => patch(r.id, 'amount', e.target.value)} /></td>
                  <td style={tdStyle}>{fmtPct(cur)}</td>
                  <td style={tdStyle}>{Number.isFinite(dev) ? `${dev > 0 ? '+' : ''}${dev.toFixed(1)}%` : '—'}</td>
                  <td style={tdStyle}>
                    {!Number.isFinite(dev) ? (
                      <Pill tone="gray">待填写</Pill>
                    ) : hit ? (
                      <Pill tone="red">{gap > 0 ? `超出阈值，需买入 ${fmtMoney(gap)}` : `超出阈值，需卖出 ${fmtMoney(-gap)}`}</Pill>
                    ) : (
                      <Pill tone="green">区间内</Pill>
                    )}
                  </td>
                  <td style={{ ...tdStyle, width: 44 }}>
                    <button aria-label="删除" style={{ ...btnStyle(), padding: 6 }} onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Math.abs(targetSum - 100) > 0.01 && <Note tone="red">目标占比合计 {targetSum}%，应为 100%。</Note>}
          {total > 0 && (
            <Note tone={anyHit ? 'yellow' : 'green'}>
              {anyHit ? '有资产超出阈值：按“回到目标需…”的金额调整，且只在检查日、只用底仓内资金，不动备用金和主动额度。' : '全部在区间内，今天什么也不用做。'}
            </Note>
          )}
          <Note tone="gray">权重不等于风险：权益的波动远大于债券，底仓的波动几乎全部来自权益（书9.7的风险贡献表）。真正调风险的旋钮是权益占多少；主题指数（如恒生科技）放主动额度，不放底仓。</Note>
        </div>
      </Card>

      <div style={grid(300)}>
        <Card title="不可越过的红线" icon={<Ban size={18} />} accent="var(--system-red)">
          <Bullets items={RULES} tone="red" />
        </Card>
        <Card title="主动额度的使用条件" icon={<ShieldCheck size={18} />} accent="var(--system-orange)">
          <Bullets
            tone="yellow"
            items={[
              '一家一张决策记录：买入理由、估值假设、证伪条件、下一次验证事项',
              '合计压力损失先对照预算，再看单家金额；同一产业链的几家算作一类风险',
              '观察池10到20家，持仓3到5家，数量服从维护能力，不为凑数买陌生公司',
              '连续两年做不到时间预算，就把主动额度降到5%或零（18.10）'
            ]}
          />
        </Card>
      </div>
    </div>
  )
}

/* ───────────────────────── 页签：风险仪表盘 ───────────────────────── */

const Dashboard: React.FC<{
  values: Record<string, string>
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  updated: string
  setUpdated: (s: string) => void
}> = ({ values, setValues, updated, setUpdated }) => {
  const { stage, entered, score } = computeStage(values)
  const set = (id: string, v: string) => {
    setValues(p => ({ ...p, [id]: v }))
    setUpdated(new Date().toISOString().slice(0, 10))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card
        title="信号仪表盘"
        icon={<Gauge size={18} />}
        right={<span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{updated ? `上次更新 ${updated}` : '尚未填写'}</span>}
      >
        <Note>旧版把1月的读数写死在页面里，现在已过期。这里改为你自己填当前值，页面按阈值给出颜色并折算阶段。数据只保存在本机浏览器。</Note>
        <div style={{ ...tableWrapperStyle, marginTop: 14 }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['信号', '当前值', '预警 ≥', '危险 ≥', '状态', '数据来源'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIGNALS.map(s => {
                const v = num(values[s.id] ?? '')
                const tone = signalTone(s, v)
                return (
                  <tr key={s.id}>
                    <td style={{ ...tdStyle, minWidth: 200 }}>
                      <div style={{ fontWeight: 700 }}>{s.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{s.hint}</div>
                    </td>
                    <td style={{ ...tdStyle, width: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input style={inputStyle} inputMode="decimal" value={values[s.id] ?? ''} onChange={e => set(s.id, e.target.value)} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{s.unit}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{s.yellow}</td>
                    <td style={tdStyle}>{s.red}</td>
                    <td style={tdStyle}>
                      <Pill tone={tone}>{tone === 'gray' ? '未填' : tone === 'green' ? '正常' : tone === 'yellow' ? '预警' : '危险'}</Pill>
                    </td>
                    <td style={{ ...tdStyle, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.source}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`当前阶段：${stage.name}`} icon={<AlertTriangle size={18} />} accent={TONE[stage.tone].fg}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <Pill tone={stage.tone}>阶段 {stage.level}</Pill>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>已填 {entered}/{SIGNALS.length} 项 · 风险分 {score}（危险计2分，预警计1分）</span>
        </div>
        {entered < 3 ? (
          <Note tone="yellow">至少填写3项信号后，阶段判断才有参考意义。</Note>
        ) : (
          <>
            <p style={{ margin: '0 0 14px', fontSize: '0.92rem', lineHeight: 1.7 }}>{stage.summary}</p>
            <div style={grid(280)}>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--system-green)', marginBottom: 8, fontSize: '0.9rem' }}>要做</div>
                <Bullets items={stage.does} tone="green" />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--system-red)', marginBottom: 8, fontSize: '0.9rem' }}>不做</div>
                <Bullets items={stage.doesNot} tone="red" />
              </div>
            </div>
          </>
        )}
        <div style={{ marginTop: 14 }}>
          <Note tone="gray">阶段用来检查风险预算，不是择时信号。旧版的“做空 PSQ/SH、加杠杆ETF”整套打法已删除，与“不预测、不加杠杆”的原则相悖。</Note>
        </div>
      </Card>

      <div style={grid(520)}>
        <Card title="回撤梯度：危机时怎么补" icon={<ShieldCheck size={18} />}>
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['标普自高点', '动作', '细则'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {DRAWDOWN_LADDER.map(r => (
                  <tr key={r.dd}>
                    <td style={{ ...tdStyle, fontWeight: 800, color: 'var(--system-red)', whiteSpace: 'nowrap' }}>{r.dd}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.step}</td>
                    <td style={{ ...tdStyle, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}>
            <Note tone="gray">梯度是起点示例，请按你的备用金与风险承受力改写。每一档之间至少隔1到2周。</Note>
          </div>
        </Card>
      </div>

      <div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 12px' }}>四种情景的预案</h3>
        <div style={grid(250)}>
          {SCENARIOS.map(s => (
            <Card key={s.name} accent={TONE[s.tone].fg}>
              <div style={{ fontWeight: 800, marginBottom: 10, color: TONE[s.tone].fg }}>{s.name}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>观察信号</div>
              <Bullets items={s.watch} tone={s.tone} />
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '12px 0 4px' }}>历史倾向（不是预测）</div>
              <div style={{ fontSize: '0.86rem', lineHeight: 1.65 }}>{s.effect}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '12px 0 4px' }}>预案动作</div>
              <Bullets items={s.act} tone={s.tone} />
            </Card>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Note tone="gray">旧版给各情景标了 60% / 45% / 30% / 25% 的概率，没有依据，已删除。情景不排序、不给概率，只对照信号。</Note>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── 页签：日历与财报 ───────────────────────── */

const CalendarTab: React.FC<{ today: Date }> = ({ today }) => {
  const [checked, setChecked] = usePersisted<Record<string, boolean>>('checks', {})
  const [days, setDays] = useState<7 | 14>(7)
  const [earnings, setEarnings] = useState<EarningsCalendarItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const toggle = (id: string) => setChecked(p => ({ ...p, [id]: !p[id] }))

  const load = (d: number) => {
    setLoading(true)
    setError('')
    fetchEarningsCalendar(d)
      .then(setEarnings)
      .catch(() => {
        setEarnings([])
        setError('财报数据获取失败，可稍后重试或直接打开 TradingView。')
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load(days)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const sorted = useMemo(
    () =>
      [...earnings].sort((a, b) => {
        const fa = FOCUS.has(a.symbol) ? 0 : 1
        const fb = FOCUS.has(b.symbol) ? 0 : 1
        return a.date === b.date ? fa - fb : a.date.localeCompare(b.date)
      }),
    [earnings]
  )

  const Task: React.FC<{ id: string; text: string }> = ({ id, text }) => (
    <li
      onClick={() => toggle(id)}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1.6, color: checked[id] ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: checked[id] ? 'line-through' : 'none' }}
    >
      {checked[id] ? <CheckCircle2 size={18} style={{ color: 'var(--system-green)', flexShrink: 0, marginTop: 2 }} /> : <Circle size={18} style={{ color: 'var(--system-gray3)', flexShrink: 0, marginTop: 2 }} />}
      {text}
    </li>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card title="Q4 2026 – 2027 年初 事件日历" icon={<CalendarDays size={18} />}>
        <div style={{ position: 'relative', paddingLeft: 22 }}>
          <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 2, background: 'var(--system-gray5)' }} />
          {CALENDAR.map(e => {
            const diff = dayDiff(new Date(e.date), today)
            const past = diff < 0
            const soon = diff >= 0 && diff <= 14
            const tone: Tone = past ? 'gray' : soon ? 'red' : e.region === '个人' ? 'green' : 'blue'
            return (
              <div key={e.date + e.label} style={{ position: 'relative', padding: '8px 0 14px', opacity: past ? 0.5 : 1 }}>
                <span style={{ position: 'absolute', left: -21, top: 14, width: 10, height: 10, borderRadius: '50%', background: TONE[tone].fg, boxShadow: '0 0 0 3px white' }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{e.date.slice(5).replace('-', '/')}{e.firm ? '' : ' 约'}</span>
                  <span style={{ fontWeight: 700 }}>{e.label}</span>
                  <Pill tone={e.region === '个人' ? 'green' : e.region === '中国' ? 'yellow' : 'blue'}>{e.region}</Pill>
                  {soon && <Pill tone="red">{diff === 0 ? '今天' : `${diff} 天后`}</Pill>}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 3 }}>{e.detail}</div>
              </div>
            )
          })}
        </div>
        <Note tone="gray">标「约」的是按往年规律估算，美国数据日期以 BLS、美联储、公司公告为准；A股披露截止日依据证监会现行规则，具体到公司看公告。</Note>
      </Card>

      <div style={grid(320)}>
        <Card title={`本月例行（${ym}）`} icon={<ClipboardCheck size={18} />} accent="var(--system-blue)">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MONTHLY_TASKS.map((t, i) => <Task key={t} id={`m-${ym}-${i}`} text={t} />)}
          </ul>
        </Card>
        <Card title={`${today.getFullYear()} 年末例行`} icon={<ClipboardCheck size={18} />} accent="var(--system-green)">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {YEAR_END_TASKS.map((t, i) => <Task key={t} id={`y-${today.getFullYear()}-${i}`} text={t} />)}
          </ul>
        </Card>
      </div>

      <Card
        title="未来财报（美股，实时）"
        icon={<Thermometer size={18} />}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {([7, 14] as const).map(d => (
              <button key={d} style={{ ...btnStyle(days === d) }} onClick={() => setDays(d)}>未来{d}天</button>
            ))}
            <button style={btnStyle()} onClick={() => load(days)} disabled={loading}>
              <RefreshCw size={14} /> 刷新
            </button>
            <a href="https://www.tradingview.com/markets/earnings/" target="_blank" rel="noopener noreferrer" style={{ ...btnStyle(), textDecoration: 'none' }}>
              <ExternalLink size={14} /> TradingView
            </a>
          </div>
        }
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>正在同步…</div>
        ) : error ? (
          <Note tone="red">{error}</Note>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>该时间段没有数据</div>
        ) : (
          <div style={{ ...tableWrapperStyle, marginTop: 0, maxHeight: 480, overflowY: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['日期', '时段', '代码', '公司', '市值', 'EPS 预期', '营收预期'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {sorted.map(e => (
                  <tr key={e.symbol + e.date} style={{ background: FOCUS.has(e.symbol) ? 'var(--system-blue-light)' : undefined }}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td style={tdStyle}>{e.time || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>{e.symbol}</td>
                    <td style={tdStyle}>{e.name}</td>
                    <td style={tdStyle}>{e.marketCap || '—'}</td>
                    <td style={tdStyle}>{e.epsEstimate || '—'}</td>
                    <td style={tdStyle}>{e.revenueEstimate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <Note tone="gray">蓝色高亮为大型科技与大行。看财报只为更新持仓的经营依据与上面的信号，不为“赌财报”。</Note>
        </div>
      </Card>
    </div>
  )
}

/* ───────────────────────── 页签：情绪工具 ───────────────────────── */

interface Reading {
  tone: Tone
  title: string
  body: string
}

function classifySentiment(eq: number, spx: number): Reading {
  if (eq >= 1.2) return { tone: 'green', title: '极度恐惧', body: '散户几乎都在买保险或割肉，历史上常对应情绪低点区。只检查备用金和回撤梯度，不要一次性重仓。' }
  if (eq >= 1.1 && spx >= 1.1) return { tone: 'yellow', title: '全市场买保险', body: '恐惧升温但仍有人在抵抗。等待 Equity P/C 继续上升，或 SPX P/C 回落（机构开始投降）。' }
  if (eq < 0.7) {
    if (spx >= 1.2) return { tone: 'yellow', title: '贪婪，但机构有保护', body: '散户狂欢而机构对冲充足，短期不易断崖。不追高，不加仓。' }
    if (spx >= 0.85) return { tone: 'red', title: '贪婪，且保护变薄', body: '指数保险在减少。检查高波动仓位的占比，避免过度暴露。' }
    return { tone: 'red', title: '贪婪且无保护', body: '情绪过热、机构又撤掉了对冲，容易被一条坏消息引爆。核对备用金，确认没有杠杆。' }
  }
  if (eq < 1.0 && spx < 0.8) return { tone: 'red', title: '踩踏中', body: '无保护状态下的抛售。忍耐，保持现金，等 Equity P/C 继续飙升再评估。' }
  if (eq >= 0.8 && eq < 1.0 && spx >= 0.9 && spx < 1.0) return { tone: 'green', title: '筑底迹象', body: '机构不再恐慌买保险，散户恐慌也在平复，空头动能衰竭。按既定规则持有即可。' }
  return { tone: 'gray', title: '中性区', body: '没有明显极端情绪，继续按计划执行。' }
}

const Sentiment: React.FC = () => {
  const [eq, setEq] = useState('')
  const [spx, setSpx] = useState('')
  const [vixNear, setVixNear] = useState('')
  const [vixFar, setVixFar] = useState('')
  const [gex, setGex] = useState('')
  const [gs, setGs] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [asOf, setAsOf] = useState('')

  // 服务端并行拉取 CBOE、SqueezeMetrics、雅虎财经，一次返回；单项失败不影响其他项，仍可手动改
  const fetchAll = async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`${API_BASE}/api/sentiment`, { cache: 'no-store' })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d) throw new Error()
      const put = (v: number | null, set: (s: string) => void) => { if (v !== null && Number.isFinite(v)) set(String(v)) }
      put(d.equityPC, setEq); put(d.spxPC, setSpx); put(d.vix, setVixNear); put(d.vix3m, setVixFar); put(d.gexBn, setGex); put(d.goldSilver, setGs)
      setAsOf([d.pcDate && `P/C ${d.pcDate}`, d.vixDate && `VIX ${d.vixDate}`, d.gexDate && `GEX ${d.gexDate}`, d.goldSilverDate && `金银比 ${d.goldSilverDate}`].filter(Boolean).join(' · '))
      if (d.warnings?.length) setMsg(`部分读数未取到（${d.warnings.join('；')}），可手动填入。`)
    } catch {
      setMsg('自动获取失败，可稍后重试，或到 CBOE 页面手动查看后填入。')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void fetchAll() }, [])

  const e = num(eq)
  const s = num(spx)
  const reading = Number.isFinite(e) && Number.isFinite(s) ? classifySentiment(e, s) : null

  const extras: string[] = []
  const vn = num(vixNear)
  const vf = num(vixFar)
  if (Number.isFinite(vn) && Number.isFinite(vf)) {
    extras.push(vn > vf ? 'VIX 期限结构倒挂：短期恐慌高于远期，历史上多出现在剧烈下跌期。' : vn >= vf * 0.9 ? 'VIX 期限结构接近倒挂，需要留意。' : 'VIX 期限结构正常。')
  }
  const g = num(gex)
  if (Number.isFinite(g)) {
    extras.push(g < 0 ? 'Net GEX 为负：做市商对冲可能放大涨跌，波动更剧烈。' : g < 10 ? 'Net GEX 接近零轴，稳定性下降。' : 'Net GEX 为高正值，波动通常较受抑制。')
  }
  const r = num(gs)
  if (Number.isFinite(r)) {
    extras.push(r >= 90 ? '金银比 ≥90：白银相对黄金极便宜，历史上偏向白银的低位区。' : r >= 85 ? '金银比 ≥85：白银相对偏便宜。' : r < 70 ? '金银比 <70：白银已明显走强，追高需谨慎。' : '金银比处于常见区间（70–85）。')
  }

  const field = (label: string, v: string, set: (s: string) => void, ph: string) => (
    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
      {label}
      <input style={{ ...inputStyle, marginTop: 4 }} inputMode="decimal" placeholder={ph} value={v} onChange={ev => set(ev.target.value)} />
    </label>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card
        title="期权情绪解读"
        icon={<Thermometer size={18} />}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnStyle(true)} onClick={fetchAll} disabled={loading}>
              <RefreshCw size={14} /> {loading ? '获取中…' : '刷新全部'}
            </button>
            <a href="https://www.cboe.com/us/options/market_statistics/daily/" target="_blank" rel="noopener noreferrer" style={{ ...btnStyle(), textDecoration: 'none' }}>
              <ExternalLink size={14} /> CBOE
            </a>
          </div>
        }
      >
        <div style={{ ...grid(150), marginBottom: 12 }}>
          {field('Equity P/C（个股）', eq, setEq, '如 0.64')}
          {field('SPX P/C（指数）', spx, setSpx, '如 1.05')}
          {field('VIX（30天）', vixNear, setVixNear, '可选')}
          {field('VIX3M（3个月）', vixFar, setVixFar, '可选')}
          {field('Net GEX（十亿美元）', gex, setGex, '可选')}
          {field('金银比', gs, setGs, '可选')}
        </div>
        {asOf && <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>数据日期（美东）：{asOf}。来源：CBOE 日度期权统计、SqueezeMetrics（GEX）、雅虎财经（VIX、VIX3M、金银期货）；P/C 与 GEX 为上一交易日收盘数据。</p>}
        {msg && <Note tone="yellow">{msg}</Note>}
        {reading ? (
          <div style={{ marginTop: 12 }}>
            <Card accent={TONE[reading.tone].fg} style={{ boxShadow: 'none' }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: TONE[reading.tone].fg, marginBottom: 6 }}>{reading.title}</div>
              <div style={{ lineHeight: 1.75, fontSize: '0.92rem' }}>{reading.body}</div>
              {extras.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--system-gray5)' }}>
                  <Bullets items={extras} />
                </div>
              )}
            </Card>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <Note tone="gray">填入 Equity P/C 与 SPX P/C（或点击自动获取）即可得到解读。</Note>
          </div>
        )}
      </Card>

      <Card title="读数怎么看" icon={<Info size={18} />}>
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>{['指标', '低', '高', '含义'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {[
                ['Equity P/C', '<0.7 贪婪', '>1.1 恐惧，≥1.2 极度恐惧', '散户情绪温度计，越极端越偏反向指标'],
                ['SPX P/C', '<0.85 保护变薄', '>1.2 机构对冲充足', '机构有没有穿“防弹衣”'],
                ['VIX 期限结构', '近月>远月＝倒挂', '远月>近月＝正常', '倒挂多见于剧烈下跌期'],
                ['Net GEX', '<0 波动放大', '高正值 波动受抑', '做市商对冲带来的放大或抑制']
              ].map(r => (
                <tr key={r[0]}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{r[0]}</td>
                  <td style={tdStyle}>{r[1]}</td>
                  <td style={tdStyle}>{r[2]}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12 }}>
          <Note tone="gray">情绪读数只是辅助：它不触发买卖，只用来提醒你“现在是不是想做点什么”。真正的动作仍来自再平衡阈值与回撤梯度。</Note>
        </div>
      </Card>
    </div>
  )
}

/* ───────────────────────── 页签：年度复盘 ───────────────────────── */

type Verdict = '' | '对' | '部分对' | '错' | '没发生'
interface ReviewRow {
  id: string
  call: string
  actual: string
  verdict: Verdict
}

const OLD_CALLS: ReviewRow[] = [
  { id: 'r1', call: '2026上半年出现经济衰退，失业率连续3个月上升且合计≥0.5pp', actual: '', verdict: '' },
  { id: 'r2', call: '3月FOMC点阵图显示2026年降息少于2次，股债双杀', actual: '', verdict: '' },
  { id: 'r3', call: '区域银行与商业地产在4–7月集中暴雷（KRE跌破$40）', actual: '', verdict: '' },
  { id: 'r4', call: '5月美联储主席换届，VIX飙升至30以上', actual: '', verdict: '' },
  { id: 'r5', call: '纳指自高点回撤20%–40%，做空PSQ/SH可获利', actual: '', verdict: '' },
  { id: 'r6', call: 'AI财报季：3家以上超预期则AI续命，2家踩雷则科技见顶', actual: '', verdict: '' },
  { id: 'r7', call: '8–9月标普回撤>30%，进入抄底窗口', actual: '', verdict: '' }
]

const NUMBERS = ['全年净收益（扣费后）', '全年总费用', '最大回撤', '配置 vs 主动：收益来源']

const Review: React.FC = () => {
  const [rows, setRows] = usePersisted<ReviewRow[]>('review-rows', OLD_CALLS)
  const [nums, setNums] = usePersisted<Record<string, string>>('review-nums', {})
  const [lessons, setLessons] = usePersisted<string>('review-lessons', '')
  const patch = (id: string, k: 'actual' | 'verdict', v: string) => setRows(rs => rs.map(r => (r.id === id ? { ...r, [k]: v } : r)))
  const judged = rows.filter(r => r.verdict)
  const right = judged.filter(r => r.verdict === '对').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card title="年初的判断，对照实际" icon={<ClipboardCheck size={18} />} accent="var(--system-purple)"
        right={judged.length > 0 ? <Pill tone={right / judged.length >= 0.5 ? 'green' : 'red'}>已评 {judged.length} 项 · 完全判对 {right} 项</Pill> : undefined}
      >
        <p style={{ margin: '0 0 12px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          下面是旧版计划书里的七条核心判断。页面不替你填“实际发生了什么”：请对照真实行情逐条评分。无论结果如何，这张表的价值是：看清自己的预测命中率，决定下一年还要不要把仓位押在预测上。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map(r => (
            <div key={r.id} style={{ border: '1px solid var(--system-gray5)', borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 10, lineHeight: 1.6 }}>{r.call}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 130px', gap: 10 }}>
                <input style={inputStyle} placeholder="实际发生了什么？" value={r.actual} onChange={e => patch(r.id, 'actual', e.target.value)} />
                <select style={inputStyle} value={r.verdict} onChange={e => patch(r.id, 'verdict', e.target.value)}>
                  {['', '对', '部分对', '错', '没发生'].map(v => <option key={v} value={v}>{v || '评分'}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={grid(320)}>
        <Card title="年度数字" icon={<Gauge size={18} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {NUMBERS.map(n => (
              <label key={n} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {n}
                <input style={{ ...inputStyle, marginTop: 4 }} value={nums[n] ?? ''} onChange={e => setNums(p => ({ ...p, [n]: e.target.value }))} />
              </label>
            ))}
          </div>
        </Card>
        <Card title="这一年学到什么" icon={<ShieldCheck size={18} />}>
          <textarea
            style={{ ...inputStyle, minHeight: 190, resize: 'vertical', lineHeight: 1.7 }}
            placeholder={'1. 哪些规则执行了？哪些没执行？为什么？\n2. 哪次决定最后悔，当时的记录怎么写的？\n3. 明年要改的一条规则是什么？'}
            value={lessons}
            onChange={e => setLessons(e.target.value)}
          />
        </Card>
      </div>
      <Note tone="gray">复盘内容只保存在本机浏览器。更换设备或清除浏览器数据会丢失，重要结论请另行记录到统一决策记录（37.4）。</Note>
    </div>
  )
}

/* ───────────────────────── 页面 ───────────────────────── */

type TabId = 'overview' | 'allocation' | 'dashboard' | 'calendar' | 'sentiment' | 'review'
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '总览', icon: <LayoutDashboard size={17} /> },
  { id: 'allocation', label: '配置与纪律', icon: <PieChart size={17} /> },
  { id: 'dashboard', label: '风险仪表盘', icon: <Gauge size={17} /> },
  { id: 'calendar', label: '日历与财报', icon: <CalendarDays size={17} /> },
  { id: 'sentiment', label: '情绪工具', icon: <Thermometer size={17} /> },
  { id: 'review', label: '年度复盘', icon: <ClipboardCheck size={17} /> }
]

const InvestmentPlan2026 = () => {
  const [tab, setTab] = useState<TabId>('overview')
  const [signals, setSignals] = usePersisted<Record<string, string>>('signals', {})
  const [updated, setUpdated] = usePersisted<string>('signals-updated', '')
  const today = useMemo(() => new Date(), [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const { stage, entered } = computeStage(signals)
  const nextEvent = CALENDAR.find(e => dayDiff(new Date(e.date), today) >= 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'var(--font-family)' }}>
      <PageTitle>2026 投资计划</PageTitle>
      <PageTabs label="2026 投资计划栏目" items={TABS} value={tab} onChange={setTab} />
      <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '0 16px 64px', boxSizing: 'border-box' }}>
      <div className="page-toolbar">
        <span className="page-toolbar__note">不预测，先划线：用事前写好的规则代替年初的剧本</span>
        <span>风险阶段：<b style={{ color: 'var(--text-primary)' }}>{entered < 3 ? '待填写' : stage.name}</b></span>
        <span>修订：2026-10-04</span>
      </div>
      <details style={{ margin: '-6px 0 20px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        <summary style={{ cursor: 'pointer' }}>修订说明</summary>
        旧版是1月写成的“衰退预警 + 做空”月度剧本，多数日期与读数已过期，也与“不预测、不加杠杆”的原则冲突。本版保留有用的工具（财报日历、情绪解读），其余改为情景触发、风险预算和年度复盘。
      </details>

      {tab === 'overview' && <Overview stage={stage} entered={entered} today={today} nextEvent={nextEvent} />}
      {tab === 'allocation' && <Allocation />}
      {tab === 'dashboard' && <Dashboard values={signals} setValues={setSignals} updated={updated} setUpdated={setUpdated} />}
      {tab === 'calendar' && <CalendarTab today={today} />}
      {tab === 'sentiment' && <Sentiment />}
      {tab === 'review' && <Review />}

      <p style={{ marginTop: 32, fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.7 }}>
        本页为个人投资纪律与学习工具，阈值与比例均为示例，不构成投资建议。投资有风险，决策请结合自身情况。
      </p>
      </div>
    </div>
  )
}

export default InvestmentPlan2026
