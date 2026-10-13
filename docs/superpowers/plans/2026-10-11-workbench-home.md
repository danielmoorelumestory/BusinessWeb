# 工作台首页与全站快速跳转 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首页改成自用工作台（常用工具 / 最近访问 / 我的记录 / 读者区），并加全站 ⌘K 页面跳转面板。

**Architecture:** 页面注册表与搜索是 `src/data/siteMap.ts` 里的纯数据和纯函数；最近访问、本机记录各是一个只读/读写 `localStorage` 的小模块，自带 try/catch；跳转面板是一个 context provider，挂在 `App.tsx`，Header 和 Home 通过 `useCommandPalette().open()` 打开。

**Tech Stack:** React 18 + TypeScript + react-router-dom v6 + Vitest + Testing Library，lucide-react 图标，纯 CSS（tokens 在 `src/index.css`）。

**Spec:** `docs/superpowers/specs/2026-10-11-workbench-home-design.md`

## Global Constraints

- 所有现有路由路径不变；不新增路由。
- 不改工具页面内部逻辑与存储格式。
- 样式只用 `src/index.css` 已有 token，不新增颜色。
- 首页文案不得出现起始金额 300，栏目卡片保留「从 *** 到目标 400 万」。
- 触控目标 ≥ 44px；手机断点 `max-width: 767px`（与 Header 的 768 一致）。
- 测试命令：`npm test -- run <path>`；全量 `npm test -- run`、`npm run typecheck`、`npm run build`。

## Review Focus

1. `localStorage` 抛错（隐私模式）→ 首页照常渲染，只是没有最近访问/我的记录；面板照常可用。（Task 2、3 测试覆盖）
2. 焦点在输入框/文本域时按 `/` → 不能抢走输入；⌘K 仍然打开。（Task 4 测试）
3. 关键词无匹配 → 面板显示「没有匹配的页面」，回车不跳转、不报错。（Task 4 测试）
4. 面板打开时路由变化（比如浏览器后退）→ 面板关闭，滚动锁解除。（Task 4 测试）
5. 带 basename 部署（GitHub Pages `/BusinessWeb/`）→ 所有跳转用 react-router 的 `navigate`/`Link`，不拼绝对 URL。（实现约束，Task 4/5 代码审查）

---

### Task 1: 页面注册表与搜索

**Files:**
- Modify: `src/data/siteMap.ts`
- Test: `src/data/siteMap.test.ts`

**Interfaces:**
- Produces:
  - `interface SearchablePage { path: string; label: string; group: string; desc?: string; archived?: boolean }`
  - `interface WorkbenchTool { path: string; label: string; desc: string }`
  - `const SEARCHABLE_PAGES: SearchablePage[]`
  - `const WORKBENCH_TOOLS: WorkbenchTool[]`（8 项，顺序见 spec 2.2）
  - `function searchPages(query: string, pages?: SearchablePage[]): SearchablePage[]`
  - `function findSearchablePage(pathname: string): SearchablePage | null`（精确匹配 path）

- [ ] **Step 1: 写失败测试**（追加到 `siteMap.test.ts`）

