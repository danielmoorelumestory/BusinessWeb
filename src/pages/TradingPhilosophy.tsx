import React, { useState, useEffect } from 'react'
import { PageTabs, PageTitle } from '../components/ui/PageTabs'
import {
  Brain,
  Sparkles,
  Settings,
  Target,
  Clock,
  Shield,
  BarChart2,
  Lightbulb,
  CheckCircle2,
  ChevronUp,
  Thermometer,
  Coins,
  History,
  Plus,
  ArrowRight,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  XCircle,
  Star,
  Zap,
  Flame,
  Pin,
  Link,
  Info,
  ShieldAlert,
  Rocket
} from 'lucide-react'

export default function TradingPhilosophy(): JSX.Element {
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('dao') // 默认选中第一个章节
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set(['obv-table', 'strategy-table'])) // 默认展开关键表格
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set()) // 已勾选的行动项

  useEffect(() => {
    // 页面加载时，滚动到顶部并默认选中第一个章节
    window.scrollTo(0, 0)
    setActiveSection('dao')

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400)

      // 检测当前激活的章节
      const sections = ['dao', 'optimization', 'shu', 'execution', 'time', 'risk', 'path', 'understanding', 'action']
      const current = sections.find(section => {
        const element = document.getElementById(section)
        if (element) {
          const rect = element.getBoundingClientRect()
          return rect.top <= 120 && rect.bottom >= 120
        }
        return false
      })
      if (current) setActiveSection(current)
    }

    // 延迟一下再添加滚动监听，确保初始状态正确
    setTimeout(() => {
      window.addEventListener('scroll', handleScroll)
    }, 100)

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    // 顶部有导航栏和吸顶章节页签，留出约 110px，避免标题被盖住
    if (element) window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' })
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const sections = [
    { id: 'dao', title: '一、投资之"道"', icon: <Brain size={18} /> },
    { id: 'optimization', title: '体系评估与优化', icon: <Sparkles size={18} /> },
    { id: 'shu', title: '二、投资之"术"', icon: <Settings size={18} /> },
    { id: 'execution', title: '三、实战执行方案', icon: <Target size={18} /> },
    { id: 'time', title: '四、时间分配', icon: <Clock size={18} /> },
    { id: 'risk', title: '五、风险控制', icon: <Shield size={18} /> },
    { id: 'path', title: '六、复盘与迭代', icon: <BarChart2 size={18} /> },
    { id: 'understanding', title: '七、我的深度理解', icon: <Lightbulb size={18} /> },
    { id: 'action', title: '八、立即行动清单', icon: <CheckCircle2 size={18} /> }
  ]

  return (
    <main className="container animate-fade-in page-shell" style={{ position: 'relative' }}>
      <PageTitle desc="早期短线交易体系">道与术（短线策略）</PageTitle>
      <PageTabs label="章节" width={1000} value={activeSection} onChange={scrollToSection}
        items={sections.map(section => ({ id: section.id, label: section.title.replace(/[一二三四五六七八]、/, ''), icon: section.icon }))} />

      {/* 一、投资之"道" */}
      <section id="dao" className="card" style={{
        padding: '32px',
        marginBottom: '24px',
        border: '1px solid var(--glass-border)'
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 24px 0',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--system-gray5)'
        }}>
          一、投资之"道"(核心哲学)
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            1. 三大确定性原则
          </h3>
          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: '0',
              fontSize: '1rem',
              background: 'rgba(255,255,255,0.5)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--system-gray5)'
            }}>
              <thead>
                <tr style={{
                  background: 'var(--bg-secondary)',
                  borderBottom: '2px solid var(--border-subtle)'
                }}>
                  <th style={{
                    padding: '14px 16px',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}>
                    原则
                  </th>
                  <th style={{
                    padding: '14px 16px',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}>
                    核心方法
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { principle: '节奏确定性', method: '大盘+板块轮动(题材新)', icon: <Target size={18} /> },
                  { principle: '情绪确定性', method: '板块持续时间+空间(持续性)', icon: <Thermometer size={18} /> },
                  { principle: '资金确定性', method: 'OBV识别真金白银流向（筹码干净+强势）', icon: <Coins size={18} /> }
                ].map((row, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: index < 2 ? '1px solid var(--border-subtle)' : 'none',
                      background: index % 2 === 0 ? 'white' : 'var(--bg-secondary)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-secondary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? 'white' : 'var(--bg-secondary)'
                    }}
                  >
                    <td style={{
                      padding: '16px',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{ color: 'var(--system-blue)', display: 'flex' }}>{row.icon}</span>
                      {row.principle}
                    </td>
                    <td style={{
                      padding: '14px 16px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.5'
                    }}>
                      {row.method}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ paddingLeft: '16px', borderLeft: '4px solid var(--accent)' }}>
            <p style={{ margin: '8px 0', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <strong>核心理念:</strong>
            </p>
            <ul style={{ margin: '8px 0', paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <li><strong>不预测,只跟随</strong> - 等资金留下证据再出手</li>
              <li><strong>不对赌,只确认</strong> - 三个维度同时验证才动手</li>
              <li><strong>不常做,只精做</strong> - 策略与行情完美匹配时才重仓</li>
            </ul>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            2. 交易的本质转变
          </h3>
          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
              background: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{
                  background: 'var(--bg-secondary)',
                  borderBottom: '2px solid var(--border-subtle)'
                }}>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    width: '45%'
                  }}>
                    从（旧思维）
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    width: '10%'
                  }}>
                    →
                  </th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    width: '45%'
                  }}>
                    到（新思维）
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { from: '"我今天要赚多少钱?"', to: '"当前行情最适合哪个策略?"' },
                  { from: '"这只股票会涨吗?"', to: '"资金证据是否充分?"' },
                  { from: '"为什么又亏了?"', to: '"策略执行是否完美?"' }
                ].map((row, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: index < 2 ? '1px solid var(--border-subtle)' : 'none',
                      background: index % 2 === 0 ? 'white' : 'var(--bg-secondary)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-secondary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? 'white' : 'var(--bg-secondary)'
                    }}
                  >
                    <td style={{
                      padding: '12px 16px',
                      color: 'var(--up)',
                      fontWeight: '500',
                      lineHeight: '1.5'
                    }}>
                      {row.from}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: 'var(--accent)',
                      fontSize: '1.1rem',
                      fontWeight: '600'
                    }}>
                      →
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      color: 'var(--down)',
                      fontWeight: '500',
                      lineHeight: '1.5'
                    }}>
                      {row.to}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 体系评估与优化建议 */}
      <section id="optimization" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 20px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid var(--border-subtle)'
        }}>
          体系评估与优化建议
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} /> 体系亮点（已具备的核心优势）
          </h3>
          <div style={{
            background: 'var(--system-green-light)',
            padding: '20px',
            borderRadius: '12px',
            borderLeft: '4px solid var(--down)'
          }}>
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                {
                  title: '系统性思维',
                  desc: '从"道"（投资哲学）到"术"（技术指标）再到"执行"（纪律与仓位），逻辑连贯，层次清晰。'
                },
                {
                  title: '客观化决策',
                  desc: '强调"不预测，只跟随"，通过OBV、量价、情绪周期等客观信号过滤主观情绪。'
                },
                {
                  title: '风险意识强',
                  desc: '设有红线纪律、三层止损、仓位分级，体现了"生存第一"的交易观。'
                },
                {
                  title: '反人性设计',
                  desc: '"在没人要时买入，人人抢时卖出""97%时间空仓"等理念，直击散户痛点。'
                }
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    background: 'white',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--system-green-light)'
                  }}
                >
                  <div style={{ fontWeight: '600', color: 'var(--down-ink)', marginBottom: '4px' }}>
                    {index + 1}. {item.title}
                  </div>
                  <div style={{ color: 'var(--down)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={20} /> 🎯 优化后体系框架（汇总版）
          </h3>
          <div style={{
            background: 'var(--accent-soft)',
            padding: '20px',
            borderRadius: '12px',
            borderLeft: '4px solid var(--accent)'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', color: 'var(--accent-ink)', marginBottom: '8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Star size={18} /> 核心理念
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.8' }}>
                "等资金留下证据，等情绪给出窗口，等策略匹配行情"
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', color: 'var(--accent-ink)', marginBottom: '8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BarChart2 size={18} /> 核心武器
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.8' }}>
                <div>• <strong>主要指标：</strong>OBV + 量价 + 板块热度</div>
                <div>• <strong>辅助验证：</strong>筹码峰 + 大单资金流 + 情绪指数</div>
                <div>• <strong>周期判断：</strong>连板率 + 涨跌家数比 + 昨日涨停表现</div>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', color: 'var(--accent-ink)', marginBottom: '8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={18} /> 每日执行流程
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.8' }}>
                <div><strong>盘前（5分钟）：</strong>计算情绪指数，判断周期，选择今日适用策略</div>
                <div><strong>盘中（关键时段9:30-10:30, 14:00-15:00）：</strong>只观察策略内的标的，信号符合则按计划买入</div>
                <div><strong>盘后（15分钟）：</strong>复盘交易执行情况，更新观察池，标注明日关键点位</div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: '700', color: 'var(--accent-ink)', marginBottom: '8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={18} /> 风控铁律
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.8' }}>
                <div>1. 单笔亏损 ≤ 5%（无条件止损）</div>
                <div>2. 总仓位 ≤ 80%（永留20%现金）</div>
                <div>3. 不符合策略 → 空仓</div>
                <div>4. 情绪过热（连板率{'>'}45%）→ 只卖不买</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 二、投资之"术" */}
      <section id="shu" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 20px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid var(--border-subtle)'
        }}>
          二、投资之"术"(操作系统)
        </h2>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={20} /> 量价OBV三位一体口诀(核心技术)
            </h3>
            <button
              onClick={() => {
                const newSet = new Set(expandedTables)
                if (newSet.has('obv-table')) {
                  newSet.delete('obv-table')
                } else {
                  newSet.add('obv-table')
                }
                setExpandedTables(newSet)
              }}
              style={{
                padding: '4px 12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                fontWeight: '500'
              }}
            >
              {expandedTables.has('obv-table') ? '收起表格' : '展开表格'}
            </button>
          </div>
          <p style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            marginBottom: '12px',
            lineHeight: '1.6',
            padding: '12px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            borderLeft: '3px solid var(--accent)'
          }}>
            <strong>核心要点：</strong>通过价格、成交量、OBV三个维度识别资金流向，在"没人要"时买入，"人人抢"时卖出。
          </p>
          {expandedTables.has('obv-table') && (
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-subtle)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>阶段</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}>价格</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}>成交量</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}>OBV</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>资金真相</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { stage: '建仓启动', price: '横盘/微跌', volume: '缩量', obv: '稳步上升', truth: '主力偷偷吸筹', action: <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /> <span style={{ marginLeft: '4px' }}>潜伏</span></div> },
                    { stage: '突破确认', price: '放量突破', volume: '放大', obv: '同步新高', truth: '主力志在必得', action: <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /> <span style={{ marginLeft: '4px' }}>买入</span></div> },
                    { stage: '稳健上涨', price: '缩量上涨', volume: '缩小', obv: '持续上行', truth: '筹码锁死', action: <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /> <span style={{ marginLeft: '4px' }}>持股</span></div> },
                    { stage: '顶背离预警', price: '缩量上涨', volume: '缩小', obv: '拐头向下', truth: '买家枯竭', action: <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}><AlertTriangle size={14} color="var(--up)" /> <span>第一天卖出</span></div> },
                    { stage: '派发阶段', price: '放量不涨', volume: '放大', obv: '走平', truth: '主力换手跑路', action: <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}><AlertTriangle size={14} color="var(--up)" /> <span>立即清仓</span></div> },
                    { stage: '杀跌阶段', price: '放量下跌', volume: '放大', obv: '飞流直下', truth: '资金仓皇出逃', action: <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}><XCircle size={14} color="var(--up)" /> <span>不接飞刀</span></div> },
                    { stage: '底背离', price: '创新低', volume: '缩量', obv: '拒绝新低', truth: '主力提前抄底', action: <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /><Star size={12} fill="var(--accent-warm)" color="var(--accent-warm)" /> <span style={{ marginLeft: '4px' }}>第三天买回</span></div> }
                  ].map((row, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: index % 2 === 0 ? 'white' : 'var(--bg-secondary)'
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{row.stage}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>{row.price}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>{row.volume}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>{row.obv}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.truth}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-primary)' }}>{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{
            background: 'var(--accent-warm-soft)',
            padding: '16px',
            borderRadius: '8px',
            marginTop: '16px',
            borderLeft: '4px solid var(--accent-warm)'
          }}>
            <p style={{ margin: 0, fontWeight: '600', color: 'var(--warm-ink)', fontSize: '0.9rem' }}>
              <strong>记忆口诀:</strong>
            </p>
            <div style={{ marginTop: '8px', color: 'var(--warm-ink)', lineHeight: '1.8', fontSize: '0.9rem' }}>
              <div>股价横着走,OBV往上翘 - 专家在吸筹</div>
              <div>小阳排成队,量能稳步高 - 主力在建仓</div>
              <div>偶尔拉一勾,试盘看抛压 - 测试上方压力</div>
              <div>缩量再回头,专家要发力 - 即将启动</div>
            </div>
          </div>
        </div>

        {/* OBV局限性及补充验证 */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} /> OBV局限性及补充验证
          </h3>
          <div style={{
            background: 'var(--system-red-light)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '4px solid var(--up)'
          }}>
            <p style={{ margin: '0 0 12px', fontWeight: '600', color: 'var(--up-ink)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} /> OBV在震荡市或庄股中对倒交易容易失真，必须多重验证：
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--up-ink)', lineHeight: '1.8', fontSize: '0.9rem' }}>
              <li>增加<strong>资金流强度指标</strong>（如大单净量、主力资金连续流入天数）</li>
              <li>配合<strong>筹码峰</strong>观察关键价位筹码锁定情况</li>
              <li>结合<strong>板块OBV</strong>，避免个股被板块带动而误判</li>
            </ul>
          </div>
          <div style={{
            background: 'var(--accent-soft)',
            padding: '20px',
            borderRadius: '12px',
            borderLeft: '4px solid var(--accent)',
            marginBottom: '16px'
          }}>
            <p style={{ margin: '0 0 12px', fontWeight: '600', color: 'var(--accent-ink)', fontSize: '0.95rem' }}>
              三重验证体系：
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>验证维度</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>具体指标</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>有效标准</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { dim: 'OBV趋势', indicator: 'OBV翘头', standard: '幅度 > 3日均量的1.5倍' },
                    { dim: '主力资金', indicator: '大单净量/Level2资金流', standard: '连续3日净流入' },
                    { dim: '筹码结构', indicator: '筹码峰集中度', standard: '90%成本集中度 < 20%' },
                    { dim: '板块验证', indicator: '板块OBV同步', standard: '个股OBV与板块OBV同向' }
                  ].map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--text-primary)' }}>{row.dim}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{row.indicator}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--down)', fontWeight: '500' }}>{row.standard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{
              marginTop: '12px',
              padding: '10px',
              background: 'rgba(255,255,255,0.6)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              color: 'var(--accent-ink)'
            }}>
              <strong>⏰ 时段过滤：</strong>只在 <strong>9:30-10:30</strong>、<strong>14:00-15:00</strong> 关键时段观察OBV信号，避免盘中噪音干扰。
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              🎯 三类策略体系（精简优化版）
            </h3>
            <button
              onClick={() => {
                const newSet = new Set(expandedTables)
                if (newSet.has('strategy-table')) {
                  newSet.delete('strategy-table')
                } else {
                  newSet.add('strategy-table')
                }
                setExpandedTables(newSet)
              }}
              style={{
                padding: '4px 12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                fontWeight: '500'
              }}
            >
              {expandedTables.has('strategy-table') ? '收起表格' : '展开表格'}
            </button>
          </div>
          <div style={{
            background: 'var(--accent-soft)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '4px solid var(--accent)'
          }}>
            <p style={{ margin: '0 0 12px', fontWeight: '600', color: 'var(--accent-ink)', fontSize: '0.95rem' }}>
              💡 精简逻辑：基于"行情温度"和"资金姿态"两个维度，将原五大策略重组为三类，决策更清晰，执行更果断。
            </p>
            <div style={{ color: 'var(--text-primary)', lineHeight: '1.8', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>主攻型：</strong>在"悲观/犹豫"期主动布局，买在启动前（融合冰点破冰+龙头回踩）
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>跟随型：</strong>在"已热"期确认跟随，买在强度上（融合短线中军+弱转强）
              </div>
              <div>
                <strong>防守型：</strong>在"过度高潮/退潮"期战略放弃，空仓即赢
              </div>
            </div>
          </div>
          {expandedTables.has('strategy-table') && (
            <div style={{
              overflowX: 'auto',
              marginTop: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              border: '1px solid var(--border-subtle)'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: '0.95rem',
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{
                    background: 'var(--accent)',
                    color: '#ffffff'
                  }}>
                    <th style={{
                      padding: '18px 16px',
                      textAlign: 'left',
                      fontWeight: '700',
                      color: '#ffffff',
                      fontSize: '1rem',
                      letterSpacing: '0.3px',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                    }}>
                      策略类型
                    </th>
                    <th style={{
                      padding: '18px 16px',
                      textAlign: 'left',
                      fontWeight: '700',
                      color: '#ffffff',
                      fontSize: '1rem',
                      letterSpacing: '0.3px',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                    }}>
                      适用周期
                    </th>
                    <th style={{
                      padding: '18px 16px',
                      textAlign: 'left',
                      fontWeight: '700',
                      color: '#ffffff',
                      fontSize: '1rem',
                      letterSpacing: '0.3px',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                    }}>
                      核心信号
                    </th>
                    <th style={{
                      padding: '18px 16px',
                      textAlign: 'center',
                      fontWeight: '700',
                      color: '#ffffff',
                      fontSize: '1rem',
                      letterSpacing: '0.3px',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                    }}>
                      仓位
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      type: '主攻型',
                      icon: '⚔️',
                      cycle: '切新热点 / 老龙修复(需预埋)',
                      signal: '新题材首板+OBV底背离 / 老龙头回踩+OBV支撑',
                      position: '30%-50%',
                      rowBg: 'var(--system-green-light)',
                      borderColor: 'var(--down)',
                      textColor: 'var(--down-ink)',
                      typeColor: 'var(--down)'
                    },
                    {
                      type: '跟随型',
                      icon: '🎯',
                      cycle: '主升/分歧',
                      signal: '板块强势+缩量回踩+OBV支撑 / 弱转强确认',
                      position: '10%-20%',
                      rowBg: 'var(--accent-soft)',
                      borderColor: 'var(--accent)',
                      textColor: 'var(--accent-ink)',
                      typeColor: 'var(--accent)'
                    },
                    {
                      type: '防守型',
                      icon: '🛡️',
                      cycle: '高潮/退潮',
                      signal: '情绪过热(连板率{' > '}45%)或系统性风险',
                      position: '0%-10%',
                      rowBg: 'var(--system-red-light)',
                      borderColor: 'var(--up)',
                      textColor: 'var(--up-ink)',
                      typeColor: 'var(--up)'
                    }
                  ].map((row, index) => (
                    <tr
                      key={index}
                      style={{
                        background: row.rowBg,
                        borderLeft: `4px solid ${row.borderColor}`,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'white'
                        e.currentTarget.style.boxShadow = `0 4px 12px color-mix(in srgb, ${row.borderColor} 25%, transparent)`
                        e.currentTarget.style.transform = 'scale(1.01)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = row.rowBg
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.transform = 'scale(1)'
                      }}
                    >
                      <td style={{
                        padding: '18px 16px',
                        fontWeight: '700',
                        color: row.typeColor,
                        fontSize: '1.05rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '1.3rem' }}>{row.icon}</span>
                        {row.type}
                      </td>
                      <td style={{
                        padding: '18px 16px',
                        color: 'var(--text-primary)',
                        lineHeight: '1.6',
                        fontWeight: '500'
                      }}>
                        {row.cycle}
                      </td>
                      <td style={{
                        padding: '18px 16px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.7',
                        maxWidth: '500px'
                      }}>
                        {row.signal}
                      </td>
                      <td style={{
                        padding: '18px 16px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: row.typeColor,
                        fontSize: '1.1rem'
                      }}>
                        <span style={{
                          background: 'white',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          display: 'inline-block',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          border: `2px solid ${row.borderColor}`
                        }}>
                          {row.position}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: '32px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            ⚠️ OBV"虚假洗盘"识别
          </h3>
          <div style={{
            background: 'var(--system-red-light)',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px',
            borderLeft: '4px solid var(--up)'
          }}>
            <p style={{ margin: '0 0 16px', color: 'var(--up-ink)', lineHeight: '1.8', fontWeight: '600' }}>
              "虚假洗盘"，需要盯住以下四个反直觉的细节：
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{
              background: 'white',
              border: '2px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '2px solid var(--bg-secondary)'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: 'var(--up)',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '1rem'
                }}>
                  1
                </span>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  "缩量下跌"产生的虚假负值
                </h4>
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '12px' }}>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>OBV 的一个缺陷是：</strong>不管跌多少，只要收盘价低一分钱，当天的成交量就会全部计为负数。
                </p>
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: '12px',
                  borderRadius: '8px',
                  marginTop: '12px',
                  borderLeft: '3px solid var(--up)'
                }}>
                  <div style={{ marginBottom: '8px', fontWeight: '600', color: 'var(--up-ink)' }}>庄家套路：</div>
                  <div style={{ color: 'var(--up-ink)' }}>股价小幅阴跌，每天只跌 0.5%，但持续一周。</div>
                  <div style={{ marginTop: '12px', marginBottom: '8px', fontWeight: '600', color: 'var(--up-ink)' }}>OBV 表现：</div>
                  <div style={{ color: 'var(--up-ink)' }}>OBV 线会连跌 5 天，看起来很吓人。</div>
                  <div style={{ marginTop: '12px', marginBottom: '8px', fontWeight: '600', color: 'var(--down)' }}>识别真相：</div>
                  <div style={{ color: 'var(--down)' }}>看成交量柱状图（VOL）。如果这 5 天的成交量都非常萎缩（地量），说明只有少量恐慌盘被吓出来，主力的大资金根本没动。这种 OBV 的下降是"虚胖"，一旦洗盘结束，股价会迅速收复失地。</div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'white',
              border: '2px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '2px solid var(--bg-secondary)'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: 'var(--up)',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '1rem'
                }}>
                  2
                </span>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  "急跌洗盘"与"OBV 支撑点"
                </h4>
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '12px' }}>
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: '12px',
                  borderRadius: '8px',
                  marginTop: '12px',
                  borderLeft: '3px solid var(--up)'
                }}>
                  <div style={{ marginBottom: '8px', fontWeight: '600', color: 'var(--up-ink)' }}>现象：</div>
                  <div style={{ color: 'var(--up-ink)' }}>庄家突然制造一根大阴线砸盘，OBV 瞬间出现一个巨大的负值断层。</div>
                  <div style={{ marginTop: '12px', marginBottom: '8px', fontWeight: '600', color: 'var(--down)' }}>识别真相：</div>
                  <div style={{ color: 'var(--down)' }}>看 OBV 是否跌破了前期的重要起爆点（低点）。</div>
                  <div style={{ marginTop: '8px', padding: '8px', background: 'var(--system-green-light)', borderRadius: '6px', color: 'var(--down-ink)' }}>
                    如果股价跌得很惨，但 OBV 指标依然稳在前期平台之上，这叫"量在价先"的逆向运用。说明早期的买入力量（正量能）太强，这一根阴线（负量能）根本无法撼动基本盘。这通常是"挖坑"动作。
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'white',
              border: '2px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '2px solid var(--bg-secondary)'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: 'var(--up)',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '1rem'
                }}>
                  3
                </span>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  "长上影线"的试盘
                </h4>
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '12px' }}>
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: '12px',
                  borderRadius: '8px',
                  marginTop: '12px',
                  borderLeft: '3px solid var(--up)'
                }}>
                  <div style={{ marginBottom: '8px', fontWeight: '600', color: 'var(--up-ink)' }}>现象：</div>
                  <div style={{ color: 'var(--up-ink)' }}>有时候股价盘中冲高回落，收盘微跌。</div>
                  <div style={{ marginTop: '12px', marginBottom: '8px', fontWeight: '600', color: 'var(--up-ink)' }}>OBV 表现：</div>
                  <div style={{ color: 'var(--up-ink)' }}>记为负值。</div>
                  <div style={{ marginTop: '12px', marginBottom: '8px', fontWeight: '600', color: 'var(--down)' }}>识别真相：</div>
                  <div style={{ color: 'var(--down)' }}>
                    这种带有长上影线的微跌，如果伴随较大的成交量，其实是庄家在向上试盘（看上面的抛压大不大）。虽然 OBV 记了负数，但本质上是多头在探测高位，为后面的真突破做准备。
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'white',
              border: '2px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '2px solid var(--bg-secondary)'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: 'var(--up)',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '1rem'
                }}>
                  4
                </span>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  "涨停开盘、随即炸板"的试盘
                </h4>
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                <p style={{ margin: '0 0 16px' }}>
                  这种<strong>"涨停开盘、随即炸板"</strong>的操作，是短线实战中最经典、也最凶狠的试盘手段之一。配合 OBV 指标去观察，能让你瞬间看清这是"庄家撤退"还是"暴力洗盘"。
                </p>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', fontSize: '1rem' }}>
                    1. 这种试盘的本质：测试"天花板"有多硬
                  </div>
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '16px',
                    borderRadius: '8px',
                    borderLeft: '3px solid var(--accent)'
                  }}>
                    <p style={{ margin: '0 0 12px', color: 'var(--text-primary)' }}>
                      庄家之所以敢拉到涨停再打开，主要有三个目的：
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                      <li><strong>测压力：</strong>看在涨停板那个位置，到底有多少"潜伏盘"和"套牢盘"想逃跑。如果炸板后抛压如潮，庄家就会顺势下砸继续洗盘。</li>
                      <li><strong>引跟风：</strong>看市场上的短线资金对这只票的"兴奋度"够不够。</li>
                      <li><strong>换手：</strong>在高位把一些不坚定的散户筹码"洗"给另一批看好的散户，提高市场的平均持仓成本。</li>
                    </ul>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', fontSize: '1rem' }}>
                    2. 实战中的量价组合：真试盘 vs 真出货
                  </div>
                  <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)' }}>
                    遇到"炸板"，你要立刻看当天的量价表现：
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-subtle)' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>现象</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>OBV 表现</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>真实意图</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>结论</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            phenomenon: '炸板后高位横盘',
                            obv: 'OBV 持续走高',
                            intent: '说明炸板释放的筹码很快被新资金接走了',
                            conclusion: '真试盘，后市大涨'
                          },
                          {
                            phenomenon: '炸板后一路走低',
                            obv: 'OBV 掉头向下',
                            intent: '庄家利用涨停吸引散户入场，然后自己大肆派发',
                            conclusion: '真出货，快跑'
                          },
                          {
                            phenomenon: '炸板后缩量震荡',
                            obv: 'OBV 平稳',
                            intent: '庄家在观察市场反应，既不抢筹也不砸盘',
                            conclusion: '继续观察'
                          }
                        ].map((row, index) => (
                          <tr
                            key={index}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: index % 2 === 0 ? 'white' : 'var(--bg-secondary)'
                            }}
                          >
                            <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.phenomenon}</td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.obv}</td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.intent}</td>
                            <td style={{
                              padding: '12px',
                              fontWeight: '600',
                              color: row.conclusion.includes('大涨') ? 'var(--down)' : row.conclusion.includes('快跑') ? 'var(--up)' : 'var(--accent-warm)'
                            }}>
                              {row.conclusion}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', fontSize: '1rem' }}>
                    3. 如何利用 OBV 破解"炸板"骗局？
                  </div>
                  <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    这是最关键的技巧：看"炸板"当天的 OBV 增量与之后几天的回撤比例。
                  </p>

                  <div style={{
                    background: 'var(--system-green-light)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    borderLeft: '4px solid var(--down)'
                  }}>
                    <div style={{ fontWeight: '700', color: 'var(--down-ink)', marginBottom: '8px' }}>
                      强势洗盘逻辑：
                    </div>
                    <div style={{ color: 'var(--down)', lineHeight: '1.8', marginBottom: '12px' }}>
                      如果炸板当天放出了近期"天量"，OBV 瞬间跳升一个大台阶。接下来的 2-3 天，股价虽然在回调，但 OBV 指标仅仅是小幅回落，依然停留在那个高台阶上。
                    </div>
                    <div style={{
                      background: 'white',
                      padding: '12px',
                      borderRadius: '6px',
                      color: 'var(--down-ink)',
                      fontWeight: '600'
                    }}>
                      含义：这意味着炸板那天"进去的钱"远多于后来"出来的钱"。那天的巨量是庄家在接货，而不是出货。
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--system-red-light)',
                    padding: '16px',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--up)'
                  }}>
                    <div style={{ fontWeight: '700', color: 'var(--up-ink)', marginBottom: '8px' }}>
                      弱势出货逻辑：
                    </div>
                    <div style={{ color: 'var(--up-ink)', lineHeight: '1.8' }}>
                      如果炸板后，接下来的几天 OBV 迅速跌回到了起涨点。
                    </div>
                    <div style={{
                      background: 'white',
                      padding: '12px',
                      borderRadius: '6px',
                      color: 'var(--up-ink)',
                      fontWeight: '600',
                      marginTop: '12px'
                    }}>
                      含义：说明那天冲进去的全是散户，庄家已经把货全部甩给你们了。
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 三、实战执行方案 */}
      <section id="execution" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 20px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid var(--border-subtle)'
        }}>
          三、实战执行方案
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            📋 每日开盘前30秒检查清单
          </h3>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '12px',
            border: '2px solid var(--border-subtle)',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            lineHeight: '1.8',
            overflowX: 'auto'
          }}>
            <div style={{ color: 'var(--accent)', marginBottom: '8px' }}># 伪代码逻辑</div>
            <div style={{ color: 'var(--system-purple)', marginBottom: '8px' }}>def 今日策略():</div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>连板率</span> = <span style={{ color: 'var(--down)' }}>统计连板率()</span>
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--system-purple)' }}>if</span> <span style={{ color: 'var(--text-tertiary)' }}>连板率</span> {'<'} <span style={{ color: 'var(--accent-warm)' }}>25</span>:  <span style={{ color: 'var(--text-secondary)' }}># 市场冰点</span>
            </div>
            <div style={{ paddingLeft: '40px', marginBottom: '8px', color: 'var(--down)' }}>
              return "冰点破冰模式 - 新题材首板+机构加持"
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--system-purple)' }}>elif</span> <span style={{ color: 'var(--accent-warm)' }}>25</span> {'<='} <span style={{ color: 'var(--text-tertiary)' }}>连板率</span> {'<='} <span style={{ color: 'var(--accent-warm)' }}>45</span>:  <span style={{ color: 'var(--text-secondary)' }}># 市场回暖</span>
            </div>
            <div style={{ paddingLeft: '40px', marginBottom: '8px', color: 'var(--down)' }}>
              return "龙头+OBV模式 - 龙头股回踩支撑"
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--system-purple)' }}>elif</span> <span style={{ color: 'var(--text-tertiary)' }}>连板率</span> {'>'} <span style={{ color: 'var(--accent-warm)' }}>45</span>:  <span style={{ color: 'var(--text-secondary)' }}># 市场高潮</span>
            </div>
            <div style={{ paddingLeft: '40px', marginBottom: '8px', color: 'var(--up)' }}>
              return "防守模式 - 空仓或只做龙头低吸"
            </div>
            <div style={{ paddingLeft: '20px' }}>
              <span style={{ color: 'var(--system-purple)' }}>else</span>:
            </div>
            <div style={{ paddingLeft: '40px', color: 'var(--text-tertiary)' }}>
              return "观望模式 - 等待明确信号"
            </div>
          </div>
        </div>

        {/* 选股池初步筛选 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            📋 选股池初步筛选（盘后必做）
          </h3>
          <div style={{
            background: 'var(--system-green-light)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '4px solid var(--down)'
          }}>
            <p style={{ margin: '0 0 12px', fontWeight: '600', color: 'var(--down-ink)', fontSize: '0.95rem' }}>
              体系未提及如何从全市场选出观察标的，建议建立"策略观察池"：
            </p>
            <div style={{ color: 'var(--down)', lineHeight: '1.8', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>每日收盘后条件选股：</strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>OBV创20日新高 + 成交量缩至1/3 + 板块热度前5</li>
                <li>建立"策略观察池"，避免盘中临时选股</li>
                <li>池内标的按"主攻型/跟随型/防守型"分类标记</li>
              </ul>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            🎯 三问买入法(优化优先级版)
          </h3>

          {/* 前提条件：情绪周期 */}
          <div style={{
            background: 'var(--accent-warm-soft)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '4px solid var(--accent-warm)'
          }}>
            <p style={{ margin: '0 0 12px', fontWeight: '700', color: 'var(--warm-ink)' }}>
              ⚡ 前提条件：先判断情绪周期（精细化量化）
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.6)',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '0.85rem',
              color: 'var(--warm-ink)'
            }}>
              <strong>💡 优化建议：</strong>加入更多维度（涨跌家数比、昨日涨停表现、炸板率、封板成功率），形成<strong>情绪指数</strong>，提高周期判断的稳定性。
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                background: 'white',
                borderRadius: '6px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ background: 'var(--accent-warm-soft)', borderBottom: '2px solid var(--accent-warm-soft)' }}>
                    <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700', color: 'var(--warm-ink)' }}>周期</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700', color: 'var(--warm-ink)' }}>量化指标</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700', color: 'var(--warm-ink)' }}>三问适用性</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      cycle: '🧊 冰点期',
                      feature: '连板率<25% / 涨跌家数比<0.5 / 昨日涨停表现<0%',
                      apply: '✅ 最佳，三问筛选新题材首板'
                    },
                    {
                      cycle: '🌱 回暖期',
                      feature: '25%<连板率<45% / 涨跌家数比0.5-1.0 / 封板成功率>70%',
                      apply: '✅ 适用，三问筛选龙头回踩'
                    },
                    {
                      cycle: '🔥 主升期',
                      feature: '龙头连板 / 板块轮动 / 昨日涨停表现>5%',
                      apply: '⚠️ 谨慎，只做强势股低吸'
                    },
                    {
                      cycle: '⚡ 分歧期',
                      feature: '龙头断板 / 炸板率>30% / 情绪分歧',
                      apply: '✅ 适用，老龙头修复策略'
                    },
                    {
                      cycle: '❄️ 退潮期',
                      feature: '连板率持续下降 / 跌停数>涨停数',
                      apply: '❌ 不适用，空仓观望'
                    }
                  ].map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--accent-warm-soft)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: '600', color: 'var(--warm-ink)' }}>{row.cycle}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--warm-ink)', fontSize: '0.8rem' }}>{row.feature}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--warm-ink)' }}>{row.apply}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '0.85rem', color: 'var(--warm-ink)' }}>
              <strong>记住：</strong>冰点/回暖/分歧期是进攻窗口，退潮期再好的标的也别碰！
            </p>
          </div>

          <div style={{
            background: 'var(--accent-soft)',
            padding: '20px',
            borderRadius: '12px',
            borderLeft: '4px solid var(--accent)',
            marginBottom: '16px'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.6)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '2px solid var(--accent)'
            }}>
              <p style={{ margin: 0, fontWeight: '700', color: 'var(--accent-ink)', fontSize: '0.95rem' }}>
                💡 优化后的优先级：先看板块强度 → 再看个股筹码 → 最后看盘面强度
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--accent-ink)' }}>
                理由：板块若不持续，个股难独立走强；筹码是持续性基础；强度是启动信号。
              </p>
            </div>
            <p style={{ margin: '0 0 16px', fontWeight: '600', color: 'var(--accent-ink)' }}>
              确认处于进攻窗口期后,按优化后的顺序问自己:
            </p>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Q1: 板块强度够不够?（优先判断）
              </div>
              <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                <div>├─ 是否属于当前主流热点板块?</div>
                <div>├─ 板块是否有政策/事件催化?</div>
                <div>├─ 板块涨停家数≥3?</div>
                <div>└─ 板块是否具备持续性（持续时间+空间）?</div>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Q2: 个股筹码是否干净?（基础验证）
              </div>
              <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                <div>├─ 没人卖了吗? 成交量缩到近期1/3以下?</div>
                <div>├─ 资金回来了吗? OBV是否翘头向上?</div>
                <div>├─ 筹码集中度是否提高? 主力是否在吸筹?</div>
                <div>└─ 是否出现地量(近20日最低)?</div>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Q3: 盘面是否强势?（启动信号）
              </div>
              <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                <div>├─ 是否板块内涨幅靠前(前3)?</div>
                <div>├─ 封单是否强劲? 换手是否充分(15-30%)?</div>
                <div>└─ 是否有龙头特征(涨停时间早、身位优势)?</div>
              </div>
            </div>
            <div style={{
              background: 'white',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '16px',
              border: '2px solid var(--accent)'
            }}>
              <div style={{ fontWeight: '700', color: 'var(--accent-ink)', marginBottom: '4px' }}>
                如果三个问题都是"是" → 符合买入条件
              </div>
              <div style={{ color: 'var(--up)' }}>
                如果任何一个是"否" → 继续等待或放弃
              </div>
            </div>
          </div>
        </div>

        {/* 三问量化验证标准 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            📋 三问量化验证标准
          </h3>
          <div style={{
            background: 'var(--system-green-light)',
            padding: '20px',
            borderRadius: '12px',
            borderLeft: '4px solid var(--down)'
          }}>
            <p style={{ margin: '0 0 16px', fontWeight: '600', color: 'var(--down-ink)' }}>
              将三问转化为可量化的具体指标：
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ background: 'var(--system-green-light)', borderBottom: '2px solid var(--system-green-light)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--down-ink)', width: '25%' }}>三问</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--down-ink)' }}>量化标准</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { q: '题材新不新', check: '板块涨停家数≥3 / 有政策事件催化 / 连板率处于回升阶段' },
                    { q: '筹码干不干净', check: '成交量<近期均量1/3 + OBV翘头 + 主力资金连续3日净流入' },
                    { q: '盘面强不强', check: '板块内涨幅前3 + 封单比>10% + 换手率15-30%' }
                  ].map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--system-green-light)' }}>
                      <td style={{ padding: '12px', fontWeight: '600', color: 'var(--down-ink)' }}>{row.q}</td>
                      <td style={{ padding: '12px', color: 'var(--down)' }}>{row.check}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'white',
              borderRadius: '8px',
              border: '2px solid var(--down)'
            }}>
              <div style={{ fontWeight: '700', color: 'var(--down-ink)', marginBottom: '8px' }}>
                💡 核心逻辑：
              </div>
              <div style={{ color: 'var(--down)', fontSize: '0.95rem' }}>
                "看板块定方向，看量价判筹码，看热度定仓位"
              </div>
            </div>
          </div>
        </div>

        {/* 出场策略 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            🚪 出场策略（主动止盈+被动止损）
          </h3>
          <div style={{
            background: 'var(--accent-warm-soft)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            borderLeft: '4px solid var(--accent-warm)'
          }}>
            <p style={{ margin: '0 0 12px', fontWeight: '600', color: 'var(--warm-ink)', fontSize: '0.95rem' }}>
              当前强调"顶背离预警""放量不涨卖出"，建议更明确区分：
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ background: 'var(--accent-warm-soft)', borderBottom: '2px solid var(--accent-warm-soft)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--warm-ink)' }}>出场类型</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--warm-ink)' }}>触发条件</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--warm-ink)' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      type: '主动止盈',
                      trigger: '3日不创新高 / 板块退潮 / 顶背离预警',
                      action: '减半仓或清仓'
                    },
                    {
                      type: '移动止盈',
                      trigger: '收盘价跌破5日线 / 跌破10日线',
                      action: '减半仓 / 清仓'
                    },
                    {
                      type: '被动止损',
                      trigger: '破关键支撑位(20日线) / 单笔亏损≥5%',
                      action: '立即平仓'
                    },
                    {
                      type: '时间止损',
                      trigger: '买入后3天不涨反跌',
                      action: '无条件止损'
                    }
                  ].map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--accent-warm-soft)' }}>
                      <td style={{ padding: '12px', fontWeight: '600', color: 'var(--warm-ink)' }}>{row.type}</td>
                      <td style={{ padding: '12px', color: 'var(--warm-ink)' }}>{row.trigger}</td>
                      <td style={{ padding: '12px', fontWeight: '600', color: 'var(--up)' }}>{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            💰 仓位管理铁律
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>信号强度</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>条件</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}>最大仓位</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--text-primary)' }}>分批建仓</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { strength: '五星满分', condition: '冰点+地量+OBV底背离+ROE高', position: '50%', method: '3:2分批' },
                  { strength: '四星优秀', condition: '老热点+缩量+OBV翘头', position: '30%', method: '2:1分批' },
                  { strength: '三星及格', condition: '弱转强或单一信号', position: '10-20%', method: '试探性建仓' },
                  { strength: '其他情况', condition: '不符合以上任何条件', position: '0%', method: '空仓是策略' }
                ].map((row, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: index % 2 === 0 ? 'white' : 'var(--bg-secondary)'
                    }}
                  >
                    <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{row.strength}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.condition}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>{row.position}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{
            background: 'var(--system-green-light)',
            padding: '16px',
            borderRadius: '8px',
            marginTop: '16px',
            borderLeft: '4px solid var(--down)'
          }}>
            <p style={{ margin: '0 0 8px', fontWeight: '600', color: 'var(--down-ink)' }}>
              <strong>仓位分配细则:</strong>
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--down)', lineHeight: '1.8' }}>
              <div>总资金: 100,000 RMB</div>
              <div style={{ marginTop: '8px' }}>底仓(40%): 长期持有ROE{'>'}15%的核心资产</div>
              <div>灵活仓(40%): 根据五大策略信号机动操作</div>
              <div>现金(20%): 永久保留,用于极端机会或止损后修复</div>
            </div>
          </div>

          {/* 简化仓位公式 */}
          <div style={{
            background: 'var(--accent-warm-soft)',
            padding: '16px',
            borderRadius: '8px',
            marginTop: '16px',
            borderLeft: '4px solid var(--accent-warm)'
          }}>
            <p style={{ margin: '0 0 12px', fontWeight: '700', color: 'var(--warm-ink)' }}>
              📋 简化仓位公式（易执行版）
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {[
                { signal: '五星信号', desc: '冰点+龙头+三重验证', position: '50%', color: 'var(--down)' },
                { signal: '三星信号', desc: '单一验证通过', position: '10%', color: 'var(--accent-warm)' },
                { signal: '其他情况', desc: '不符合条件', position: '0%', color: 'var(--up)' }
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    background: 'white',
                    padding: '12px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: `2px solid ${item.color}`
                  }}
                >
                  <div style={{ fontWeight: '700', color: item.color, fontSize: '1.2rem' }}>
                    {item.position}
                  </div>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem', marginTop: '4px' }}>
                    {item.signal}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 四、时间分配 */}
      <section id="time" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 20px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid var(--border-subtle)'
        }}>
          四、时间分配(1万小时计划)
        </h2>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            📊 2:4:4黄金比例
          </h3>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '12px',
            border: '2px solid var(--border-subtle)',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            lineHeight: '1.8'
          }}>
            <div style={{ marginBottom: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
              20%时间 - 技术熟练(肌肉记忆)
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              ├─ 每日复盘: 涨停板+跌停板分析
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              ├─ OBV背离: 找出5个底背离+5个顶背离案例
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              ├─ 小仓试错: 100股实盘验证信号准确性
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
              └─ 目标: 看一眼K线就知道当前处于哪个阶段
            </div>

            <div style={{ marginBottom: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
              40%时间 - 心态建设(知行合一)
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              ├─ 忍受孤独: 不符合策略时空仓30天
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              ├─ 接受亏损: 触发止损线机械执行
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              ├─ 情绪隔离: 盈亏不影响下一单决策
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
              └─ 目标: 情绪不随股价波动
            </div>

            <div style={{ marginBottom: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
              40%时间 - 仓位管理(职业秘密)
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              ├─ 分级建仓: 五星5成/三星2成/其他0成
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              ├─ 滚动操作: 利用缩量回踩做T降成本
            </div>
            <div style={{ paddingLeft: '20px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              ├─ 记录复盘: 每笔交易打分(执行vs盈亏)
            </div>
            <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
              └─ 目标: 资金利用效率最大化
            </div>
          </div>
        </div>
      </section>

      {/* 五、风险控制 */}
      <section id="risk" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 20px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid var(--border-subtle)'
        }}>
          五、风险控制(生存第一)
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>
            ⚠️ 四条红线(绝不触碰)
          </h3>
          {[
            {
              title: '1. 系统性风险红线（极端行情应对）',
              content: [
                '定义"极端行情"信号:',
                '- 千股跌停 / 流动性枯竭',
                '- 重大政策黑天鹅',
                '- 北向单日净流出>100亿 + 大盘放量下跌',
                '- 政策性利空(如加息、监管)',
                '- 外部冲击(战争、疫情)',
                '',
                '→ 此时无条件清仓，不等待任何技术反弹',
                '→ 所有技术信号失效 → 立即空仓'
              ]
            },
            {
              title: '2. OBV假信号识别',
              content: [
                '警惕两种情况:',
                '- 游资对倒: OBV暴涨但次日衰竭',
                '- 被动流入: 指数/ETF带动,非主动吸筹',
                '',
                '→ 必须配合"慢、稳、提前"三要素'
              ]
            },
            {
              title: '3. 止损纪律红线',
              content: [
                '设置三层止损:',
                '- 技术止损: 破关键支撑位(如20日线)',
                '- 时间止损: 买入后3天不涨反跌',
                '- 幅度止损: 单笔亏损≥5%立即平仓'
              ]
            },
            {
              title: '4. 策略污染红线',
              content: [
                '一天只用一种策略!',
                '',
                '禁止:',
                '上午玩老热点回流',
                '下午看弱转强',
                '尾盘又盯OBV翘头',
                '',
                '→ 导致执行混乱,策略失效'
              ]
            }
          ].map((item, index) => (
            <div
              key={index}
              style={{
                background: index % 2 === 0 ? 'var(--system-red-light)' : 'var(--accent-warm-soft)',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px',
                borderLeft: '4px solid var(--up)'
              }}
            >
              <div style={{ fontWeight: '700', color: 'var(--up-ink)', marginBottom: '8px' }}>
                {item.title}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--up-ink)', lineHeight: '1.8' }}>
                {item.content.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 保命三原则 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} /> 保命三原则（铁律）
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
              background: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{ background: 'var(--system-red-light)', borderBottom: '2px solid var(--system-red-light)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--up-ink)' }}>风险类型</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--up-ink)' }}>触发条件</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--up-ink)' }}>立即行动</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { type: '系统性风险', trigger: '北向单日净流出 >100亿 + 大盘放量下跌', action: <><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 立即空仓</> },
                  { type: '个股止损', trigger: '单笔亏损 ≥5% 或 破20日线且3日不收回', action: <><XCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 无条件止损</> },
                  { type: '情绪过热', trigger: '龙头股换手率 >35%', action: <><ArrowDown size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 强制减仓50%</> }
                ].map((row, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--system-red-light)', background: index % 2 === 0 ? 'white' : 'var(--system-red-light)' }}>
                    <td style={{ padding: '12px', fontWeight: '600', color: 'var(--up-ink)' }}>{row.type}</td>
                    <td style={{ padding: '12px', color: 'var(--up-ink)' }}>{row.trigger}</td>
                    <td style={{ padding: '12px', fontWeight: '600', color: 'var(--up)' }}>{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 六、复盘与迭代机制 */}
      <section id="path" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 20px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid var(--border-subtle)'
        }}>
          六、复盘与迭代机制
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={18} /> 复盘体系（从错误中学习）
          </h3>
          <div style={{
            background: 'var(--accent-soft)',
            padding: '20px',
            borderRadius: '12px',
            borderLeft: '4px solid var(--accent)',
            marginBottom: '16px'
          }}>
            <p style={{ margin: '0 0 16px', fontWeight: '600', color: 'var(--accent-ink)', fontSize: '0.95rem' }}>
              体系强调执行，但未明确如何从错误中学习，建议建立复盘机制：
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ background: 'var(--accent-soft)', borderBottom: '2px solid var(--accent-soft)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--accent-ink)' }}>复盘维度</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--accent-ink)' }}>记录内容</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: 'var(--accent-ink)' }}>分析目标</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      dim: '每笔交易记录',
                      content: '执行评分(是否按计划买卖) + 结果评分(盈亏)',
                      target: '识别执行偏差'
                    },
                    {
                      dim: '每月分析',
                      content: '哪些信号胜率高? 哪些行情下策略失效?',
                      target: '优化策略匹配'
                    },
                    {
                      dim: '季度迭代',
                      content: '根据个人性格微调仓位比例 / 开发个性化指标组合',
                      target: '形成个人交易系统'
                    }
                  ].map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--accent-soft)' }}>
                      <td style={{ padding: '12px', fontWeight: '600', color: 'var(--accent-ink)' }}>{row.dim}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.content}</td>
                      <td style={{ padding: '12px', color: 'var(--down)', fontWeight: '500' }}>{row.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(255,255,255,0.6)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: 'var(--accent-ink)'
            }}>
              <strong><Lightbulb size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 核心原则：</strong>交易的最高境界不是抓住所有机会，而是放弃大多数机会，只做那3%的完美匹配。
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} /> 进阶修炼路径（三个阶段升级）
          </h3>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '12px',
            border: '2px solid var(--border-subtle)',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            lineHeight: '1.8'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                阶段1: 识别阶段(前3个月)
              </div>
              <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                <div>├─ 能看懂K线+量能+OBV的组合含义</div>
                <div>├─ 能识别当前市场处于哪个环境</div>
                <div>└─ 能判断哪个策略最适合当下</div>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                阶段2: 执行阶段(3-12个月)
              </div>
              <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                <div>├─ 严格按信号买卖,不带情绪</div>
                <div>├─ 止损果断,不找借口</div>
                <div>└─ 空仓时真能忍住不操作</div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                阶段3: 优化阶段(1年后)
              </div>
              <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                <div>├─ 根据个人性格微调仓位比例</div>
                <div>├─ 开发个性化的OBV+MACD组合</div>
                <div>└─ 形成"看一眼就知道"的直觉</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 七、深度理解 */}
      <section id="understanding" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 20px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid var(--border-subtle)'
        }}>
          七、我的深度理解
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={18} /> 这套体系的本质是什么?
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '16px' }}>
            经过对多份文档的研究,我认为这套体系的真正价值不在于具体的技术指标,而在于它构建了一个<strong>完整的认知框架</strong>:
          </p>

          <div style={{ marginBottom: '20px' }}>
            <div style={{
              background: 'var(--accent-soft)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '12px',
              borderLeft: '4px solid var(--accent)'
            }}>
              <div style={{ fontWeight: '700', color: 'var(--accent-ink)', marginBottom: '8px' }}>
                1️⃣ 从"赌"到"算"的进化
              </div>
              <div style={{ color: 'var(--text-primary)', lineHeight: '1.8' }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>普通散户:</span> "我觉得这只股票会涨"(基于感觉)
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>这套体系:</span> "我等到了地量+OBV翘头+30%冰点"(基于证据)
                </div>
                <div style={{ marginTop: '8px', fontWeight: '600', color: 'var(--accent-ink)' }}>
                  这是从赌博思维到概率思维的跨越。
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--system-green-light)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '12px',
              borderLeft: '4px solid var(--down)'
            }}>
              <div style={{ fontWeight: '700', color: 'var(--down-ink)', marginBottom: '8px' }}>
                2️⃣ 从"追"到"等"的心态转变
              </div>
              <div style={{ color: 'var(--text-primary)', lineHeight: '1.8' }}>
                <div style={{ marginBottom: '8px' }}>
                  普通散户追涨杀跌,永远慢一拍
                </div>
                <div>
                  这套体系: 在"没人要"时买入,在"人人抢"时卖出
                </div>
                <div style={{ marginTop: '8px', fontWeight: '600', color: 'var(--down-ink)' }}>
                  这是利用群体恐慌和贪婪的反人性操作。
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--accent-warm-soft)',
              padding: '16px',
              borderRadius: '8px',
              borderLeft: '4px solid var(--accent-warm)'
            }}>
              <div style={{ fontWeight: '700', color: 'var(--warm-ink)', marginBottom: '8px' }}>
                3️⃣ 从"术"到"道"的升华
              </div>
              <div style={{ color: 'var(--text-primary)', lineHeight: '1.8' }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>术层面:</span> OBV、量价、ROE都是工具
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>道层面:</span> 真正理解"钱往哪里去"这个永恒真理
                </div>
                <div style={{ marginTop: '8px', fontWeight: '600', color: 'var(--warm-ink)' }}>
                  当你不再盯着指标,而是盯着资金的脚印时,你就进入了职业选手的视角。
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lightbulb size={18} /> 关键洞察:空仓是最高级的策略
          </h3>
          <div style={{
            background: 'var(--system-red-light)',
            padding: '20px',
            borderRadius: '12px',
            borderLeft: '4px solid var(--up)'
          }}>
            <p style={{ color: 'var(--up-ink)', lineHeight: '1.8', marginBottom: '12px' }}>
              这套体系最反直觉的地方是:<strong>它教你大部分时间什么都不做</strong>。
            </p>
            <div style={{
              background: 'white',
              padding: '16px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: 'var(--up-ink)',
              lineHeight: '1.8'
            }}>
              <div>市场有行情的时间: 30%</div>
              <div>符合你策略的机会: 10%</div>
              <div>真正值得重仓的信号: 3%</div>
              <div style={{ marginTop: '8px', fontWeight: '700' }}>
                → 这意味着97%的时间你应该空仓或轻仓观望!
              </div>
            </div>
            <p style={{ color: 'var(--up-ink)', lineHeight: '1.8', marginTop: '12px', fontWeight: '600' }}>
              能做到这一点的人,已经战胜了90%的交易者。
            </p>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} /> 执行力才是最大瓶颈
          </h3>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '12px',
            border: '2px solid var(--border-subtle)',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            lineHeight: '1.8'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', color: 'var(--up)', marginBottom: '8px' }}>
                散户困境:
              </div>
              <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                知道 → 做不到 → 后悔 → 继续知道 → 继续做不到
              </div>
            </div>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--down)', marginBottom: '8px' }}>
                职业选手路径:
              </div>
              <div style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                知道 → 小仓练习 → 形成肌肉记忆 → 机械执行 → 复盘优化
              </div>
            </div>
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--accent-warm-soft)', borderRadius: '8px', fontWeight: '600', color: 'var(--warm-ink)' }}>
              这套体系已经给出了"地图",现在的任务是成为那个"老木匠"。
            </div>
          </div>
        </div>
      </section>

      {/* 八、立即行动清单 */}
      <section id="action" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 20px 0',
          paddingBottom: '12px',
          borderBottom: '2px solid var(--border-subtle)'
        }}>
          八、立即行动清单
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> 今晚必做(2小时)
          </h3>
          <div style={{
            background: 'var(--system-green-light)',
            padding: '16px',
            borderRadius: '8px',
            borderLeft: '4px solid var(--down)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { id: 'action-1', text: '打印"三问买入法"贴在显示器上' }
              ].map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    transition: 'background 0.2s',
                    textDecoration: checkedItems.has(item.id) ? 'line-through' : 'none',
                    opacity: checkedItems.has(item.id) ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedItems.has(item.id)}
                    onChange={(e) => {
                      const newSet = new Set(checkedItems)
                      if (e.target.checked) {
                        newSet.add(item.id)
                      } else {
                        newSet.delete(item.id)
                      }
                      setCheckedItems(newSet)
                    }}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      accentColor: 'var(--down)'
                    }}
                  />
                  <span style={{ color: 'var(--down-ink)', lineHeight: '1.6' }}>{item.text}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} /> 本周必做(每天1小时)
          </h3>
          <div style={{
            background: 'var(--accent-soft)',
            padding: '16px',
            borderRadius: '8px',
            borderLeft: '4px solid var(--accent)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { id: 'action-4', text: '复盘当日涨停板,标注符合哪个策略' },
                { id: 'action-5', text: '找出1个OBV底背离+1个顶背离实例' },
                { id: 'action-6', text: '模拟盘用100股验证一次买入信号' }
              ].map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    transition: 'background 0.2s',
                    textDecoration: checkedItems.has(item.id) ? 'line-through' : 'none',
                    opacity: checkedItems.has(item.id) ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedItems.has(item.id)}
                    onChange={(e) => {
                      const newSet = new Set(checkedItems)
                      if (e.target.checked) {
                        newSet.add(item.id)
                      } else {
                        newSet.delete(item.id)
                      }
                      setCheckedItems(newSet)
                    }}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      accentColor: 'var(--accent)'
                    }}
                  />
                  <span style={{ color: 'var(--accent-ink)', lineHeight: '1.6' }}>{item.text}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> 本月必做
          </h3>
          <div style={{
            background: 'var(--accent-warm-soft)',
            padding: '16px',
            borderRadius: '8px',
            borderLeft: '4px solid var(--accent-warm)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { id: 'action-7', text: '完成20笔小仓位实盘交易(盈亏不重要)' },
                { id: 'action-8', text: '建立交易日志,每笔打分(策略执行vs最终盈亏)' },
                { id: 'action-9', text: '统计自己最擅长哪个策略,最容易在哪里犯错' }
              ].map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    transition: 'background 0.2s',
                    textDecoration: checkedItems.has(item.id) ? 'line-through' : 'none',
                    opacity: checkedItems.has(item.id) ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedItems.has(item.id)}
                    onChange={(e) => {
                      const newSet = new Set(checkedItems)
                      if (e.target.checked) {
                        newSet.add(item.id)
                      } else {
                        newSet.delete(item.id)
                      }
                      setCheckedItems(newSet)
                    }}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      accentColor: 'var(--accent-warm)'
                    }}
                  />
                  <span style={{ color: 'var(--warm-ink)', lineHeight: '1.6' }}>{item.text}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 最后的话 */}
      <div style={{
        background: 'var(--accent-soft)',
        color: 'var(--text-primary)',
        padding: '28px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '16px', opacity: 0.95 }}>
          <div style={{ fontWeight: '700', marginBottom: '12px' }}>
            "这套体系不会让你一夜暴富,但会让你十年不败。"
          </div>
          <div>
            "当别人恐惧时你贪婪的前提是:你真的看到了资金的脚印。"
          </div>
        </div>
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: '600'
        }}>
          现在,关掉所有学习资料,打开行情软件,开始你的1万小时刻意练习吧! <Rocket size={20} style={{ verticalAlign: 'middle' }} />
        </div>
      </div>

      {/* 返回顶部按钮 */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
            right: '16px',
            width: '48px',
            height: '48px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '1.5rem',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <ChevronUp size={24} />
        </button>
      )}
    </main>
  )
}

