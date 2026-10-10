import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SITE_ORIGIN, formatTitle, resolveSeo } from '../utils/seo'

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string | null): void {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (value === null) { el?.remove(); return }
  if (!el) { el = create(); document.head.appendChild(el) }
  el.setAttribute(attr, value)
}

const meta = (key: 'name' | 'property', name: string) => () => {
  const el = document.createElement('meta')
  el.setAttribute(key, name)
  return el
}

/** 页面拿到数据后（章节标题、公司名）覆盖路由级的通用标题和描述 */
export function usePageSeo(title: string | undefined, description?: string): void {
  useEffect(() => {
    if (!title) return
    const full = formatTitle(title)
    document.title = full
    setMeta('meta[property="og:title"]', meta('property', 'og:title'), 'content', full)
    setMeta('meta[name="twitter:title"]', meta('name', 'twitter:title'), 'content', full)
    if (description) {
      setMeta('meta[name="description"]', meta('name', 'description'), 'content', description)
      setMeta('meta[property="og:description"]', meta('property', 'og:description'), 'content', description)
      setMeta('meta[name="twitter:description"]', meta('name', 'twitter:description'), 'content', description)
    }
  }, [title, description])
}

/** 按路由更新 title / description / canonical / robots / Open Graph（SPA 没有服务端渲染，靠这里补） */
export default function RouteSeo(): null {
  const { pathname } = useLocation()

  useEffect(() => {
    const seo = resolveSeo(pathname)
    const title = formatTitle(seo.title)
    const url = SITE_ORIGIN + (pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/')

    document.title = title
    if (seo.description) {
      setMeta('meta[name="description"]', meta('name', 'description'), 'content', seo.description)
      setMeta('meta[property="og:description"]', meta('property', 'og:description'), 'content', seo.description)
      setMeta('meta[name="twitter:description"]', meta('name', 'twitter:description'), 'content', seo.description)
    }
    setMeta('meta[property="og:title"]', meta('property', 'og:title'), 'content', title)
    setMeta('meta[name="twitter:title"]', meta('name', 'twitter:title'), 'content', title)
    setMeta('meta[property="og:url"]', meta('property', 'og:url'), 'content', url)
    setMeta('meta[name="robots"]', meta('name', 'robots'), 'content', seo.noindex ? 'noindex, nofollow' : null)

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (seo.noindex) { link?.remove(); return }
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link) }
    link.href = url
  }, [pathname])

  return null
}
