import React, { useEffect, useState } from 'react'
import { PageTabs, PageTitle } from '../components/ui/PageTabs'
import { fetchMarketDataByType, fetchSectorCategories, fetchUSSectorCategories } from '../services/api'
import type { DailyReview, MarketCategory, SectorCategory, NewsSource, StockQuote } from '../types'
import { loadReviews, saveReviews, loadNewsSources, saveNewsSources, loadTombstones, saveTombstones } from '../utils/storage'
import { loadSyncConfig, saveSyncConfig, clearSyncConfig, syncReviews, normalizeReview } from '../features/pulse/cloudSync'
import { validReviewItem } from '../features/pulse/validation'
import { getWeekday, getToday } from '../utils/date'
import { ReviewTable } from '../components/pulse/ReviewTable'
import { NewsSourceSection } from '../components/pulse/NewsSourceSection'
import { MarketCategory as MarketCategoryComponent } from '../components/pulse/MarketCategory'
import { SectorSection } from '../components/pulse/SectorSection'
import HeatmapSection from '../components/pulse/HeatmapSection'
import {
  TrendingUp,
  Globe,
  Globe2,
  Box,
  Repeat,
  ArrowUp,
  ArrowDown,
  Cloud,
  Download,
  Search,
  Settings,
  Upload,
  ArrowRight,
  RefreshCw,
  Link as LinkIcon,
  ShieldCheck,
  Target,
  BarChart2,
  AlertTriangle,
  History
} from 'lucide-react'