```ts
describe('SEARCHABLE_PAGES', () => {
  it('路径不重复，且都能在 App.tsx 的路由里找到', () => {
    const paths = SEARCHABLE_PAGES.map(p => p.path)
    expect(new Set(paths).size).toBe(paths.length)
    for (const p of SEARCHABLE_PAGES) {
      const routePath = p.path.startsWith('/ai/') && p.path !== '/ai/fullstack-roadmap' ? '/ai/:slug' : p.path
      expect(appSource, p.path).toContain(`path="${routePath}"`)
    }
  })
  it('包含一级栏目、投资分组全部链接、AI 方向页与补充页', () => {
    const paths = SEARCHABLE_PAGES.map(p => p.path)
    for (const p of ['/', '/invest', '/knowledge', '/dcf', '/grid-trading/records', '/ai/blog', '/ai/fullstack-roadmap', '/first-book/slow-is-fast']) expect(paths).toContain(p)
  })
  it('已舍弃页面带 archived 标记', () => {
    expect(SEARCHABLE_PAGES.find(p => p.path === '/trading-philosophy')?.archived).toBe(true)
  })
})

describe('WORKBENCH_TOOLS', () => {
  it('8 个常用工具，顺序固定，都在注册表里且有说明', () => {
    expect(WORKBENCH_TOOLS.map(t => t.path)).toEqual([
      '/research-notes', '/valuation', '/dcf', '/grid-trading', '/monitor', '/invest/national-team', '/knowledge', '/first-book',
    ])
    for (const t of WORKBENCH_TOOLS) {
      expect(findSearchablePage(t.path), t.path).toBeTruthy()
      expect(t.desc.length, t.path).toBeGreaterThan(0)
    }
  })
})

describe('searchPages', () => {
  const pages = [
    { path: '/a', label: '网格交易', group: '投资' },
    { path: '/b', label: '网格记录', group: '投资' },
    { path: '/c', label: '公司估值', group: '投资', desc: '含网格说明' },
    { path: '/d', label: '旧网格', group: '已舍弃', archived: true },
    { path: '/dcf', label: 'DCF', group: '投资' },
  ]
  it('空查询返回全部，已舍弃排最后', () => {
    expect(searchPages('', pages).map(p => p.path)).toEqual(['/a', '/b', '/c', '/dcf', '/d'])
  })
  it('label 开头 > label 包含 > 其他字段，已舍弃最后', () => {
    expect(searchPages('网格', pages).map(p => p.path)).toEqual(['/a', '/b', '/c', '/d'])
  })
  it('多词全部命中才算，不区分大小写', () => {
    expect(searchPages('dcf 投资', pages).map(p => p.path)).toEqual(['/dcf'])
    expect(searchPages('网格 记录', pages).map(p => p.path)).toEqual(['/b'])
  })
  it('无匹配返回空数组', () => {
    expect(searchPages('不存在的词', pages)).toEqual([])
  })
})
```

同时把 import 行改为：
`import { INVEST_GROUPS, NAV_ITEMS, SEARCHABLE_PAGES, WORKBENCH_TOOLS, findInvestEntry, findSearchablePage, isNavActive, searchPages } from './siteMap'`

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- run src/data/siteMap.test.ts`
Expected: FAIL（导出不存在）

- [ ] **Step 3: 实现**（追加到 `siteMap.ts` 末尾，顶部加 `import { LAB_DIRECTIONS } from './aiLab'`）

```ts
export interface SearchablePage {
  path: string
  label: string
  group: string
  desc?: string
  archived?: boolean
}

export interface WorkbenchTool {
  path: string
  label: string
  desc: string
}

const EXTRA_PAGES: SearchablePage[] = [
  { path: '/first-book/slow-is-fast', label: '书的目录', group: '投资 · 读这本书', desc: '《正念投资》目录与章节' },
  { path: '/grid-trading/records', label: '网格记录', group: '投资 · 用工具执行', desc: '已保存的网格模拟与回测记录' },
  { path: '/ai/fullstack-roadmap', label: '全栈学习路线', group: 'AI实验室', desc: 'AI 全栈开发学习计划' },
]

export const SEARCHABLE_PAGES: SearchablePage[] = [
  ...NAV_ITEMS.map(i => ({ path: i.path, label: i.label, group: '栏目' })),
  ...INVEST_GROUPS.flatMap(g =>
    g.links.map(l => ({
      path: l.path,
      label: l.label,
      group: `投资 · ${g.title}`,
      desc: l.desc,
      ...(l.archived ? { archived: true } : {}),
    }))
  ),
  ...EXTRA_PAGES,
  ...LAB_DIRECTIONS.map(d => ({ path: `/ai/${d.slug}`, label: d.title, group: 'AI实验室 · 方向', desc: d.reason })),
]

export function findSearchablePage(pathname: string): SearchablePage | null {
  return SEARCHABLE_PAGES.find(p => p.path === pathname) ?? null
}

const descOf = (path: string): string => findSearchablePage(path)?.desc ?? ''

export const WORKBENCH_TOOLS: WorkbenchTool[] = [
  { path: '/research-notes', label: '公司研究', desc: descOf('/research-notes') },
  { path: '/valuation', label: '公司估值', desc: descOf('/valuation') },
  { path: '/dcf', label: 'DCF', desc: descOf('/dcf') },
  { path: '/grid-trading', label: '网格交易', desc: descOf('/grid-trading') },
  { path: '/monitor', label: '宏观温度', desc: descOf('/monitor') },
  { path: '/invest/national-team', label: '国家队持仓', desc: descOf('/invest/national-team') },
  { path: '/knowledge', label: '知识图谱', desc: '个人知识库与笔记关系图' },
  { path: '/first-book', label: '我的书', desc: descOf('/first-book') },
]

