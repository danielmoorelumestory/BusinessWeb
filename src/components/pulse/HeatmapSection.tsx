import React, { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Maximize2, Minimize2, Columns2, Rows3, RefreshCw } from 'lucide-react'
import IndexHeatmap from './IndexHeatmap'
import type { IndexMarket } from './IndexHeatmap'

interface HeatmapTab {
  key: string
  label: string
  flag: string
  note: string
  index: IndexMarket
}

// 全部用自绘树图（TradingView Scanner 实时成分 + 行业/市值，腾讯行情实时报价，按行业分块）。
// 注：TradingView 嵌入式热力图 widget 会显示过期的快照（盘中仍是上一交易日涨跌），已弃用。
const TABS: HeatmapTab[] = [
  { key: 'spx', label: '标普500', flag: '🇺🇸', note: '绿涨红跌', index: 'spx' },
  { key: 'ndx', label: '纳斯达克100', flag: '🇺🇸', note: '绿涨红跌', index: 'ndx' },
  { key: 'hsi', label: '恒生指数', flag: '🇭🇰', note: '红涨绿跌', index: 'hsi' },
  { key: 'hstech', label: '恒生科技指数', flag: '🇭🇰', note: '红涨绿跌', index: 'hstech' },
  { key: 'csi500', label: '中证500', flag: '🇨🇳', note: '红涨绿跌', index: 'csi500' },
]

const REFRESH_INTERVAL = 20000 // 每 20 秒请求一次最新报价
type Layout = 'grid' | 'tabs'
const LAYOUT_KEY = 'pulse_heatmap_layout'

function initialLayout(): Layout {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY)
    if (saved === 'grid' || saved === 'tabs') return saved
  } catch { /* 隐私模式等情况下忽略 */ }
  return window.innerWidth >= 1000 ? 'grid' : 'tabs'
}

/**
 * 市场热力图板块：
 * - 并排（默认，宽屏）：2×2 同时展示 4 张热力图，窄屏自动单列；
 * - 标签页：一次只看一张大图（访问过的保持挂载，切回不重新加载）；
 * - 每张图可全屏；布局选择记在本机。
 */
export default function HeatmapSection(): JSX.Element {
  const getInitialTab = (): string => {
    try {
      const param = new URLSearchParams(window.location.search).get('hm')
      if (param && TABS.some(t => t.key === param)) return param
    } catch { /* ignore */ }
    return 'spx'
  }
  const [layout, setLayout] = useState<Layout>(initialLayout)
  const [activeTab, setActiveTab] = useState(getInitialTab)
  const [visited, setVisited] = useState<Set<string>>(() => new Set([getInitialTab()]))
  const [tick, setTick] = useState(0)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const [fullscreenKey, setFullscreenKey] = useState<string | null>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const refreshQuotes = () => {
    setTick(t => t + 1)
    setCountdown(REFRESH_INTERVAL / 1000)
  }

  const changeLayout = (next: Layout) => {
    setLayout(next)
    try { localStorage.setItem(LAYOUT_KEY, next) } catch { /* ignore */ }
  }

  const handleTabClick = (key: string) => {
    setActiveTab(key)
    setVisited(prev => (prev.has(key) ? prev : new Set(prev).add(key)))
  }

  // 自绘指数图每 20 秒刷新；页面在后台时暂停
  useEffect(() => {
    const refresh = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      refreshQuotes()
    }, REFRESH_INTERVAL)
    const cd = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setCountdown(c => (c > 1 ? c - 1 : REFRESH_INTERVAL / 1000))
    }, 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshQuotes()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(refresh); clearInterval(cd); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  // 跟踪浏览器全屏状态（用户按 Esc 退出时同步）
  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement
      const entry = Object.entries(cardRefs.current).find(([, node]) => node === el)
      setFullscreenKey(entry ? entry[0] : null)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = (key: string) => {
    const node = cardRefs.current[key]
    if (!node) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void node.requestFullscreen?.().catch(() => undefined)
  }

  const pill = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: '8px', border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
    background: isActive ? 'var(--accent-soft)' : 'var(--bg-subtle)', color: isActive ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: isActive ? 700 : 500,
    fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
  })

  const renderMap = (tab: HeatmapTab, active: boolean): JSX.Element => <IndexHeatmap market={tab.index} tick={tick} active={active} />

  const renderCard = (tab: HeatmapTab, bodyHeight: string, active: boolean, showTitle: boolean): JSX.Element => {
    const isFs = fullscreenKey === tab.key
    return (
      <div
        key={tab.key}
        ref={node => { cardRefs.current[tab.key] = node }}
        style={{
          display: active ? 'flex' : 'none', flexDirection: 'column', minWidth: 0, background: 'var(--bg-card)',
          border: isFs ? 'none' : '1px solid var(--border-subtle)', borderRadius: '10px', padding: '10px 12px 12px',
          height: isFs ? '100vh' : undefined, boxSizing: 'border-box',
          gridColumn: layout === 'grid' && tab.index === 'csi500' ? '1 / -1' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {showTitle && (
            <>
              <span style={{ fontSize: '1rem' }}>{tab.flag}</span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{tab.label}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: '4px' }}>{tab.note}</span>
            </>
          )}
          <button
            onClick={() => toggleFullscreen(tab.key)}
            title={isFs ? '退出全屏' : '全屏查看'}
            aria-label={isFs ? `退出全屏 ${tab.label}` : `全屏查看 ${tab.label}`}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.72rem' }}
          >
            {isFs ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {isFs ? '退出' : '全屏'}
          </button>
        </div>
        <div style={{ height: isFs ? undefined : bodyHeight, flex: isFs ? 1 : undefined, minHeight: 0 }}>
          {renderMap(tab, active)}
        </div>
      </div>
    )
  }

  const gridMode = layout === 'grid'

  return (
    <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      {/* 标题 + 布局切换 + 刷新状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-strong)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LayoutGrid size={18} color="currentColor" style={{ color: 'var(--accent)' }} /> 市场热力图
        </h3>
        <div role="group" aria-label="热力图布局" style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => changeLayout('grid')} aria-pressed={gridMode} style={pill(gridMode)}><Columns2 size={14} /> 并排</button>
          <button onClick={() => changeLayout('tabs')} aria-pressed={!gridMode} style={pill(!gridMode)}><Rows3 size={14} /> 标签页</button>
        </div>
        <button onClick={refreshQuotes} style={pill(false)}><RefreshCw size={14} /> 刷新行情</button>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          每 {REFRESH_INTERVAL / 1000} 秒请求 · 行情时间见各图
          <span style={{ marginLeft: '8px', color: 'var(--system-gray3)' }}>{countdown}s</span>
        </span>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 10 }}>报价取自腾讯行情实时数据，各图标注行情时间；休市时显示最后交易日行情。</div>

      {gridMode ? (
        // 并排：宽屏 2 列，窄屏 1 列；全部挂载，各自加载
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))', gap: '12px' }}>
          {TABS.map(tab => renderCard(tab, tab.index === 'csi500' ? '600px' : '480px', true, true))}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => handleTabClick(tab.key)} style={pill(tab.key === activeTab)}>
                <span>{tab.flag}</span>{tab.label}
              </button>
            ))}
          </div>
          {/* 访问过的保持挂载（缓存），只显示当前 tab */}
          {TABS.map(tab => (visited.has(tab.key) ? renderCard(tab, 'clamp(460px, 68vh, 760px)', tab.key === activeTab, false) : null))}
        </>
      )}
    </div>
  )
}
