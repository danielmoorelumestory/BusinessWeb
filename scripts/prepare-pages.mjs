import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve('dist')
// GitHub Pages does not rewrite SPA routes. Keep stable entries and a fallback.
// 主导航的页面都预建入口，直接访问或分享链接时状态码是 200；其余深层路径走 404.html 兜底。
const ROUTES = ['invest', 'invest/ai-tools', 'ai', 'life', 'about', 'notes', 'industry-etf', 'grid-trading', 'grid-trading/records', 'first-book']
for (const route of ROUTES) {
  const directory = resolve(output, route)
  await mkdir(directory, { recursive: true })
  await copyFile(resolve(output, 'index.html'), resolve(directory, 'index.html'))
}
await copyFile(resolve(output, 'index.html'), resolve(output, '404.html'))
