// 构建后为每个收录页生成独立的 index.html：写入该页的 title / description / canonical / Open Graph，
// 并在 #root 里放一份正文（React 挂载时会替换掉），让不执行 JS 的爬虫也能读到内容。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { marked } from 'marked'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const ORIGIN = (process.env.VITE_SITE_URL || 'https://businessweb-c0u.pages.dev').replace(/\/+$/, '')

// 复用前端的路由 SEO 表，保证预渲染与运行时一致
const bundled = await build({
  entryPoints: [resolve(ROOT, 'src/utils/seo.ts')], bundle: true, format: 'esm', write: false,
  define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(ORIGIN) },
})
const { resolveSeo, formatTitle } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const template = readFileSync(resolve(DIST, 'index.html'), 'utf8')

const book = new Map()
for (const m of readFileSync(resolve(ROOT, 'src/pages/FirstBook.tsx'), 'utf8').matchAll(/no: '([^']*)', title: '([^']*)', file: '([^']+\.md)', status: '(?:done|draft)'/g)) {
  book.set(m[3], { no: m[1], title: m[2] })
}
const companies = new Map()
for (const market of ['us', 'cn', 'hk', 'adr']) {
  for (const c of JSON.parse(readFileSync(resolve(ROOT, `public/data/${market}.json`), 'utf8'))) companies.set(`/research-notes/${market}/${encodeURIComponent(c.code)}`, c)
}

const trendCompanies = new Map(JSON.parse(readFileSync(resolve(ROOT, 'src/data/futureTrendsResearch.index.json'), 'utf8')).map(c => [`/future-trends/company/${encodeURIComponent(c.id)}`, c]))
const solidBundle = await build({
  entryPoints: [resolve(ROOT, 'src/data/solidState/companyResearch.ts')], bundle: true, format: 'esm', write: false,
  define: { 'import.meta.env.BASE_URL': JSON.stringify('/') },
})
const solidModule = await import('data:text/javascript;base64,' + Buffer.from(solidBundle.outputFiles[0].text).toString('base64'))
const solidSnapshot = JSON.parse(readFileSync(resolve(ROOT, 'src/data/solidState/mcpSnapshot.json'), 'utf8'))
const solidCompanies = new Map(solidSnapshot.companies.map(c => [`/future-trends/solid-state/${encodeURIComponent(c.id)}`, solidModule.solidCompanyReport(c)]))
const solidReportsDirectory = resolve(DIST, 'research/solid-state-mcp-2026-10-09/companies')
mkdirSync(solidReportsDirectory, { recursive: true })
for (const report of solidCompanies.values()) writeFileSync(resolve(solidReportsDirectory, `${report.id}.json`), JSON.stringify(report, null, 2) + '\n')
function describe(path) {
  const seo = resolveSeo(path)
  const file = path.startsWith('/first-book/read/') && decodeURIComponent(path.slice('/first-book/read/'.length))
  const chapter = file && book.get(file)
  if (chapter) {
    return {
      title: `${chapter.title}｜《正念投资》${chapter.no}`,
      description: `《正念投资》${chapter.no}：${chapter.title}。`,
      body: marked.parse(readFileSync(resolve(ROOT, 'public/first-book', file), 'utf8')),
    }
  }
  const c = companies.get(path)
  const solid = solidCompanies.get(path)
  if (solid) {
    const table = (caption, rows) => `<h2>${esc(caption)}</h2><table>${rows.map(([k,v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`
    return {
      title: `${solid.name}｜固态电池公司研究`, description: solid.role,
      body: `<p><a href="/future-trends?tab=solid-state">返回固态电池专题</a></p><p>${esc(solid.asOf)} · ${esc(solid.depth)}</p><p>${esc(solid.conclusion)}</p>${solid.sections.map(s => `<h2>${esc(s.title)}</h2>${s.items.map(i => `<p>${esc(i)}</p>`).join('')}`).join('')}${table('半年经营与现金流', solid.incomeRows)}${table('资产负债', solid.balanceRows)}${table('市场指标', solid.marketRows)}<h2>来源与口径</h2><ul>${solid.sources.map(s => `<li><a href="${esc(s.url.startsWith('http') ? s.url : '/' + s.url)}">${esc(s.title)}</a>：${esc(s.status)}</li>`).join('')}</ul><p>${esc(solid.disclaimer)}</p>`,
    }
  }
  const trend = trendCompanies.get(path)
  if (trend) {
    const d = JSON.parse(readFileSync(resolve(ROOT, 'public/research/future-trends-2026-10-09/companies', `${trend.id}.json`), 'utf8'))
    const list = (title, values) => `<h2>${esc(title)}</h2><ul>${values.map(v => `<li>${esc(v)}</li>`).join('')}</ul>`
    return {
      title: `${d.name}（${d.code}）｜未来趋势研究`, description: d.headline.slice(0, 160),
      body: `<p>${esc(d.rating)}；${esc(d.depth)}；${esc(d.valuationStatus)}</p><p>${esc(d.headline)}</p><p>${esc(d.profile)}</p>${list('业务与盈利驱动', d.segments.concat(d.drivers))}${list('护城河', d.moatAnalysis)}${list('隐忧与证伪', [d.concern, ...d.falsification])}<h2>三情景草稿</h2>${d.scenarios.map(s => `<p>${esc(s.name)}：${esc(s.assumption)}；价格 ${esc(s.price ?? '[MISSING]')} ${esc(d.currency)}</p>`).join('')}<p>条件盈亏比 ${esc(d.ratio ?? '不适用／缺失')}；实际胜率 ${esc(d.winRate)}</p><p>${esc(d.probabilityNote)}</p><p>${esc(d.secondMethod)}</p>${list('未完成证据', d.missing)}<h2>来源与范围</h2><ul>${d.sources.filter(s => s.url).map(s => `<li><a href="${esc(s.url)}">${esc(s.title)}</a>：${esc(s.status)}</li>`).join('')}</ul>`,
    }
  }
  if (c) {
    const list = (label, items) => items?.length ? `<h2>${label}</h2><ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''
    return {
      title: `${c.name}（${c.code}）研究笔记`,
      description: `${c.name}（${c.code}）：${c.headline}`.slice(0, 160),
      body: `<p>${esc(c.headline)}</p>${list('核心逻辑', c.thesis)}${list('风险与证伪', c.risk)}`,
    }
  }
  return { title: seo.title, description: seo.description ?? '', body: seo.description ? `<p>${esc(seo.description)}</p>` : '' }
}

const sitemap = readFileSync(resolve(DIST, 'sitemap.xml'), 'utf8')
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname).filter(p => p !== '/')

function render(path) {
  const { title, description, body } = describe(path)
  const full = formatTitle(title)
  const url = ORIGIN + path
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(full)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(description)}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(full)}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(description)}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`)
    .replace('<div id="root"></div>', `<div id="root"><main><h1>${esc(title)}</h1>${body}</main></div>`)
}

let count = 0
for (const path of paths) {
  const dir = join(DIST, ...decodeURIComponent(path).split('/').filter(Boolean))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), render(path))
  count++
}
console.log(`prerender: ${count} pages`)
