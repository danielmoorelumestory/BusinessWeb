import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const directory = fileURLToPath(new URL('../public/research/hk-2026-10-07/', import.meta.url))
const style = `body{margin:0;background:#f6f5f1;color:#202b2c;font:16px/1.85 system-ui,-apple-system,sans-serif}main{max-width:1100px;margin:auto;padding:48px 28px 100px}h1{font-size:30px;line-height:1.4}h2{margin-top:44px;border-bottom:1px solid #d6dcda;padding-bottom:10px;font-size:22px}h3{font-size:18px}a{color:#086b69}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.7}th,td{padding:12px;text-align:left;border:1px solid #d6dcda;vertical-align:top;min-width:90px}th{background:#e6edeb}tr:nth-child(even){background:#fff}p,li{overflow-wrap:anywhere}strong{color:#8a4c24}.table-scroll{overflow:auto}input{box-sizing:border-box;width:100%;padding:14px;border:1px solid #aebcb7;border-radius:8px;background:white;font:inherit;margin:12px 0 28px}@media(max-width:600px){main{padding:24px 16px 60px}h1{font-size:24px}table{min-width:750px}}`
let count = 0
for (const name of await readdir(directory)) {
  if (!name.endsWith('.md')) continue
  const source = await readFile(`${directory}/${name}`, 'utf8')
  const title = source.split('\n')[0].replace(/^# /, '').replace(/[<>&"]/g, '')
  const body = marked.parse(source).replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>')
  const filter = name === 'index.md' ? '<input id="filter" type="search" placeholder="搜索公司、代码、行业或研究发现" aria-label="搜索公司研究"><script>document.addEventListener("DOMContentLoaded",()=>{document.getElementById("filter").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll("tbody tr").forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q))})})</script>' : ''
  await writeFile(`${directory}/${name.replace(/\.md$/, '.html')}`, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${style}</style></head><body><main>${filter}${body}</main></body></html>`)
  count++
}
console.log(`Rendered ${count} reports (127 companies, batches and overview)`)
