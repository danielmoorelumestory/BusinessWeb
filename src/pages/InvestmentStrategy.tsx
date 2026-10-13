import React, { useState, useEffect } from 'react'
import { PageTabs, PageTitle } from '../components/ui/PageTabs'
import {
  TrendingUp,
  Globe,
  BarChart2,
  Shield,
  Target,
  CheckCircle2,
  AlertTriangle,
  Layers,
  RefreshCw,
  ArrowRight,
  Clock,
  Zap,
  Star
} from 'lucide-react'

type TabId = 'dna' | 'cycle' | 'filter' | 'execute' | 'risk'

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dna', label: '策略基因', icon: Layers },
  { id: 'cycle', label: '周期定位', icon: RefreshCw },
  { id: 'filter', label: '选股过滤', icon: Target },
  { id: 'execute', label: '执行系统', icon: Zap },
  { id: 'risk', label: '风控体系', icon: Shield },
]

export default function InvestmentStrategy(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('dna')
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    const handleScroll = () => setShowBackToTop(window.scrollY > 400)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const card: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px 28px',
    marginBottom: '16px',
    boxShadow: 'var(--shadow-md)',
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '16px',
  }

  const badge = (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-block',
    fontSize: '12px',
    padding: '3px 10px',
    borderRadius: '6px',
    marginRight: '6px',
    marginBottom: '6px',
    background: bg,
    color,
    fontWeight: 500,
  })

  const divider: React.CSSProperties = {
    border: 'none',
    borderTop: '0.5px solid var(--border-primary)',
    margin: '24px 0',
  }

  const checkRow = (children: React.ReactNode, accent: string): JSX.Element => (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
      <CheckCircle2 size={16} color={accent} style={{ flexShrink: 0, marginTop: '2px' }} />
      <span>{children}</span>
    </div>
  )

  const flowStep = (num: number, children: React.ReactNode): JSX.Element => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'color-mix(in srgb, var(--system-blue) 12%, transparent)', color: 'var(--system-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
        {num}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', paddingTop: '4px', lineHeight: 1.7 }}>{children}</div>
    </div>
  )

  const metricCard = (label: string, value: string): JSX.Element => (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{value}</p>
    </div>
  )

  return (
    <main className="container animate-fade-in page-shell">
      <PageTitle desc="巴菲特 · 邓普顿 · 双阶段轮动">综合投资策略框架</PageTitle>
      <PageTabs label="策略框架栏目" width={760} value={activeTab} onChange={setActiveTab}
        items={tabs.map(t => ({ id: t.id, label: t.label, icon: <t.icon size={14} /> }))} />

      {/* 内容区 */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '28px 20px' }}>

        {/* ── 策略基因 ── */}
        {activeTab === 'dna' && (
          <div>
            <p style={sectionTitle}>三位智慧的融合</p>

            {/* 巴菲特 */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <TrendingUp size={18} color="var(--system-blue)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>巴菲特的贡献</h3>
              </div>
              <div style={{ borderLeft: '2px solid var(--border-primary)', paddingLeft: '14px', marginBottom: '14px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 4px', lineHeight: 1.7 }}>
                  "别人贪婪时我恐惧，别人恐惧时我贪婪"
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>— 沃伦·巴菲特</p>
              </div>
              <div>
                {['护城河筛选', '长期持有', '现金流优先', '管理层诚信'].map(t => (
                  <span key={t} style={badge('color-mix(in srgb, var(--system-blue) 10%, transparent)', 'var(--system-blue)')}>{t}</span>
                ))}
              </div>
            </div>

            {/* 邓普顿 */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Globe size={18} color="var(--system-teal)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>邓普顿的贡献</h3>
              </div>
              <div style={{ borderLeft: '2px solid var(--border-primary)', paddingLeft: '14px', marginBottom: '14px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 4px', lineHeight: 1.7 }}>
                  "在最大悲观点买入，在最大乐观点卖出"
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>— 约翰·邓普顿</p>
              </div>
              <div>
                {['全球视野', '极度逆向', '困境反转', '估值底部'].map(t => (
                  <span key={t} style={badge('color-mix(in srgb, var(--system-teal) 15%, transparent)', 'var(--system-teal)')}>{t}</span>
                ))}
              </div>
            </div>

            {/* 双阶段轮动（重点卡片） */}
            <div style={{ ...card, border: '1.5px solid color-mix(in srgb, var(--system-blue) 35%, transparent)', background: 'color-mix(in srgb, var(--system-blue) 4%, transparent)' }}>
              <div style={{ marginBottom: '10px' }}>
                <span style={badge('color-mix(in srgb, var(--system-blue) 12%, transparent)', 'var(--system-blue)')}>你的独创</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <RefreshCw size={18} color="var(--system-blue)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>双阶段轮动策略</h3>
              </div>
              <div>
                {['高位→冷门反转股', '低位→超跌知名股', '周期行业轮动', '大环境补涨逻辑'].map(t => (
                  <span key={t} style={badge('color-mix(in srgb, var(--system-red) 10%, transparent)', 'var(--system-red)')}>{t}</span>
                ))}
              </div>
            </div>

            <hr style={divider} />

            <p style={sectionTitle}>策略核心公式</p>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>综合超额收益 =</p>
              <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.9, margin: 0 }}>
                周期底部买入 × 基本面反转确认 × 知名度溢价回归
              </p>
            </div>
          </div>
        )}

        {/* ── 周期定位 ── */}
        {activeTab === 'cycle' && (
          <div>
            <p style={sectionTitle}>美林时钟 + 双阶段操作</p>

            {[
              {
                dot: '衰', bg: 'color-mix(in srgb, var(--system-red) 12%, transparent)', color: 'var(--system-red)',
                title: '衰退期 — 调研建单',
                desc: '现金为王，建立超跌知名股观察池，暂不建仓。关注：负债率、现金流、核心业务收缩幅度'
              },
              {
                dot: '复', bg: 'color-mix(in srgb, var(--system-green) 12%, transparent)', color: 'var(--system-green)',
                title: '复苏期 — 主战场',
                desc: '超跌知名股优先补涨窗口。PMI回升、信贷扩张、央行宽松信号出现时，分批建仓。这是策略最核心的黄金期'
              },
              {
                dot: '热', bg: 'color-mix(in srgb, var(--system-orange) 12%, transparent)', color: 'var(--system-orange)',
                title: '过热期 — 冷门反转',
                desc: '市场亢奋，转向冷门+业绩反转股。行业景气度指标、产能利用率开始改善但未被市场定价的品种'
              },
              {
                dot: '滞', bg: 'rgba(142,142,147,0.15)', color: 'var(--system-gray2)',
                title: '滞胀期 — 降仓防御',
                desc: '两种策略均降仓至30%以下，切换防御性资产（消费、公用事业、黄金）'
              },
            ].map(phase => (
              <div key={phase.dot} style={{ ...card, display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: phase.bg, color: phase.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
                  {phase.dot}
                </div>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>{phase.title}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>{phase.desc}</p>
                </div>
              </div>
            ))}

            <hr style={divider} />

            <p style={sectionTitle}>关键宏观信号监测</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: '复苏信号', val: 'PMI连续2月 > 50' },
                { label: '流动性信号', val: 'M2增速回升' },
                { label: '情绪底部', val: '换手率极低分位' },
                { label: '政策信号', val: '降准 / 降息周期' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>{s.label}</p>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{s.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 选股过滤 ── */}
        {activeTab === 'filter' && (
          <div>
            <p style={sectionTitle}>超跌知名股 — 过滤体系</p>

            <div style={card}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' }}>第一关：跌幅量化</h3>
              {checkRow('相对历史高点跌幅 > 50%', 'var(--system-green)')}
              {checkRow('跑输同期行业指数 20% 以上（超跌验证）', 'var(--system-green)')}
              {checkRow('PE/PB 处于历史分位数后 20%', 'var(--system-green)')}
            </div>

            <div style={card}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' }}>第二关：真反转 vs 价值陷阱</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {['指标', '真反转', '价值陷阱'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '0.5px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['毛利率', '稳定或回升', '持续下滑'],
                      ['现金流', '经营性现金流为正', '靠借债维持'],
                      ['库存', '开始去化', '持续堆积'],
                      ['管理层', '增持 / 回购', '持续减持'],
                      ['行业', '产能出清中', '新竞争者进入'],
                      ['负债率', '< 50%', '> 70% 且恶化'],
                    ].map(([label, good, bad], i) => (
                      <tr key={label} style={{ background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border-primary)' }}>{label}</td>
                        <td style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border-primary)' }}>
                          <span style={badge('color-mix(in srgb, var(--system-green) 12%, transparent)', 'var(--system-green)')}>{good}</span>
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border-primary)' }}>
                          <span style={badge('color-mix(in srgb, var(--system-red) 12%, transparent)', 'var(--system-red)')}>{bad}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={card}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' }}>第三关：护城河验证（巴菲特）</h3>
              {['品牌溢价', '规模效应', '网络效应', '转换成本高', '牌照 / 资质壁垒'].map(t => (
                <span key={t} style={badge('color-mix(in srgb, var(--system-blue) 10%, transparent)', 'var(--system-blue)')}>{t}</span>
              ))}
            </div>

            <hr style={divider} />

            <p style={sectionTitle}>冷门反转股 — 过滤体系</p>
            <div style={card}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' }}>核心筛选条件</h3>
              {checkRow('机构持仓比例 < 5%（真正冷门）', 'var(--system-orange)')}
              {checkRow('连续2个季度营收增速由负转正', 'var(--system-orange)')}
              {checkRow('行业景气度处于底部回升初期', 'var(--system-orange)')}
              {checkRow('市值 < 历史均值 40%（估值足够低）', 'var(--system-orange)')}
            </div>
          </div>
        )}

        {/* ── 执行系统 ── */}
        {activeTab === 'execute' && (
          <div>
            <p style={sectionTitle}>建仓执行 — 左侧分批策略</p>
            <div style={card}>
              {flowStep(1, <><strong style={{ color: 'var(--text-primary)' }}>首批 30%</strong> — 逻辑确认，基本面通过三关过滤后建仓</>)}
              {flowStep(2, <><strong style={{ color: 'var(--text-primary)' }}>第二批 40%</strong> — 价格企稳（止跌信号），成交量萎缩后放量反弹</>)}
              {flowStep(3, <><strong style={{ color: 'var(--text-primary)' }}>第三批 30%</strong> — 突破关键压力位，确认趋势反转</>)}
            </div>

            <hr style={divider} />

            <p style={sectionTitle}>仓位分配规则</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {metricCard('超跌知名股单只上限', '20%')}
              {metricCard('冷门反转股单只上限', '15%')}
              {metricCard('冷门股分散只数', '5只+')}
              {metricCard('最大持仓观察期', '18个月')}
            </div>

            <hr style={divider} />

            <p style={sectionTitle}>止盈信号</p>
            <div style={card}>
              {checkRow(
                <>股价回到历史高点的 <strong style={{ color: 'var(--text-primary)' }}>50–61.8%</strong>（黄金分割位），减仓50%</>,
                'var(--system-green)'
              )}
              {checkRow(
                'PE/PB 回到历史均值区间，机构仓位明显回升时，开始减仓',
                'var(--system-green)'
              )}
              {checkRow(
                '市场整体进入过热期，降低整体仓位',
                'var(--system-green)'
              )}
            </div>
          </div>
        )}

        {/* ── 风控体系 ── */}
        {activeTab === 'risk' && (
          <div>
            <p style={sectionTitle}>双线止损机制</p>

            <div style={{ ...card, borderLeft: '3px solid var(--system-orange)', borderRadius: '0 var(--radius-lg) var(--radius-lg) 0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>逻辑止损（优先）</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
                当初买入的反转逻辑被证伪时，<strong style={{ color: 'var(--text-primary)' }}>不看价格立即离场</strong>。例如：管理层突然大幅减持、行业出现颠覆性竞争者、核心业务收入断崖式下跌
              </p>
            </div>

            <div style={{ ...card, borderLeft: '3px solid var(--system-red)', borderRadius: '0 var(--radius-lg) var(--radius-lg) 0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>价格止损（兜底）</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
                买入后继续下跌 <strong style={{ color: 'var(--text-primary)' }}>15–20%</strong> 且基本面指标同步恶化，强制止损离场
              </p>
            </div>

            <div style={{ ...card, borderLeft: '3px solid var(--system-gray3)', borderRadius: '0 var(--radius-lg) var(--radius-lg) 0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>时间止损</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
                买入后 <strong style={{ color: 'var(--text-primary)' }}>18个月</strong> 内逻辑未兑现，重新评估，确认逻辑仍成立才继续持有
              </p>
            </div>

            <hr style={divider} />

            <p style={sectionTitle}>核心风险与应对</p>
            <div style={card}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {['风险类型', '识别方法', '应对'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '0.5px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['价值陷阱', '毛利+现金流双降', '逻辑止损'],
                      ['周期误判', '行业产能未出清', '减仓等待'],
                      ['时间成本', '横盘超12个月', '重新评估'],
                      ['流动性陷阱', '日均成交额不足', '仓位不超10%'],
                      ['黑天鹅', '不可预测', '分散+止损兜底'],
                    ].map(([type, method, response], i) => (
                      <tr key={type} style={{ background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500, borderBottom: '0.5px solid var(--border-primary)' }}>{type}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border-primary)' }}>{method}</td>
                        <td style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border-primary)' }}>
                          <span style={badge('color-mix(in srgb, var(--system-blue) 10%, transparent)', 'var(--system-blue)')}>{response}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 回到顶部 */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: '24px', right: '24px',
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'var(--system-blue)', color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-lg)', zIndex: 100,
          }}
        >
          ↑
        </button>
      )}
    </main>
  )
}
