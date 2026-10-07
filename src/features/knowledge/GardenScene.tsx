import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { KnowledgeGraph } from './api'
import { GARDEN_PALETTE } from './gardenPalette'

export type GardenNode = { path: string; title: string }
const COLORS = GARDEN_PALETTE.categories
const SEED_COUNT = 90

export function gardenCategory(path: string): string {
  const parts = path.split('/')
  return parts[0] === 'Notion' ? (parts.length > 3 ? parts[2] : 'Notion 导航') : parts[0]
}

export type SceneNode = { id: string; title: string; cat: string; color: string; anchor: [number, number, number]; x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number; [key: string]: unknown }
export type SceneLink = { source: string; target: string }
export type SceneData = { nodes: SceneNode[]; links: SceneLink[]; focus: string; decorative: boolean }

// Evenly spread points on a unit sphere: each category gets its own region of the dandelion head.
function fibonacciSphere(i: number, n: number): [number, number, number] {
  const y = n <= 1 ? 0 : 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996323
  return [Math.cos(a) * r, y, Math.sin(a) * r]
}

function buildData(nodes: GardenNode[], groups: string[], edges: KnowledgeGraph['edges'], focus: string, decorative: boolean): SceneData {
  if (decorative) {
    const seeds: SceneNode[] = Array.from({ length: SEED_COUNT }, (_, i) => ({ id: `seed-${i}`, title: '', cat: '', color: COLORS[i % COLORS.length], anchor: fibonacciSphere(i, SEED_COUNT) }))
    const links = Array.from({ length: 70 }, (_, i) => ({ source: `seed-${i}`, target: `seed-${(i * 7 + 11) % SEED_COUNT}` })).filter(l => l.source !== l.target)
    return { nodes: seeds, links, focus: '', decorative }
  }
  const shown = [...new Set(nodes.map(n => gardenCategory(n.path)))]
  const anchors = new Map(shown.map((name, i) => [name, fibonacciSphere(i, shown.length)]))
  const ids = new Set(nodes.map(n => n.path))
  return {
    focus,
    decorative,
    nodes: nodes.map(n => {
      const cat = gardenCategory(n.path)
      return { id: n.path, title: n.title, cat, color: COLORS[Math.max(0, groups.indexOf(cat)) % COLORS.length], anchor: anchors.get(cat)! }
    }),
    links: edges.filter(e => ids.has(e.source) && ids.has(e.target)).map(e => ({ source: e.source, target: e.target })),
  }
}

export default function GardenScene({ nodes, groups, edges, focus, zoom, decorative, paused = false, onFocus, onBack }: {
  nodes: GardenNode[]; groups: string[]; edges: KnowledgeGraph['edges']; focus: string;
  zoom: number; decorative: boolean; paused?: boolean; onFocus(path: string): void; onBack(): void;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<{ update(data: SceneData): void; setZoom(value: number): void; setPaused(value: boolean): void } | null>(null)
  const onFocusRef = useRef(onFocus), onBackRef = useRef(onBack)
  const [unsupported, setUnsupported] = useState(false)
  const data = useMemo(() => buildData(nodes, groups, edges, focus, decorative), [nodes, groups, edges, focus, decorative])
  const latest = useRef({ data, zoom, paused })
  onFocusRef.current = onFocus; onBackRef.current = onBack
  latest.current = { data, zoom, paused }

  useEffect(() => {
    let disposed = false, dispose = () => {}
    const el = host.current
    if (!el) return
    import('./gardenEngine').then(({ createGardenEngine }) => {
      if (disposed) return
      let engine: ReturnType<typeof createGardenEngine>
      try { engine = createGardenEngine(el, path => onFocusRef.current(path)) } catch { setUnsupported(true); return }
      api.current = engine
      dispose = engine.dispose
      // Only a failure to create the 3D scene means "unsupported"; later errors must not hide a working scene.
      try { engine.update(latest.current.data); engine.setZoom(latest.current.zoom); engine.setPaused(latest.current.paused) } catch (e) { console.error('蒲公英更新失败', e) }
    }).catch(() => { if (!disposed) setUnsupported(true) })
    return () => { disposed = true; api.current = null; dispose() }
  }, [])
  useEffect(() => {
    if (!focus) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onBackRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus])
  useEffect(() => { api.current?.update(data) }, [data])
  useEffect(() => { api.current?.setZoom(zoom) }, [zoom])
  useEffect(() => { api.current?.setPaused(paused) }, [paused])

  return <div className="kb-garden-scene">
    <div className="kb-garden-scene-caption" aria-hidden="true"><span>{focus ? '一颗种子，一片关联' : decorative ? '知识，等待下一阵风' : '让独立的想法相遇'}</span><i /></div>
    {focus && <button className="kb-garden-back" onClick={onBack}>← 返回全景<kbd>Esc</kbd></button>}
    <div ref={host} className="kb-garden-webgl" role="img" aria-label={decorative ? '3D 蒲公英装饰动画，不代表真实笔记' : '3D 蒲公英网络：每颗种子是一篇笔记，亮线是笔记之间的引用'} />
    {unsupported && <p className="kb-garden-fallback-note">当前浏览器无法启用 3D 渲染，请使用右侧列表浏览笔记。</p>}
    {!decorative && <ul className={unsupported ? 'kb-garden-fallback' : 'kb-sr-only'}>{nodes.map(n => <li key={n.path}><button aria-label={`聚焦 ${n.title}`} onClick={() => onFocus(n.path)}>{n.title}</button></li>)}</ul>}
    {!unsupported && <p className="kb-garden-hint" aria-hidden="true">拖拽旋转 · 滚轮缩放 · 悬停点亮关联 · 点击飞入 · Esc 返回</p>}
  </div>
}
