import React from 'react'

export const RELOAD_KEY = 'chunk-reload'
const MAX_ATTEMPTS = 3            // 一个传播窗口内最多自动重试几次
const WINDOW_MS = 90000           // 90 秒窗口：覆盖 Cloudflare Pages 发版传播（约 1~2 分钟）
const DELAYS = [1200, 4000, 10000] // 递增延迟，给 CDN 边缘节点传播新 chunk 的时间

export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err)
  // 前四种：动态 import 直接拉取失败；最后一种：新 index 配旧 chunk 的模块图错配
  // （懒加载模块的 default 求值为 undefined），发版传播期的典型表现
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed|Cannot read properties of undefined \(reading 'default'\)/i.test(msg)
}

interface ReloadState { n: number; first: number }

// 发版后旧 chunk 文件已不存在 / 新旧模块图错配时，自动刷新即可拿到一致的新版本。
// 用递增延迟跨过 CDN 传播窗口，并以计数上限防死循环；返回是否已排定一次刷新。
export function scheduleChunkReload(reload: () => void = () => window.location.reload()): boolean {
  try {
    const now = Date.now()
    const raw = sessionStorage.getItem(RELOAD_KEY)
    let st: ReloadState | null = raw ? JSON.parse(raw) : null
    if (!st || now - st.first > WINDOW_MS) st = { n: 0, first: now } // 新窗口（或首次）
    if (st.n >= MAX_ATTEMPTS) return false                           // 用尽 → 交给手动屏
    const delay = DELAYS[Math.min(st.n, DELAYS.length - 1)]
    st.n += 1
    sessionStorage.setItem(RELOAD_KEY, JSON.stringify(st))
    setTimeout(reload, delay)
    return true
  } catch {
    return false
  }
}

// 页面成功加载后清掉重试计数，让下次发版重新获得完整重试预算
function clearReloadState(): void {
  try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* 忽略 */ }
}

interface Props { children: React.ReactNode; resetKey?: string }
interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidMount(): void {
    if (!this.state.error) clearReloadState() // 正常加载成功，重置重试预算
  }

  componentDidCatch(error: Error): void {
    console.error('[ErrorBoundary]', error)
    if (isChunkLoadError(error)) scheduleChunkReload()
  }

  componentDidUpdate(prev: Props): void {
    // 切换路由后自动清除错误，不用手动刷新
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
    if (!this.state.error) clearReloadState()
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="container page-loading">
        <p>页面加载失败{isChunkLoadError(this.state.error) ? '（站点已更新）' : ''}</p>
        <button onClick={() => window.location.reload()}>刷新重试</button>
      </div>
    )
  }
}
