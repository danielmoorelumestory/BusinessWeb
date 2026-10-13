// 财联社板块接口的同源/自有代理：公共 CORS 代理（corsproxy.io、allorigins、cors.sh）已失效。
// Vercel 部署走同源 /api/cls-plate；GitHub Pages 构建通过 VITE_API_BASE 指向 Vercel 站点。
const base = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE ?? '').replace(/\/$/, '')

export function clsProxy(url: string): string {
  const u = new URL(url)
  return `${base}/api/cls-plate?date=${u.searchParams.get('date') ?? ''}&up_limit=${u.searchParams.get('up_limit') ?? '0'}`
}
