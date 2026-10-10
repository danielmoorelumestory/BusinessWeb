import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = (process.env.VITE_SITE_URL || 'https://business-web-black.vercel.app').replace(/\/+$/, '')

const STATIC = ['/', '/invest', '/invest/ai-tools', '/invest/etf', '/ai', '/ai/fullstack-roadmap', '/life', '/about', '/pulse',
  '/investment-plan-2026', '/investment-targets', '/mainland-investment-targets', '/limit-up-analysis', '/trading-philosophy',
  '/sector-rotation', '/investment-strategy', '/first-book', '/future-trends', '/industry-landscape', '/research-notes', '/grid-trading']

// 《正念投资》章节：只收 done/draft，status 为 note 的是审稿与修订记录，不对外收录。
// 路径用 /first-book/read/，避免和 public/first-book/ 下的原始 Markdown 同名冲突。
const book = readFileSync(resolve(ROOT, 'src/pages/FirstBook.tsx'), 'utf8')
const chapters = [...book.matchAll(/file: '([^']+\.md)', status: '(?:done|draft)'/g)].map(m => `/first-book/read/${encodeURIComponent(m[1])}`)

// 公司研究页：只收有情景推演的页面，避免把空壳页交给搜索引擎
const companies = []
for (const market of ['us', 'cn', 'hk', 'adr']) {
  const list = JSON.parse(readFileSync(resolve(ROOT, `public/data/${market}.json`), 'utf8'))
  for (const c of list) if (c.scenarios?.length) companies.push(`/research-notes/${market}/${encodeURIComponent(c.code)}`)
}

const trendResearch = JSON.parse(readFileSync(resolve(ROOT, 'src/data/futureTrendsResearch.index.json'), 'utf8'))
const trendCompanies = trendResearch.map(c => `/future-trends/company/${encodeURIComponent(c.id)}`)
const solidSnapshot = JSON.parse(readFileSync(resolve(ROOT, 'src/data/solidState/mcpSnapshot.json'), 'utf8'))
const solidCompanies = solidSnapshot.companies.map(c => `/future-trends/solid-state/${encodeURIComponent(c.id)}`)
const labDirections = [...readFileSync(resolve(ROOT, 'src/data/aiLab.ts'), 'utf8').matchAll(/slug:\s*'([^']+)'/g)].map(m => `/ai/${m[1]}`)
const urls = [...new Set([...STATIC, ...chapters, ...companies, ...trendCompanies, ...solidCompanies, ...labDirections])]
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${ORIGIN}${u}</loc></url>`).join('\n')}\n</urlset>\n`
writeFileSync(resolve(ROOT, 'public/sitemap.xml'), xml)
console.log(`sitemap: ${urls.length} urls (${chapters.length} chapters, ${companies.length} companies)`)