/** 关键词按空格切开，每个词都要命中；label 开头 > label 包含 > 其他字段；已舍弃永远最后 */
export function searchPages(query: string, pages: SearchablePage[] = SEARCHABLE_PAGES): SearchablePage[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const scored = pages.flatMap((page, index) => {
    const label = page.label.toLowerCase()
    const haystack = [page.label, page.group, page.desc ?? '', page.path].join(' ').toLowerCase()
    if (!terms.every(t => haystack.includes(t))) return []
    const first = terms[0]
    const rank = !first ? 0 : label.startsWith(first) ? 0 : label.includes(first) ? 1 : 2
    return [{ page, index, rank: rank + (page.archived ? 10 : 0) }]
  })
  return scored.sort((a, b) => a.rank - b.rank || a.index - b.index).map(s => s.page)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- run src/data/siteMap.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/siteMap.ts src/data/siteMap.test.ts
git commit -m "feat(nav): 全站页面注册表、常用工具清单与页面搜索"
```

---

### Task 2: 最近访问

**Files:**
- Create: `src/features/recent-pages/store.ts`
- Create: `src/features/recent-pages/useTrackRecent.ts`
- Test: `src/features/recent-pages/store.test.ts`

**Interfaces:**
- Consumes: `findSearchablePage(pathname)`（Task 1）
- Produces:
  - `RECENT_PAGES_KEY = 'businessweb.recent-pages.v1'`
  - `readRecent(): string[]`（最多 6 条路径，最新在前；只返回仍在注册表里的路径）
  - `pushRecent(path: string): void`
  - `useTrackRecent(): void`（在 Router 内调用）

- [ ] **Step 1: 写失败测试**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RECENT_PAGES_KEY, pushRecent, readRecent } from './store'

afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('recent pages', () => {
  it('最新在前、去重、最多 6 条', () => {
    for (const p of ['/dcf', '/valuation', '/monitor', '/dcf', '/pulse', '/invest', '/knowledge', '/about']) pushRecent(p)
    expect(readRecent()).toEqual(['/about', '/knowledge', '/invest', '/pulse', '/dcf', '/monitor'])
  })
  it('首页与注册表外的路径不记录', () => {
    pushRecent('/'); pushRecent('/research-notes/us/AAPL'); pushRecent('/nope')
    expect(readRecent()).toEqual([])
  })
  it('存储里的脏数据被过滤', () => {
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(['/dcf', 3, '/gone', null]))
    expect(readRecent()).toEqual(['/dcf'])
    localStorage.setItem(RECENT_PAGES_KEY, '{bad json')
    expect(readRecent()).toEqual([])
  })
  it('localStorage 抛错时返回空数组，写入不抛', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    expect(readRecent()).toEqual([])
    expect(() => pushRecent('/dcf')).not.toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — `npm test -- run src/features/recent-pages` → FAIL（模块不存在）

- [ ] **Step 3: 实现**

`store.ts`：

```ts
import { findSearchablePage } from '../../data/siteMap'

export const RECENT_PAGES_KEY = 'businessweb.recent-pages.v1'
const MAX = 6

const trackable = (path: unknown): path is string =>
  typeof path === 'string' && path !== '/' && findSearchablePage(path) !== null

export function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_PAGES_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(trackable).slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushRecent(path: string): void {
  if (!trackable(path)) return
  try {
    const next = [path, ...readRecent().filter(p => p !== path)].slice(0, MAX)
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next))
  } catch {
    // 存储不可用时静默放弃：最近访问只是便利功能
  }
}
```

`useTrackRecent.ts`：

```ts
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { pushRecent } from './store'

