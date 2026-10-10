import React from 'react'

const RELOAD_KEY = 'chunk-reload-at'

export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err)
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i.test(msg)
}

// 部署后旧 chunk 文件已不存在时，刷新一次即可拿到新版本；10 秒内只自动刷新一次，避免死循环
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < 10000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

interface Props { children: React.ReactNode; resetKey?: string }
interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('[ErrorBoundary]', error)
    if (isChunkLoadError(error)) reloadOnce()
  }

  componentDidUpdate(prev: Props): void {
    // 切换路由后自动清除错误，不用手动刷新
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
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
