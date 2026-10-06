import React, { useEffect, useMemo, useState } from 'react'
import { PageTabs, PageTitle } from '../components/ui/PageTabs'
import ThemeCards from './ThemeCards'

interface TreeNode {
  t: string
  n?: string
  img?: string
  c?: TreeNode[]
}

const BASE = import.meta.env.BASE_URL

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  padding: '24px',
}

function renderTable(text: string): JSX.Element | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2 || !lines.every(l => l.startsWith('|'))) return null
  const rows = lines
    .filter(l => !/^\|[\s:|-]+\|?$/.test(l))
    .map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
  return (
    <div style={{ overflowX: 'auto', margin: '6px 0' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => {
                const Cell = i === 0 ? 'th' : 'td'
                return <Cell key={j} style={{ border: '1px solid var(--system-gray5)', padding: '6px 10px', textAlign: 'left', background: i === 0 ? 'var(--bg-primary)' : undefined }}>{c}</Cell>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function countNodes(n: TreeNode): number {
  return 1 + (n.c || []).reduce((s, c) => s + countNodes(c), 0)
}

function matches(n: TreeNode, q: string): boolean {
  return n.t.toLowerCase().includes(q) || (n.n || '').toLowerCase().includes(q) || (n.c || []).some(c => matches(c, q))
}

function Node({ node, depth, q }: { node: TreeNode; depth: number; q: string }): JSX.Element | null {
  const [open, setOpen] = useState(depth < 1)
  if (q && !matches(node, q)) return null
  const hasKids = !!node.c?.length
  const expanded = q ? true : open
  const table = renderTable(node.t)
  return (
    <div style={{ marginLeft: depth ? 18 : 0, borderLeft: depth ? '1px solid var(--system-gray5)' : 'none', paddingLeft: depth ? 10 : 0 }}>
      <div
        onClick={() => hasKids && setOpen(!open)}
        style={{ display: 'flex', gap: 6, padding: '4px 0', cursor: hasKids ? 'pointer' : 'default', alignItems: 'flex-start' }}
      >
        <span style={{ width: 14, color: 'var(--system-gray)', flexShrink: 0 }}>{hasKids ? (expanded ? '▾' : '▸') : '·'}</span>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.7, fontWeight: depth < 2 ? 600 : 400, fontSize: depth === 0 ? '1.1rem' : '0.92rem', whiteSpace: 'pre-wrap' }}>
          {table || node.t}
          {node.n && <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 400 }}>{node.n}</div>}
          {node.img && (
            <img src={`${BASE}industry/solid-state/${node.img}`} alt="" loading="lazy" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 6, display: 'block' }} />
          )}
        </div>
      </div>
      {hasKids && expanded && node.c!.map((c, i) => <Node key={i} node={c} depth={depth + 1} q={q} />)}
    </div>
  )
}

const SOURCES = {
  solid: { label: '固态电池', file: 'industry/solid-state.json' },
  semi: { label: '半导体产业链', file: 'industry/semiconductor.json' },
} as const
type SourceId = keyof typeof SOURCES
type TabId = SourceId | 'cards'

export default function IndustryLandscape(): JSX.Element {
  const [tab, setTab] = useState<TabId>('solid')
  // 两棵树各自缓存，切换页签不重复请求
  const [trees, setTrees] = useState<Partial<Record<SourceId, TreeNode | null>>>({})
  const [q, setQ] = useState('')
  const tree = tab === 'cards' ? undefined : trees[tab]

  useEffect(() => {
    if (tab === 'cards' || tab in trees) return
    let alive = true
    fetch(`${BASE}${SOURCES[tab].file}`).then(r => r.json())
      .then((data: TreeNode) => { if (alive) setTrees(t => ({ ...t, [tab]: data })) })
      .catch(() => { if (alive) setTrees(t => ({ ...t, [tab]: null })) })
    return () => { alive = false }
  }, [tab, trees])

  const total = useMemo(() => (tree ? countNodes(tree) : 0), [tree])
  return (
    <main>
      <PageTitle>产业格局</PageTitle>
      <PageTabs label="产业格局栏目" value={tab} onChange={id => { setTab(id); setQ('') }}
        items={[...(Object.keys(SOURCES) as SourceId[]).map(id => ({ id: id as TabId, label: SOURCES[id].label })), { id: 'cards' as TabId, label: '主题研究卡' }]} />
      {tab === 'cards' ? <ThemeCards /> : <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 32px' }}>
        <p role="note" style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.7 }}>
          这里是产业结构和技术路线的资料整理，用来看懂产业，不是买入清单。节点里出现的公司只是产业参与者；数据和预测多为早期整理，未逐条注明来源与日期，用前请自行核对。产业增长不等于公司盈利，更不等于股价回报，研究方法见书第31章；主题投资只放主动额度（第9章）。不构成投资建议。
        </p>
        <div style={cardStyle}>
          <input
            value={q}
            onChange={e => setQ(e.target.value.trim().toLowerCase())}
            placeholder={`搜索 ${total} 个节点`}
            aria-label="搜索节点"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', marginBottom: 12, borderRadius: 10, border: '1px solid var(--system-gray4)', fontSize: '0.9rem' }}
          />
          {tree ? <Node key={tab} node={tree} depth={0} q={q} />
            : tree === null ? <p style={{ color: 'var(--system-gray)' }}>加载失败，请刷新重试。</p>
            : <p style={{ color: 'var(--system-gray)' }}>加载中…</p>}
        </div>
      </div>}
    </main>
  )
}