/** 每次路由变化记录一次；注册表外的路径由 pushRecent 自己忽略 */
export function useTrackRecent(): void {
  const { pathname } = useLocation()
  useEffect(() => {
    pushRecent(pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname)
  }, [pathname])
}
```

- [ ] **Step 4: 跑测试确认通过** — 同上命令 → PASS

- [ ] **Step 5: Commit** — `git add src/features/recent-pages && git commit -m "feat(nav): 记录本机最近访问页面"`

---

### Task 3: 本机记录汇总

**Files:**
- Create: `src/features/workbench/localRecords.ts`
- Test: `src/features/workbench/localRecords.test.ts`

**Interfaces:**
- Consumes: `readRecords()`（grid repository）、`loadDcfRecords()`、`loadReports()`、`loadLocal()`（candidates）—— 均已存在且内部已 try/catch。
- Produces:
  - `type LocalRecordKind = 'grid' | 'dcf' | 'valuation' | 'candidates'`
  - `interface LocalRecordSummary { kind: LocalRecordKind; label: string; path: string; count: number; latestName: string; latestDate: string }`（`latestDate` 为 `YYYY-MM-DD`）
  - `function summarizeLocalRecords(): LocalRecordSummary[]`（只返回 count > 0 的类别，顺序 grid、dcf、valuation、candidates）

- [ ] **Step 1: 写失败测试**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { summarizeLocalRecords } from './localRecords'
import * as grid from '../grid-trading/repository'
import * as dcf from '../dcf/storage'
import * as valuation from '../valuation/storage'
import * as candidates from '../candidates/store'

afterEach(() => vi.restoreAllMocks())

const empty = () => {
  vi.spyOn(grid, 'readRecords').mockReturnValue([])
  vi.spyOn(dcf, 'loadDcfRecords').mockReturnValue([])
  vi.spyOn(valuation, 'loadReports').mockReturnValue([])
  vi.spyOn(candidates, 'loadLocal').mockReturnValue([])
}

describe('summarizeLocalRecords', () => {
  it('都没有数据时返回空数组', () => {
    empty()
    expect(summarizeLocalRecords()).toEqual([])
  })

  it('按最新时间取最近一条，只返回有数据的类别', () => {
    empty()
    vi.spyOn(grid, 'readRecords').mockReturnValue([
      { id: '1', savedAt: '2026-09-01T00:00:00Z', row: { name: '沪深300ETF', code: '510300' }, result: {} },
      { id: '2', savedAt: '2026-08-01T00:00:00Z', updatedAt: '2026-10-05T08:00:00Z', row: { name: '中证500ETF', code: '510500' }, result: {} },
    ] as never)
    vi.spyOn(candidates, 'loadLocal').mockReturnValue([
      { market: 'us', code: 'AAPL', addedAt: '2026-10-01T00:00:00Z' },
      { market: 'cn', code: '600519', addedAt: '2026-10-09T00:00:00Z' },
    ])
    expect(summarizeLocalRecords()).toEqual([
      { kind: 'grid', label: '网格记录', path: '/grid-trading/records', count: 2, latestName: '中证500ETF', latestDate: '2026-10-05' },
      { kind: 'candidates', label: '候选池', path: '/research-notes', count: 2, latestName: '600519', latestDate: '2026-10-09' },
    ])
  })

  it('DCF 与估值报告取公司名', () => {
    empty()
    vi.spyOn(dcf, 'loadDcfRecords').mockReturnValue([{ company: '贵州茅台', code: '600519', savedAt: '2026-10-02T00:00:00Z' }] as never)
    vi.spyOn(valuation, 'loadReports').mockReturnValue([{ snapshot: { security: { name: '腾讯控股', code: '00700' } }, createdAt: '2026-10-03T00:00:00Z' }] as never)
    const out = summarizeLocalRecords()
    expect(out.map(r => [r.kind, r.latestName, r.latestDate])).toEqual([
      ['dcf', '贵州茅台', '2026-10-02'],
      ['valuation', '腾讯控股', '2026-10-03'],
    ])
  })

  it('某个来源抛错时跳过该类，不影响其他', () => {
    empty()
    vi.spyOn(grid, 'readRecords').mockImplementation(() => { throw new Error('boom') })
    vi.spyOn(candidates, 'loadLocal').mockReturnValue([{ market: 'us', code: 'MSFT', addedAt: '2026-10-01T00:00:00Z' }])
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(summarizeLocalRecords().map(r => r.kind)).toEqual(['candidates'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — `npm test -- run src/features/workbench` → FAIL

- [ ] **Step 3: 实现**

```ts
import { readRecords } from '../grid-trading/repository'
import { loadDcfRecords } from '../dcf/storage'
import { loadReports } from '../valuation/storage'
import { loadLocal } from '../candidates/store'

export type LocalRecordKind = 'grid' | 'dcf' | 'valuation' | 'candidates'

