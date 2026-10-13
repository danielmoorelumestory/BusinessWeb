import { useCallback, useEffect, useRef, useState } from 'react'
import type { MacroSnapshot } from './indicators'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

// 宏观快照只请求一次，切页再回来直接用
let cache: MacroSnapshot | null = null
let liveState: MacroLive = 'idle'

/** idle：未尝试；loading：静态快照已显示，正在取实时数据；live：已合并实时数据；fallback：实时取不到，沿用静态快照 */
export type MacroLive = 'idle' | 'loading' | 'live' | 'fallback'

/** 实时数据优先，没拉到的序列沿用旧值 */
export function mergeLive(old: MacroSnapshot | null, fresh: MacroSnapshot | undefined): MacroSnapshot | null {
  if (!fresh || !fresh.series || !Object.keys(fresh.series).length) return old
  return { ...fresh, series: { ...(old?.series ?? {}), ...fresh.series } } as MacroSnapshot
}

/**
 * 先读每月更新的静态快照（立刻有数），再向 /api/macro 取实时数据覆盖；实时失败不影响页面。
 * refresh()：手动重新取一次实时数据。
 */
export function useMacroSnapshot(): { snap: MacroSnapshot | null; error: boolean; live: MacroLive; refresh: () => Promise<void> } {
  const [snap, setSnap] = useState<MacroSnapshot | null>(cache)
  const [error, setError] = useState(false)
  const [live, setLive] = useState<MacroLive>(liveState)
  const alive = useRef(true)

  const fetchLive = useCallback(async (): Promise<void> => {
    const base = cache
    liveState = 'loading'; if (alive.current) setLive('loading')
    let next = base, state: MacroLive = 'fallback'
    try {
      const res = await fetch(`${API_BASE}/api/macro`, { cache: 'no-store' })
      const body = await res.json().catch(() => null)
      const merged = res.ok && body?.us ? mergeLive(base, body.us as MacroSnapshot) : null
      if (merged && merged !== base) { next = merged; state = 'live' }
    } catch { /* 沿用静态快照 */ }
    cache = next; liveState = state
    if (alive.current) { setSnap(next); setLive(state) }
  }, [])

  useEffect(() => {
    alive.current = true
    if (cache) { if (liveState === 'idle') void fetchLive(); return () => { alive.current = false } }
    fetch(`${import.meta.env.BASE_URL}data/macro-us.json`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then((d: MacroSnapshot) => { cache = d; liveState = 'idle'; if (alive.current) setSnap(d); return fetchLive() })
      .catch(() => { if (alive.current) setError(true) })
    return () => { alive.current = false }
  }, [fetchLive])
  return { snap, error, live, refresh: fetchLive }
}

/** 仅供测试：清掉模块级缓存，避免用例之间互相影响 */
export function resetMacroSnapshotCache(): void { cache = null; liveState = 'idle' }