export default function Pulse(): JSX.Element {
  const [activeTab, setActiveTab] = useState<'market' | 'analysis'>('market')
  const [categories, setCategories] = useState<MarketCategory[]>([])
  const [sectorCategories, setSectorCategories] = useState<SectorCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [timestamp, setTimestamp] = useState<string>('')

  // 复盘表格状态
  const [reviews, setReviews] = useState<DailyReview[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editDate, setEditDate] = useState<string>('')
  const [formData, setFormData] = useState<Partial<DailyReview>>({})

  // 消息源状态
  const [newsSources, setNewsSources] = useState<NewsSource[]>([])

  // 云端同步状态
  const [showSettings, setShowSettings] = useState(false)
  const [syncConfig, setSyncConfig] = useState(() => loadSyncConfig())
  const [endpointInput, setEndpointInput] = useState(() => loadSyncConfig()?.endpoint ?? (window.location.protocol === 'https:' && !window.location.hostname.endsWith('github.io') ? `${window.location.origin}/api/pulse-sync` : ''))
  const [tokenInput, setTokenInput] = useState('')
  const [syncing, setSyncing] = useState(false)

  // 筛选状态
  const [showFilter, setShowFilter] = useState(false)
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set(['us', 'cn', 'hk', 'global', 'commodity', 'forex']))

  useEffect(() => {
    // 加载本地数据
    setReviews(loadReviews())
    setNewsSources(loadNewsSources())
    // 复盘不再使用 GitHub Gist：清理旧版遗留的 token，避免长期留在浏览器里
    try { localStorage.removeItem('pulse_gist_token'); localStorage.removeItem('pulse_gist_id') } catch { /* 忽略 */ }
    let mounted = true
    const fetchAllData = async () => {
      setLoading(true)
      const categoryConfig = [
        { key: 'us', title: '美股指数', icon: <TrendingUp size={18} />, color: 'var(--accent)', bgColor: 'var(--accent-soft)' },
        { key: 'cn', title: '中国A股', icon: <Globe size={18} />, color: 'var(--system-red)', bgColor: 'var(--system-red-light)' },
        { key: 'hk', title: '港股指数', icon: <Globe2 size={18} />, color: 'var(--system-green)', bgColor: 'var(--system-green-light)' },
        { key: 'global', title: 'G20全球股市', icon: <Globe size={18} />, color: 'var(--accent)', bgColor: 'var(--accent-soft)' },
        { key: 'commodity', title: '大宗商品', icon: <Box size={18} />, color: 'var(--accent-warm)', bgColor: 'var(--accent-warm-soft)' },
        { key: 'forex', title: '外汇债券', icon: <Repeat size={18} />, color: 'var(--system-purple)', bgColor: 'var(--bg-secondary)' },
      ]

      try {
        const [results, cnSectors, usSectors] = await Promise.all([
          Promise.all(
            categoryConfig.map(async (cat) => {
              const data = await fetchMarketDataByType(cat.key as any)
              console.log(`获取 ${cat.title} 数据:`, data.length, '条')
              return { ...cat, data }
            })
          ),
          fetchSectorCategories(),  // 获取中国板块数据
          fetchUSSectorCategories()  // 获取美股板块数据
        ])

        if (mounted) {
          console.log('所有分类数据:', results)
          console.log('筛选条件:', Array.from(filterCategories))
          setCategories(results)
          setSectorCategories([...cnSectors, ...usSectors])  // 合并中国和美股板块
          setTimestamp(new Date().toLocaleString('zh-CN'))
          setLoading(false)
        }
      } catch (error) {
        console.error('获取数据失败:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }
    fetchAllData()
    return () => { mounted = false }
  }, [])

  // 保存复盘数据
  const handleSaveReview = () => {
    if (!formData.date) return

    const newReview: DailyReview = {
      date: formData.date,
      weekday: getWeekday(formData.date),
      ztCount: formData.ztCount || 0,
      ztSealRate: formData.ztSealRate || '',
      ztOpen: formData.ztOpen || 0,
      dtCount: formData.dtCount || 0,
      dtSealRate: formData.dtSealRate || '',
      dtOpen: formData.dtOpen || 0,
      volume: formData.volume || 0,
      upDown: formData.upDown || '',
      shszcy: formData.shszcy || '',
      lbRate: formData.lbRate || '',
      lbCount: formData.lbCount || 0,
      maxBoard: formData.maxBoard || 0,
      top5Amount: formData.top5Amount || 0,
      top5Turnover: formData.top5Turnover || 0,
      inflow: formData.inflow || '',
      outflow: formData.outflow || '',
      updatedAt: new Date().toISOString(),
    }

    // 更新或新增
    const existingIndex = reviews.findIndex(r => r.date === newReview.date)
    let newReviews: DailyReview[]
    if (existingIndex >= 0) {
      newReviews = [...reviews]
      newReviews[existingIndex] = newReview
    } else {
      newReviews = [newReview, ...reviews]
    }

    // 按日期排序
    newReviews.sort((a, b) => b.date.localeCompare(a.date))

    setReviews(newReviews)
    saveReviews(newReviews)
    saveTombstones(loadTombstones().filter(t => t.date !== newReview.date)) // 重新录入同一天：撤销该日墓碑
    setShowForm(false)
    setFormData({})
    setEditDate('')
  }

  // 编辑某天数据
  const handleEdit = (review: DailyReview) => {
    setFormData(review)
    setEditDate(review.date)
    setShowForm(true)
  }

  // 删除某天数据
  const handleDelete = (date: string) => {
    if (confirm(`确定删除 ${date} 的复盘数据吗？\n\n如已开启云同步，下次同步时会从云端一并删除（云端保留最近 30 个历史版本可找回）。`)) {
      const newReviews = reviews.filter(r => r.date !== date)
      setReviews(newReviews)
      saveReviews(newReviews)
      saveTombstones([...loadTombstones().filter(t => t.date !== date), { date, deleted: true, updatedAt: new Date().toISOString() }])
    }
  }

  // 新增今日数据
  const handleAddToday = () => {
    setFormData({ date: getToday() })
    setEditDate('')
    setShowForm(true)
  }

  // 导出数据
  const handleExport = () => {
    const data = {
      reviews,
      exportDate: new Date().toISOString(),
      version: '1.0'
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pulse-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    alert('数据已导出！')
  }

  // 导入数据
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string)

          if (!data || !Array.isArray(data.reviews)) throw new Error('缺少 reviews 数组')
          const now = new Date().toISOString()
          const incoming = (data.reviews as DailyReview[]).map(r => normalizeReview({ ...r, updatedAt: now }))
          const bad = incoming.find(r => !validReviewItem(r))
          if (bad) {
            alert(`导入失败：${String((bad as { date?: unknown }).date)} 的数据不合规（日期/数值/长度），未做任何修改`)
            return
          }
          if (!confirm(`将导入 ${incoming.length} 条复盘，按日期合并（同日期以导入为准，其余本地数据保留）。继续吗？`)) return
          const byDate = new Map(reviews.map(r => [r.date, r]))
          incoming.forEach(r => byDate.set(r.date, r))
          const next = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
          setReviews(next)
          saveReviews(next)
          saveTombstones(loadTombstones().filter(t => !incoming.some(r => r.date === t.date)))

          alert('数据导入成功！已按日期合并')
          // 不刷新页面，数据已通过 state 更新
        } catch (error) {
          alert('导入失败：文件格式错误')
          console.error(error)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }


  const handleRefresh = () => window.location.reload()

  // 保存同步配置（token 仅存本机；保存前确认目标域名）
  const handleSaveSyncConfig = async () => {
    try {
      const saved = await saveSyncConfig({ endpoint: endpointInput.trim(), token: tokenInput.trim() || syncConfig?.token || '' }, domain => window.confirm(
        `即将保存复盘同步目标：${domain}\n只填写你自己部署的服务；确认前不会发出网络请求。继续吗？`))
      if (!saved) { alert('配置未保存：地址必须是 HTTPS，token 至少 32 个字符'); return }
      setSyncConfig(loadSyncConfig()); setTokenInput(''); setShowSettings(false)
      alert('已保存到本机。点击「同步」才会连接云端。')
    } catch { alert('配置保存失败') }
  }

  const handleClearSyncConfig = () => {
    if (!confirm('清除本机保存的同步地址和 token？（不会删除任何复盘数据）')) return
    clearSyncConfig(); setSyncConfig(null); setTokenInput(''); setShowSettings(false)
  }

  // 同步：先读云端 → 合并 → 删除/覆盖需确认 → 带版本号写回
  const handleSync = async () => {
    setSyncing(true)
    const result = await syncReviews(syncConfig, {
      target: (domain, count) => confirm(`即将连接 ${domain} 同步 ${count} 条本地复盘。确认这是你自己部署的服务后继续。`),
      changes: summary => confirm(`本次同步会修改云端：\n新增 ${summary.added.length} 条，覆盖更新 ${summary.updated.length} 条，删除 ${summary.deleted.length} 条${summary.deleted.length ? `\n将删除：${summary.deleted.slice(0, 10).join('、')}${summary.deleted.length > 10 ? '…' : ''}` : ''}\n\n云端会保留最近 30 个历史版本。确认继续？`),
      shrink: () => confirm('云端有效记录将减少超过一半，服务端已拦截。确认这是你想要的删除吗？'),
    })
    setSyncing(false)
    if (result.status === 'synced' && result.reviews) {
      setReviews(result.reviews)
      const sm = result.summary
      alert(`✅ 同步完成：共 ${result.reviews.length} 条${sm ? `\n云端新增 ${sm.added.length}、更新 ${sm.updated.length}、删除 ${sm.deleted.length}；本地更新 ${sm.pulled}` : ''}\n\n同步前的本地数据已留一份备份。`)
    } else if (result.status === 'cancelled') {
      alert('已取消，没有修改云端。')
    } else {
      alert(`❌ 同步未完成：${result.error ?? (result.status === 'not-configured' ? '请先在「云端设置」填写同步地址和 token' : '未知错误')}\n\n本地数据未被改动。`)
    }
  }

  const formatPrice = (price: number, symbol?: string) => {
    if (symbol === 'BTC-USD') return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : ''
    return `${sign}${percent.toFixed(2)}%`
  }

  // 渲染数据卡片
  const renderCard = (stock: StockQuote, color: string) => {
    const isPositive = stock.change >= 0
    const changeColor = isPositive ? 'var(--system-green)' : 'var(--system-red)'

    return (
      <div key={stock.symbol} style={{
        background: 'var(--bg-card)', borderRadius: '12px', padding: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
        gap: '6px', borderLeft: `4px solid ${color}`, transition: 'transform 0.2s, box-shadow 0.2s'
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{stock.name}</span>
          {stock.rsi !== undefined && (
            <span style={{
              fontSize: '0.7rem', padding: '2px 5px', borderRadius: '4px',
              background: stock.rsi >= 70 ? 'var(--system-red-light)' : stock.rsi <= 30 ? 'var(--system-green-light)' : 'var(--bg-secondary)',
              color: stock.rsi >= 70 ? 'var(--system-red)' : stock.rsi <= 30 ? 'var(--system-green)' : 'var(--text-secondary)', fontWeight: '500'
            }}>RSI {stock.rsi.toFixed(0)}</span>
          )}
        </div>
        <div style={{ fontSize: '1.3rem', fontWeight: '700', color: changeColor }}>{formatPrice(stock.price, stock.symbol)}</div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', alignItems: 'center' }}>
          <span style={{ color: changeColor, fontWeight: '500', display: 'flex', alignItems: 'center', gap: '2px' }}>
            {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {formatPrice(Math.abs(stock.change))}
          </span>
          <span style={{ color: changeColor, fontWeight: '600', padding: '1px 5px', borderRadius: '4px', background: isPositive ? 'var(--system-green-light)' : 'var(--system-red-light)' }}>{formatPercent(stock.changePercent)}</span>
        </div>
      </div>
    )
  }

  // 切换筛选分类
  const toggleFilterCategory = (key: string) => {
    const newFilter = new Set(filterCategories)
    if (newFilter.has(key)) {
      newFilter.delete(key)
    } else {
      newFilter.add(key)
    }
    setFilterCategories(newFilter)
  }

  // 重置筛选
  const resetFilter = () => {
    setFilterCategories(new Set(['us', 'cn', 'hk', 'global', 'commodity', 'forex']))
  }

  // 渲染分类
  const renderCategory = (category: MarketCategory) => {
    if (!filterCategories.has(category.key)) {
      return null
    }
    return (
      <div key={category.key} style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '6px 10px',
          background: category.bgColor, borderRadius: '6px', borderLeft: `3px solid ${category.color}`
        }}>
          <span style={{ fontSize: '1rem' }}>{category.icon}</span>
          <span style={{ fontWeight: '600', color: category.color, fontSize: '0.9rem' }}>{category.title}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {category.data.map(stock => renderCard(stock, category.color))}
          {category.data.length === 0 && <div style={{ padding: '16px', color: 'var(--text-tertiary)', fontSize: '0.85rem', gridColumn: '1 / -1', textAlign: 'center' }}>加载中...</div>}
        </div>
      </div>
    )
  }

  // 渲染复盘表格
  const renderReviewTable = () => (
    <ReviewTable
      reviews={reviews}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onExport={handleExport}
      onImport={handleImport}
      onAddToday={handleAddToday}
    />
  )


  // 渲染录入表单
  const renderForm = () => showForm && (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>{editDate ? '编辑' : '录入'}复盘数据</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>日期</label>
            <input type="date" value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>涨停板数</label>
            <input type="number" value={formData.ztCount || ''} onChange={e => setFormData({ ...formData, ztCount: +e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>涨停封板率</label>
            <input type="text" placeholder="如 75%" value={formData.ztSealRate || ''} onChange={e => setFormData({ ...formData, ztSealRate: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>涨停打开数</label>
            <input type="number" value={formData.ztOpen || ''} onChange={e => setFormData({ ...formData, ztOpen: +e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>跌停板数</label>
            <input type="number" value={formData.dtCount || ''} onChange={e => setFormData({ ...formData, dtCount: +e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>跌停封板率</label>
            <input type="text" placeholder="如 50%" value={formData.dtSealRate || ''} onChange={e => setFormData({ ...formData, dtSealRate: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>跌停打开数</label>
            <input type="number" value={formData.dtOpen || ''} onChange={e => setFormData({ ...formData, dtOpen: +e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>量能（亿）</label>
            <input type="number" value={formData.volume || ''} onChange={e => setFormData({ ...formData, volume: +e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>涨-跌</label>
            <input type="text" placeholder="如 3982-1060" value={formData.upDown || ''} onChange={e => setFormData({ ...formData, upDown: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>沪深创</label>
            <input type="text" placeholder="如 +++" value={formData.shszcy || ''} onChange={e => setFormData({ ...formData, shszcy: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>连板晋级率</label>
            <input type="text" placeholder="如 58%" value={formData.lbRate || ''} onChange={e => setFormData({ ...formData, lbRate: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>连板数量</label>
            <input type="number" value={formData.lbCount || ''} onChange={e => setFormData({ ...formData, lbCount: +e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>最高板</label>
            <input type="number" value={formData.maxBoard || ''} onChange={e => setFormData({ ...formData, maxBoard: +e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>成交金额前五</label>
            <input type="number" value={formData.top5Amount || ''} onChange={e => setFormData({ ...formData, top5Amount: +e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>换手率前五</label>
            <input type="number" value={formData.top5Turnover || ''} onChange={e => setFormData({ ...formData, top5Turnover: +e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>流入板块</label>
            <input type="text" placeholder="如 航天、消费电子" value={formData.inflow || ''} onChange={e => setFormData({ ...formData, inflow: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>流出板块</label>
            <input type="text" placeholder="如 医疗、光模块" value={formData.outflow || ''} onChange={e => setFormData({ ...formData, outflow: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={() => { setShowForm(false); setFormData({}); setEditDate('') }}
            style={{ padding: '8px 16px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>取消</button>
          <button onClick={handleSaveReview}
            style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>保存</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px', minHeight: '100vh' }}>
      <PageTitle>全球行情</PageTitle>
      <PageTabs label="全球行情视图" value={activeTab} onChange={setActiveTab} width={1200} items={[
        { id: 'market', label: '市场热力图' },
        { id: 'analysis', label: '每日分析' },
      ]} />
      <div role="tabpanel" aria-label="市场热力图" hidden={activeTab !== 'market'}>
        <HeatmapSection />
      </div>

      <div role="tabpanel" aria-label="每日分析" hidden={activeTab !== 'analysis'}>
        <div className="page-toolbar">
          <span className="page-toolbar__note">{timestamp ? `更新于 ${timestamp}` : '--'}</span>
          {syncConfig && <button className="tool-btn" onClick={handleSync} disabled={syncing}>{syncing ? '⏳ 同步中' : '☁️ 同步'}</button>}
          <button className="tool-btn" onClick={() => setShowSettings(true)}>⚙️ {syncConfig ? '已配置' : '云端设置'}</button>
          <button className="tool-btn" onClick={() => setShowFilter(true)}>🔍 筛选</button>
          <button className="tool-btn tool-btn--primary" onClick={handleRefresh} disabled={loading}>{loading ? '⏳ 加载' : '🔄 刷新'}</button>
        </div>
        {renderReviewTable()}

      {/* 消息源管理 */}
      <NewsSourceSection
        sources={newsSources}
        onUpdate={(sources) => {
          setNewsSources(sources)
          saveNewsSources(sources)
        }}
      />

      {/* 数据分类 */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          ⏳ 数据加载中...
        </div>
      ) : categories.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          ⚠️ 暂无数据，请检查网络连接或刷新页面
        </div>
      ) : (
        categories
          .filter(category => filterCategories.has(category.key))
          .map(category => {
            console.log('渲染分类:', category.key, category.title, '数据条数:', category.data.length)
            return (
              <MarketCategoryComponent key={category.key} category={category} />
            )
          })
      )}

      {/* 板块数据 */}
      {sectorCategories.length > 0 && (
        <>
          {sectorCategories.map(category => (
            <SectorSection key={category.type} category={category} />
          ))}
        </>
      )}

      {/* 资源链接 */}
      <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LinkIcon size={16} /> 常用资源
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { name: '涨停揭秘', url: 'https://stcn.com/article/search.html?keyword=%E6%8F%AD%E7%A7%98%E6%B6%A8%E5%81%9C' },
            { name: '选股通', url: 'https://xuangutong.com.cn/jingxuan' },
            { name: '东方财富', url: 'https://www.eastmoney.com/' },
            { name: '同花顺', url: 'https://www.10jqka.com.cn/' },
            { name: '财联社', url: 'https://www.cls.cn/' },
            { name: 'Yahoo Finance - NAVI', url: 'https://finance.yahoo.com/quote/NAVI/' },
            { name: '美联储官网', url: 'https://www.federalreserve.gov/' },
            { name: '劳工统计局', url: 'https://www.bls.gov/' },
            { name: 'Bloomberg', url: 'https://www.bloomberg.com/' },
            { name: 'Reuters', url: 'https://www.reuters.com/' },
            { name: '经济日历', url: 'https://www.investing.com/economic-calendar/' },
            { name: '恐慌贪婪指数', url: 'https://www.cnn.com/markets/fear-and-greed' },
            { name: 'CBOE 每日市场统计', url: 'https://www.cboe.com/us/options/market_statistics/daily/' },
          ].map(link => (
            <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer"
              style={{ padding: '5px 10px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', textDecoration: 'none', borderRadius: '5px', fontSize: '0.8rem', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>{link.name}</a>
          ))}
        </div>
      </div>
      </div>

      {/* 录入表单弹窗 */}
      {renderForm()}

      {/* 筛选弹窗 */}
      {showFilter && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={20} /> 筛选数据分类
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {[
                { key: 'us', title: '美股指数', icon: <TrendingUp size={16} /> },
                { key: 'cn', title: '中国A股', icon: <Globe size={16} /> },
                { key: 'hk', title: '港股指数', icon: <Globe2 size={16} /> },
                { key: 'global', title: 'G20全球股市', icon: <Globe size={16} /> },
                { key: 'commodity', title: '大宗商品', icon: <Box size={16} /> },
                { key: 'forex', title: '外汇债券', icon: <Repeat size={16} /> },
              ].map(cat => (
                <label key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px', borderRadius: '6px', background: filterCategories.has(cat.key) ? 'var(--accent-soft)' : 'var(--bg-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={filterCategories.has(cat.key)}
                    onChange={() => toggleFilterCategory(cat.key)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '1rem', display: 'flex' }}>{cat.icon}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{cat.title}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={resetFilter}
                style={{ padding: '8px 16px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                重置
              </button>
              <button onClick={() => setShowFilter(false)}
                style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 云端设置弹窗 */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', width: '90%', maxWidth: '500px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cloud size={20} /> 复盘云同步（Supabase）
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.7 }}>
              复盘默认只存在本机。开启后通过你自己部署的接口同步到你自己的 Supabase 数据库：同步前先读取云端并合并，
              删除/覆盖需确认，云端保留最近 30 个历史版本。token 仅保存在本机浏览器，请勿在公共电脑使用。
            </p>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>同步接口地址（HTTPS）</label>
            <input type="url" value={endpointInput} onChange={e => setEndpointInput(e.target.value)} placeholder="https://你的站点/api/pulse-sync" autoComplete="url"
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '14px', boxSizing: 'border-box' }} />
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              专用 Token（至少 32 位，对应 Vercel 变量 PULSE_SYNC_TOKEN）{syncConfig ? '——已保存，留空表示不修改' : ''}
            </label>
            <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder={syncConfig ? '••••••••（已保存）' : '粘贴 token'} autoComplete="new-password"
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '8px 0 16px', lineHeight: 1.6 }}>
              接口只允许同源调用：请在部署了该接口的站点（如 Vercel 站点）上同步；GitHub Pages 版本没有后端，不能同步。
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              {syncConfig && (
                <button onClick={handleClearSyncConfig} style={{ padding: '8px 16px', background: 'var(--system-red-light)', color: 'var(--system-red)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>清除配置</button>
              )}
              <button onClick={() => { setShowSettings(false); setTokenInput('') }}
                style={{ padding: '8px 16px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>取消</button>
              <button onClick={() => void handleSaveSyncConfig()} disabled={!tokenInput.trim() && !syncConfig}
                style={{ padding: '8px 16px', background: tokenInput.trim() || syncConfig ? 'var(--accent)' : 'var(--system-gray3)', color: 'white', border: 'none', borderRadius: '6px', cursor: tokenInput.trim() || syncConfig ? 'pointer' : 'not-allowed', fontWeight: '500' }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