export interface LocalRecordSummary {
  kind: LocalRecordKind
  label: string
  path: string
  count: number
  latestName: string
  latestDate: string
}

interface Source {
  kind: LocalRecordKind
  label: string
  path: string
  read: () => Array<{ name: string; at: string }>
}

const SOURCES: Source[] = [
  { kind: 'grid', label: '网格记录', path: '/grid-trading/records',
    read: () => readRecords().map(r => ({ name: r.row.name || r.row.code, at: r.updatedAt ?? r.savedAt })) },
  { kind: 'dcf', label: 'DCF 记录', path: '/dcf',
    read: () => loadDcfRecords().map(r => ({ name: r.company || r.code, at: r.savedAt })) },
  { kind: 'valuation', label: '估值报告', path: '/valuation',
    read: () => loadReports().map(r => ({ name: r.snapshot.security.name || r.snapshot.security.code, at: r.createdAt })) },
  { kind: 'candidates', label: '候选池', path: '/research-notes',
    read: () => loadLocal().map(c => ({ name: c.code, at: c.addedAt })) },
]

const time = (iso: string): number => {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

/** 汇总本机各工具已保存的记录；任何一类读取失败都只跳过该类 */
export function summarizeLocalRecords(): LocalRecordSummary[] {
  return SOURCES.flatMap(source => {
    try {
      const items = source.read()
      if (items.length === 0) return []
      const latest = items.reduce((a, b) => (time(b.at) > time(a.at) ? b : a))
      return [{
        kind: source.kind,
        label: source.label,
        path: source.path,
        count: items.length,
        latestName: latest.name,
        latestDate: latest.at.slice(0, 10),
      }]
    } catch (error) {
      console.warn(`[workbench] 读取${source.label}失败`, error)
      return []
    }
  })
}
```

- [ ] **Step 4: 跑测试确认通过** — 同上 → PASS

- [ ] **Step 5: Commit** — `git add src/features/workbench && git commit -m "feat(home): 汇总本机网格、DCF、估值与候选池记录"`

---

### Task 4: ⌘K 跳转面板 + 顶栏按钮 + App 挂载

**Files:**
- Create: `src/components/CommandPalette.tsx`
- Create: `src/styles/command-palette.css`
- Modify: `src/components/Header.tsx`（加搜索按钮）
- Modify: `src/App.tsx`（包 provider、调用 `useTrackRecent`）
- Test: `src/components/CommandPalette.test.tsx`、`src/components/Header.test.tsx`

**Interfaces:**
- Consumes: `searchPages`、`findSearchablePage`、`SearchablePage`（Task 1）；`readRecent`（Task 2）；`useTrackRecent`（Task 2）
- Produces:
  - `export function CommandPaletteProvider({ children }: { children: React.ReactNode }): JSX.Element`（必须在 Router 内）
  - `export function useCommandPalette(): { open: () => void }`（provider 外调用返回 no-op，便于单测独立渲染 Header/Home）

行为要点（spec 3.2）：
- 全局 keydown：`(metaKey||ctrlKey) && key.toLowerCase()==='k'` → `preventDefault` 并切换打开；`key==='/'` 且目标不是 input/textarea/select/contentEditable → 打开。
- 打开时：记录 `document.activeElement`，聚焦输入框；body `overflow: hidden`；关闭时恢复两者。
- 列表：查询为空 → 先「最近访问」（`readRecent().map(findSearchablePage)`），再全部页面（`searchPages('')`，最近访问里出现过的不重复）；查询非空 → `searchPages(q)`。
- ↑/↓ 循环移动 `active`，Enter 跳 `items[active]`；`scrollIntoView({ block: 'nearest' })`；`onMouseMove` 设 active。
- Tab/Shift+Tab：面板内只有输入框和关闭按钮可聚焦，循环在两者之间（列表项用 `aria-activedescendant`，不进入 Tab 序列）。
- 路由变化时关闭。
- 无结果显示 `没有匹配的页面`。
- ARIA：容器 `role="dialog" aria-modal="true" aria-label="跳转到页面"`；输入框 `role="combobox" aria-expanded aria-controls aria-activedescendant`；列表 `role="listbox"`，项 `role="option" aria-selected`。

- [ ] **Step 1: 写失败测试** `src/components/CommandPalette.test.tsx`

```tsx
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { CommandPaletteProvider, useCommandPalette } from './CommandPalette'
import { RECENT_PAGES_KEY } from '../features/recent-pages/store'

afterEach(() => { cleanup(); localStorage.clear(); document.body.style.overflow = '' })

function Where(): JSX.Element { return <p data-testid="where">{useLocation().pathname}</p> }
function Opener(): JSX.Element { const { open } = useCommandPalette(); return <button onClick={open}>打开</button> }
function Back(): JSX.Element { const nav = useNavigate(); return <button onClick={() => nav('/about')}>去关于</button> }

const setup = (path = '/') => render(
  <MemoryRouter initialEntries={[path]}>
    <CommandPaletteProvider>
      <Opener /><Back /><input aria-label="别的输入框" />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </CommandPaletteProvider>
  </MemoryRouter>
)
const dialog = () => screen.queryByRole('dialog', { name: '跳转到页面' })

describe('CommandPalette', () => {
  it('⌘K 打开并聚焦输入框，Esc 关闭并把焦点还回去', () => {
    setup()
    const opener = screen.getByRole('button', { name: '打开' })
    opener.focus()
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(dialog()).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('combobox'))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('Ctrl+K 也能打开；在别的输入框里按 / 不打开', () => {
    setup()
    const other = screen.getByLabelText('别的输入框')
    other.focus()
    fireEvent.keyDown(other, { key: '/' })
    expect(dialog()).toBeNull()
    fireEvent.keyDown(other, { key: 'k', ctrlKey: true })
    expect(dialog()).toBeTruthy()
  })

  it('不在输入框时按 / 打开', () => {
    setup()
    fireEvent.keyDown(document.body, { key: '/' })
    expect(dialog()).toBeTruthy()
  })

  it('输入后回车跳到第一项，面板关闭', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '打开' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dcf' } })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(screen.getByTestId('where').textContent).toBe('/dcf')
    expect(dialog()).toBeNull()
  })

  it('↓ 移动高亮后回车跳到第二项', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '打开' }))
    const box = screen.getByRole('combobox')
    fireEvent.change(box, { target: { value: '网格' } })
    const options = screen.getAllByRole('option')
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')
    const target = options[1].getAttribute('data-path')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(screen.getByTestId('where').textContent).toBe(target)
  })

  it('无匹配时提示，回车不跳转', () => {
    setup('/about')
    fireEvent.click(screen.getByRole('button', { name: '打开' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzz不存在' } })
    expect(screen.getByText('没有匹配的页面')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(screen.getByTestId('where').textContent).toBe('/about')
  })

  it('查询为空时先列最近访问', () => {
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(['/monitor']))
    setup()
    fireEvent.click(screen.getByRole('button', { name: '打开' }))
    expect(screen.getByText('最近访问')).toBeTruthy()
    expect(screen.getAllByRole('option')[0].getAttribute('data-path')).toBe('/monitor')
  })

  it('路由变化时自动关闭', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '打开' }))
    act(() => { fireEvent.click(screen.getByRole('button', { name: '去关于', hidden: true })) })
    expect(dialog()).toBeNull()
  })
})
```

`Header.test.tsx` 追加：

```tsx
  it('有「跳转到页面」搜索按钮', () => {
    renderAt('/')
    expect(screen.getAllByRole('button', { name: /跳转到页面/ }).length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: 跑测试确认失败** — `npm test -- run src/components/CommandPalette.test.tsx src/components/Header.test.tsx` → FAIL

- [ ] **Step 3: 实现 `CommandPalette.tsx`**（完整代码见提交；结构如下）

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, X, CornerDownLeft } from 'lucide-react'
import { findSearchablePage, searchPages, type SearchablePage } from '../data/siteMap'
import { readRecent } from '../features/recent-pages/store'
import '../styles/command-palette.css'

const PaletteContext = createContext<{ open: () => void }>({ open: () => {} })
export const useCommandPalette = () => useContext(PaletteContext)

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

interface Section { title: string; items: SearchablePage[] }

function buildSections(query: string): Section[] {
  if (query.trim()) return [{ title: '搜索结果', items: searchPages(query) }]
  const recent = readRecent().map(findSearchablePage).filter((p): p is SearchablePage => p !== null)
  const seen = new Set(recent.map(p => p.path))
  const rest = searchPages('').filter(p => !seen.has(p.path))
  return [...(recent.length ? [{ title: '最近访问', items: recent }] : []), { title: '全部页面', items: rest }]
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [isOpen, setOpen] = useState(false)
  const open = useCallback(() => setOpen(true), [])
  const { pathname } = useLocation()

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(v => !v); return }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) { e.preventDefault(); setOpen(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo(() => ({ open }), [open])
  return (
    <PaletteContext.Provider value={value}>
      {children}
      {isOpen && <Palette onClose={() => setOpen(false)} />}
    </PaletteContext.Provider>
  )
}

function Palette({ onClose }: { onClose: () => void }): JSX.Element {
  // query / active state；sections = useMemo(buildSections)；flat = sections.flatMap(items)
  // mount: 记住 activeElement、聚焦 input、锁滚动；unmount: 恢复
  // onKeyDown: Escape→onClose；ArrowDown/Up 循环；Enter→go(flat[active])；Tab 在 input 与关闭按钮之间循环
  // go(page): navigate(page.path)（路由变化会触发 provider 关闭）
  // 渲染：遮罩（点击关闭）+ role=dialog 面板 + combobox 输入 + listbox 分组 + 空状态 + 底部键位提示
}
```

- [ ] **Step 4: 实现 `command-palette.css`**：遮罩 `position: fixed; inset: 0; background: rgba(58,58,52,.32)`；面板 `max-width: 640px; margin: 12vh auto 0; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg)`；列表 `max-height: min(60vh, 480px); overflow-y: auto`；选项 `min-height: 44px`，高亮 `background: var(--accent-soft); color: var(--accent-ink)`；`@media (max-width: 767px)` 面板全屏 `margin: 0; height: 100dvh; border-radius: 0; padding-top: var(--safe-top)`，列表 `max-height: none; flex: 1`；`prefers-reduced-motion` 去掉入场动画。

- [ ] **Step 5: 改 `Header.tsx`**：`import { Menu, Search, X } from 'lucide-react'`、`import { useCommandPalette } from './CommandPalette'`。在 `site-nav` 后、`site-menu-btn` 前加：

```tsx
<button type="button" className="site-search-btn" aria-label="跳转到页面（⌘K）" onClick={open}>
  <Search size={18} aria-hidden="true" />
  <span className="site-search-btn__text">跳转</span>
  <kbd className="site-search-btn__kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
</button>
```

`isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)`。样式加到 `src/styles/shell.css` 的 header 区域：桌面显示文字与 kbd；`max-width: 767px` 只显示图标、44×44。

- [ ] **Step 6: 改 `App.tsx`**：在 `BrowserRouter` 内用 `<CommandPaletteProvider>` 包住 `RouteSeo` 到 `Footer` 的全部内容；新增 `function RecentTracker(): null { useTrackRecent(); return null }` 并放进去。

- [ ] **Step 7: 跑测试确认通过** — Step 2 的命令加 `src/App.test.tsx` → PASS

- [ ] **Step 8: Commit** — `git add src/components/CommandPalette.tsx src/components/CommandPalette.test.tsx src/styles/command-palette.css src/components/Header.tsx src/components/Header.test.tsx src/styles/shell.css src/App.tsx && git commit -m "feat(nav): ⌘K 全站页面跳转面板与顶栏搜索按钮"`

---

### Task 5: 工作台首页 + 名句移到关于页

**Files:**
- Modify: `src/pages/Home.tsx`、`src/styles/home.css`、`src/pages/About.tsx`
- Test: `src/pages/Home.test.tsx`、`src/pages/About.test.tsx`

**Interfaces:**
- Consumes: `WORKBENCH_TOOLS`、`findSearchablePage`（Task 1）；`readRecent`（Task 2）；`summarizeLocalRecords`（Task 3）；`useCommandPalette`（Task 4）

- [ ] **Step 1: 改测试**。`Home.test.tsx`：删掉「投资大师名句」用例和「最近更新为 null」断言以外保持；新增：

```tsx
  it('第一屏是工作台：标题、跳转按钮、8 个常用工具', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: '工作台' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /跳转到页面/ })).toBeTruthy()
    const tools = within(screen.getByRole('region', { name: '常用工具' })).getAllByRole('link')
    expect(tools.map(a => a.getAttribute('href'))).toEqual(WORKBENCH_TOOLS.map(t => t.path))
  })

  it('本机没有数据时不显示最近访问和我的记录', () => {
    localStorage.clear()
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.queryByRole('heading', { name: '最近访问' })).toBeNull()
    expect(screen.queryByRole('heading', { name: '我的记录' })).toBeNull()
  })

  it('有最近访问时显示对应链接', () => {
    localStorage.setItem('businessweb.recent-pages.v1', JSON.stringify(['/monitor', '/dcf']))
    render(<MemoryRouter><Home /></MemoryRouter>)
    const list = screen.getByRole('region', { name: '最近访问' })
    expect(within(list).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['/monitor', '/dcf'])
    localStorage.clear()
  })

  it('有候选池时显示我的记录卡片', () => {
    localStorage.setItem('rn-candidates', JSON.stringify([{ market: 'us', code: 'AAPL', addedAt: '2026-10-01T00:00:00.000Z' }]))
    render(<MemoryRouter><Home /></MemoryRouter>)
    const box = screen.getByRole('region', { name: '我的记录' })
    expect(within(box).getByRole('link', { name: /候选池/ }).getAttribute('href')).toBe('/research-notes')
    expect(box.textContent).toContain('1 条')
    localStorage.clear()
  })
