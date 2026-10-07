import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import type { SceneData, SceneNode } from './GardenScene'
import { GARDEN_PALETTE } from './gardenPalette'

const REST_DISTANCE = 430
const FOCUS_DISTANCE = 300
const glowTexture = (() => {
  let texture: THREE.CanvasTexture | null = null
  return () => {
    if (texture) return texture
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
    return texture = new THREE.CanvasTexture(canvas)
  }
})()

function labelSprite(text: string, color: string = GARDEN_PALETTE.label, size = 34, weight = 600): THREE.Sprite {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')!
  const font = `${weight} ${size}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.font = font
  const label = text.length > 18 ? text.slice(0, 18) + '…' : text
  canvas.width = Math.ceil(ctx.measureText(label).width) + 24; canvas.height = Math.round(size * 1.65)
  ctx.font = font; ctx.textBaseline = 'middle'
  ctx.shadowColor = GARDEN_PALETTE.labelHalo; ctx.shadowBlur = 7
  ctx.fillStyle = color; ctx.fillText(label, 12, canvas.height / 2 + 2)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, depthTest: false }))
  sprite.scale.set(canvas.width / 9, canvas.height / 9, 1)
  sprite.position.y = -9; sprite.renderOrder = 10
  return sprite
}

type LabelSprite = THREE.Sprite & { userData: { w: number; h: number } }
type Seed = SceneNode & { __group?: THREE.Group; __glow?: THREE.Sprite; __core?: THREE.Mesh; __label?: LabelSprite | null }
type LinkEnds = { source?: unknown; target?: unknown }
const endId = (end: unknown) => typeof end === 'object' && end ? (end as SceneNode).id : String(end)

export function createGardenEngine(host: HTMLElement, onFocus: (path: string) => void) {
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  let data: SceneData = { nodes: [], links: [], focus: '', decorative: true }
  let keyNodes = new Set<string>(), degree = new Map<string, number>()
  let pressed: { x: number; y: number; id: string } | null = null
  let hovered = '', paused = false, lastFocus = '\u0000', disposed = false, raf = 0
  let neighbors = new Map<string, Set<string>>()
  const bright = () => data.focus || hovered
  const isRelated = (id: string) => { const b = bright(); return !b || id === b || !!neighbors.get(b)?.has(id) }
  const isActiveLink = (l: LinkEnds) => { const b = bright(); return !!b && (endId(l.source) === b || endId(l.target) === b) }

  const graph = new ForceGraph3D(host, { controlType: 'orbit' })
  graph.backgroundColor('rgba(0,0,0,0)').showNavInfo(false)
    .nodeOpacity(1)
    .nodeLabel(n => (n as SceneNode).title ? `<div class="kb-garden-tip">${(n as SceneNode).title.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)}</div>` : '')
    .linkOpacity(.6).linkCurvature(.12).linkDirectionalParticleSpeed(.007).linkDirectionalParticleResolution(6)
    .cooldownTicks(260).d3VelocityDecay(.3)
    .onNodeHover(n => { hovered = (n as SceneNode | null)?.id ?? ''; host.style.cursor = hovered && !data.decorative ? 'pointer' : ''; syncRotation(); restyle() })

  graph.nodeThreeObject(raw => {
    const n = raw as Seed
    const group = new THREE.Group()
    const color = new THREE.Color(n.color)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, opacity: .4 }))
    glow.scale.set(22, 22, 1)
    const core = new THREE.Mesh(new THREE.SphereGeometry(2, 14, 14), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(.82) }))
    group.add(glow, core)
    // Pappus: fine filaments radiating from the seed, like a tiny dandelion head.
    const pts: number[] = []
    for (let i = 0; i < 12; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(5.5); pts.push(0, 0, 0, v.x, v.y, v.z) }
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .7, depthWrite: false })))
    n.__group = group; n.__glow = glow; n.__core = core; n.__label = null
    return group
  })

  // Dandelion head: nodes are pulled onto a shell, each category toward its own region of the sphere.
  const shell = Object.assign((alpha: number) => {
    const radius = data.focus ? 95 : 70 + Math.sqrt(data.nodes.length) * 16
    for (const n of graph.graphData().nodes as Seed[]) {
      if (n.fx !== undefined) continue
      const x = n.x ?? 0, y = n.y ?? 0, z = n.z ?? 0, r = Math.hypot(x, y, z) || 1, k = (radius - r) / r * alpha * .35
      const v = n as unknown as { vx: number; vy: number; vz: number }
      v.vx += x * k; v.vy += y * k; v.vz += z * k
      if (!data.focus) { const s = alpha * .12; v.vx += (n.anchor[0] * radius - x) * s; v.vy += (n.anchor[1] * radius - y) * s; v.vz += (n.anchor[2] * radius - z) * s }
    }
  }, { initialize() {} })
  graph.d3Force('shell', shell as never)
  graph.d3Force('charge')?.strength(-26)
  graph.d3Force('link')?.distance(34).strength(.12)

  const scene = graph.scene(), renderer = graph.renderer()
  const controls = graph.controls() as { autoRotate: boolean; autoRotateSpeed: number; enableDamping: boolean; dampingFactor: number; minDistance: number; maxDistance: number }
  controls.enableDamping = true; controls.dampingFactor = .08; controls.minDistance = 60; controls.maxDistance = 1100; controls.autoRotateSpeed = .55
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))

  
  // Heart of the dandelion and the spokes that join every seed to it.
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: GARDEN_PALETTE.heart, transparent: true, depthWrite: false, opacity: .6 }))
  heart.scale.set(80, 80, 1)
  const spokes = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .32, depthWrite: false }))
  spokes.frustumCulled = false
  // Drifting dandelion fluff in the background.
  const FLUFF = 160, fluffPos = new Float32Array(FLUFF * 3), fluffSeed = Array.from({ length: FLUFF }, () => Math.random() * Math.PI * 2)
  for (let i = 0; i < FLUFF; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(260 + Math.random() * 520); fluffPos.set([v.x, v.y, v.z], i * 3) }
  const fluff = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(fluffPos, 3)), new THREE.PointsMaterial({ map: glowTexture(), size: 7, color: GARDEN_PALETTE.fluff, transparent: true, opacity: .65, depthWrite: false, sizeAttenuation: true }))
  fluff.frustumCulled = false
  const categoryLabels = new THREE.Group()
  scene.add(heart, spokes, fluff, categoryLabels)

  const updateSpokes = () => {
    const list = graph.graphData().nodes as Seed[]
    const pos = new Float32Array(list.length * 6), col = new Float32Array(list.length * 6)
    list.forEach((n, i) => {
      const c = new THREE.Color(n.color)
      pos.set([0, 0, 0, n.x ?? 0, n.y ?? 0, n.z ?? 0], i * 6); col.set([.89, .71, .42, c.r, c.g, c.b], i * 6)
    })
    spokes.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); spokes.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3))
    spokes.visible = !data.focus
  }
  graph.onEngineTick(updateSpokes)

  function ensureLabel(n: Seed) {
    if (n.__label || !n.__group) return
    const sprite = labelSprite(n.title) as LabelSprite
    sprite.userData = { w: sprite.scale.x, h: sprite.scale.y }
    n.__label = sprite; n.__group!.add(sprite)
  }

  // Labels keep a constant on-screen size, so zooming in leaves room for more of them and zooming out
  // hides whatever no longer fits. Key seeds claim space first, then the best-connected, then the nearest.
  const tmp = new THREE.Vector3()
  function layoutLabels() {
    if (data.decorative) return
    const cam = graph.camera() as THREE.PerspectiveCamera, w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    const camLen = cam.position.length(), k = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * REST_DISTANCE)
    const scale = (obj: THREE.Sprite, dist: number) => { const f = THREE.MathUtils.clamp(dist / REST_DISTANCE, .15, 4); obj.scale.set(obj.userData.w * f, obj.userData.h * f, 1); return f }
    const nodes = graph.graphData().nodes as Seed[], fit: { x0: number; x1: number; y0: number; y1: number }[] = []
    const items = nodes.filter(n => n.title && n.__group).map(n => {
      tmp.set(n.x ?? 0, n.y ?? 0, n.z ?? 0)
      const dist = cam.position.distanceTo(tmp); tmp.project(cam)
      return { n, dist, sx: (tmp.x * .5 + .5) * w, sy: (-tmp.y * .5 + .5) * h, visible: tmp.z < 1 && Math.abs(tmp.x) < 1 && Math.abs(tmp.y) < 1 && dist <= camLen + 12 }
    })
    const highlighted = !!bright()
    if (!highlighted) items.sort((a, b) => Number(keyNodes.has(b.n.id)) - Number(keyNodes.has(a.n.id)) || (degree.get(b.n.id) ?? 0) - (degree.get(a.n.id) ?? 0) || a.dist - b.dist)
    for (const it of items) {
      const n = it.n
      if (highlighted) { if (n.__label?.visible) scale(n.__label, it.dist); continue }
      let show = it.visible
      if (show) {
        ensureLabel(n)
        const sw = n.__label!.userData.w * k, sh = n.__label!.userData.h * k, cy = it.sy + 9 * k
        const box = { x0: it.sx - sw / 2 - 3, x1: it.sx + sw / 2 + 3, y0: cy - sh / 2 - 2, y1: cy + sh / 2 + 2 }
        show = !fit.some(o => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0)
        if (show) fit.push(box)
      }
      if (n.__label) {
        n.__label.visible = show
        if (show) { (n.__label.material as THREE.SpriteMaterial).opacity = 1; const f = scale(n.__label, it.dist); n.__label.position.y = -9 * f }
      }
    }
    // Category names stay legible at any distance and step aside once you are inside the sphere.
    categoryLabels.children.forEach(c => { const s = c as LabelSprite; scale(s, s.position.distanceTo(cam.position)); if (!highlighted) s.material.opacity = camLen < 190 ? 0 : 1 })
  }

  function restyle() {
    const b = bright()
    categoryLabels.visible = !data.focus
    categoryLabels.children.forEach(c => { (c as THREE.Sprite).material.opacity = b ? .18 : 1 })
    layoutLabels()
    for (const n of graph.graphData().nodes as Seed[]) {
      if (!n.__group) continue
      const related = isRelated(n.id), hot = n.id === b
      ;(n.__glow!.material as THREE.SpriteMaterial).opacity = related ? (hot ? .75 : .4) : .05
      n.__glow!.scale.setScalar(hot ? 46 : related && b ? 30 : 22)
      n.__core!.scale.setScalar(hot ? 2.2 : related ? 1 : .55)
      // With nothing highlighted, layoutLabels() decides which titles fit; otherwise show the highlighted neighborhood.
      if (b && !data.decorative && n.title) { ensureLabel(n); n.__label!.visible = related; (n.__label!.material as THREE.SpriteMaterial).opacity = 1 }
      else if (b && n.__label) n.__label.visible = false
    }
    // Re-assigning an accessor makes 3d-force-graph re-evaluate it for every link.
    graph.linkColor(l => isActiveLink(l) ? GARDEN_PALETTE.linkActive : b ? GARDEN_PALETTE.linkDim : GARDEN_PALETTE.linkIdle)
      .linkWidth(l => isActiveLink(l) ? 1.4 : .35)
      .linkDirectionalParticles(l => isActiveLink(l) ? 5 : b || paused ? 0 : 2)
      .linkDirectionalParticleWidth(l => isActiveLink(l) ? 2.4 : 1.2)
      .linkDirectionalParticleColor(l => isActiveLink(l) ? GARDEN_PALETTE.particleActive : GARDEN_PALETTE.particleIdle)
  }

  const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (w && h) { graph.width(w).height(h) } }
  const ro = new ResizeObserver(resize); ro.observe(host); resize()

  const clock = new THREE.Clock()
  let frame = 0
  const tick = () => {
    raf = requestAnimationFrame(tick)
    if (++frame % 6 === 0) layoutLabels()
    if (paused || reduceMotion) return
    const t = clock.getElapsedTime(), p = fluff.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < FLUFF; i++) {
      p.setXYZ(i, p.getX(i) + Math.sin(t * .4 + fluffSeed[i]) * .08, p.getY(i) + .12, p.getZ(i) + Math.cos(t * .3 + fluffSeed[i]) * .08)
      if (p.getY(i) > 800) p.setY(i, -800)
    }
    p.needsUpdate = true
    heart.scale.setScalar(76 + Math.sin(t * 1.6) * 5)
  }
  tick()

  // Spinning stops while the pointer is on a seed or pressed, so the seed you aim at stays put until the click lands.
  function syncRotation() { controls.autoRotate = !paused && !reduceMotion && !hovered && !pressed }
  const setPaused = (value: boolean) => { paused = value; syncRotation(); restyle() }
  setPaused(false)

  // A single press-and-release on a seed focuses it; moving more than a few pixels is a drag, not a click.
  const onDown = (e: PointerEvent) => { if (e.button === 0) { pressed = { x: e.clientX, y: e.clientY, id: hovered }; syncRotation() } }
  const onUp = (e: PointerEvent) => {
    const start = pressed; pressed = null; syncRotation()
    if (!start || e.button !== 0 || data.decorative) return
    const id = hovered || start.id
    if (id && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) onFocus(id)
  }
  host.addEventListener('pointerdown', onDown); host.addEventListener('pointerup', onUp)

  return {
    update(next: SceneData) {
      const old = new Map((graph.graphData().nodes as Seed[]).map(n => [n.id, n]))
      data = next
      neighbors = new Map()
      for (const l of next.links) {
        if (!neighbors.has(l.source)) neighbors.set(l.source, new Set())
        if (!neighbors.has(l.target)) neighbors.set(l.target, new Set())
        neighbors.get(l.source)!.add(l.target); neighbors.get(l.target)!.add(l.source)
      }
      const nodes = next.nodes.map(n => {
        const prev = old.get(n.id), seed: Seed = { ...n }
        if (prev) { seed.x = prev.x; seed.y = prev.y; seed.z = prev.z }
        if (next.focus === n.id) { seed.fx = 0; seed.fy = 0; seed.fz = 0 }
        return seed
      })
      // Key seeds (best-connected overall and within each category) keep their titles visible at rest.
      degree = new Map<string, number>()
      for (const l of next.links) { degree.set(l.source, (degree.get(l.source) ?? 0) + 1); degree.set(l.target, (degree.get(l.target) ?? 0) + 1) }
      const ranked = next.nodes.filter(n => degree.has(n.id)).sort((a, b) => degree.get(b.id)! - degree.get(a.id)!)
      const perCategory = new Map<string, string>()
      for (const n of ranked) if (!perCategory.has(n.cat)) perCategory.set(n.cat, n.id)
      keyNodes = next.decorative ? new Set() : new Set([...ranked.slice(0, 8).map(n => n.id), ...perCategory.values()])
      categoryLabels.clear()
      if (!next.decorative && !next.focus) {
        const radius = 70 + Math.sqrt(next.nodes.length) * 16, seen = new Set<string>()
        for (const n of next.nodes) {
          if (seen.has(n.cat)) continue
          seen.add(n.cat)
          const sprite = labelSprite(n.cat, '#' + new THREE.Color(n.color).multiplyScalar(.72).getHexString(), 44, 700)
          sprite.scale.multiplyScalar(1.15); sprite.userData = { w: sprite.scale.x, h: sprite.scale.y }
          sprite.position.set(n.anchor[0] * (radius + 46), n.anchor[1] * (radius + 46), n.anchor[2] * (radius + 46))
          categoryLabels.add(sprite)
        }
      }
      hovered = ''
      graph.graphData({ nodes, links: next.links.map(l => ({ ...l })) })
      restyle(); updateSpokes()
      graph.d3ReheatSimulation()
      if (next.focus !== lastFocus) {
        lastFocus = next.focus
        const dist = next.focus ? FOCUS_DISTANCE : REST_DISTANCE
        setTimeout(() => { if (!disposed) graph.cameraPosition({ x: dist * .35, y: dist * .22, z: dist }, { x: 0, y: 0, z: 0 }, 1400) }, next.focus ? 200 : 0)
      }
    },
    setZoom(value: number) {
      const cam = graph.camera().position, len = cam.length() || 1, dist = (data.focus ? FOCUS_DISTANCE : REST_DISTANCE) / value
      graph.cameraPosition({ x: cam.x / len * dist, y: cam.y / len * dist, z: cam.z / len * dist }, undefined, 600)
    },
    setPaused,
    dispose() {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); host.removeEventListener('pointerdown', onDown); host.removeEventListener('pointerup', onUp)
      graph.pauseAnimation(); graph._destructor()
    },
  }
}
