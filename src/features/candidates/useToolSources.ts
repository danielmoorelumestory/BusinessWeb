import { useEffect, useState } from 'react'
import { readToolSources, type ToolSources } from './links'

/** 本机已保存的 DCF、估值与网格记录；从 DCF 等页回来（窗口重新获得焦点）时自动重读 */
export function useToolSources(): ToolSources {
  const [tools, setTools] = useState(readToolSources)
  useEffect(() => {
    const refresh = (): void => { if (document.visibilityState !== 'hidden') setTools(readToolSources()) }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return tools
}