```

原首屏用例改为：书名标题现在是 `h2`（`getByRole('heading', { level: 2, name: /正念投资/ })`），其余断言不变。
`About.test.tsx` 新增：

```tsx
  it('底部有投资大师名句 8 条', () => {
    mockFetchOnce(() => new Promise(() => {}))
    const { container } = render(<MemoryRouter><About /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 2, name: '投资大师名句' })).toBeTruthy()
    expect(container.querySelectorAll('section.quotes blockquote').length).toBe(8)
  })
```

- [ ] **Step 2: 跑测试确认失败** — `npm test -- run src/pages/Home.test.tsx src/pages/About.test.tsx` → FAIL

- [ ] **Step 3: 重写 `Home.tsx`**：结构 `main.container.home` →
  1. `header.home-desk`：`h1` 工作台 + `button.home-jump`（`aria-label="跳转到页面"`，显示「跳转到页面…」与 kbd，`onClick={open}`）
  2. `section[aria-labelledby] 常用工具`：`ul.home-tools` 8 张卡（lucide 图标映射：BookOpenText/Calculator/LineChart/Grid3x3/Thermometer/Landmark/Network/BookMarked → 按 path 选）
  3. 最近访问（`readRecent()` 非空才渲染）：`ul.home-recent` 胶囊
  4. 我的记录（`summarizeLocalRecords()` 非空才渲染）：`ul.home-records` 卡片「label / N 条 / 最近：name · date」
  5. `section.home-book-band`：`h2`《正念投资》+ 副标题 + 两个按钮 + 小书封（保留现有 `.home-book` 结构，缩小尺寸）
  6. 三个栏目（现有 `COLUMNS` 与样式不变）
  读取用 `useState(() => readRecent())` 同步初始化（spec 2.7）。
- [ ] **Step 4: 改 `About.tsx`**：在留言区前加名句区（原 Home 的 `section.home-quotes.quotes` 结构，类名改 `about-quotes quotes`），import `QUOTES`；样式从 home.css 挪到 shell.css。
- [ ] **Step 5: 重写 `home.css`**：工作台区块样式（工具网格桌面 4 列 / ≤1023px 2 列 / ≤767px 2 列紧凑；卡片 min-height 72px；胶囊横向滚动 `overflow-x: auto; scrollbar-width: none`）；书横幅高度减半（`padding: 32px`，书封宽度 140px，≤767px 隐藏书封）。
- [ ] **Step 6: 跑测试确认通过** — Step 2 命令 → PASS
- [ ] **Step 7: Commit** — `git add src/pages/Home.tsx src/pages/Home.test.tsx src/styles/home.css src/pages/About.tsx src/pages/About.test.tsx src/styles/shell.css && git commit -m "feat(home): 首页改为工作台，名句移到关于页"`

---

### Task 6: 全量验证与人工验收

- [ ] `npm test -- run` 全绿（与改动前基线对比，不新增失败）
- [ ] `npm run typecheck` 通过
- [ ] `npm run build` 通过
- [ ] `npm run dev`，浏览器在 1280×800 与 390×844 下检查：首页第一屏可见常用工具；⌘K / `/` 打开面板，键盘可完成跳转；手机全屏面板；顶栏按钮不挤压导航
- [ ] 发现问题就修，修完重新跑以上三条命令
