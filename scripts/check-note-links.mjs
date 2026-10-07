// 检查 dist/note 下所有 HTML：以 /note/ 开头的内部链接与资源引用，都必须能在 dist/note 中找到目标。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const PREFIX = '/note'
const ATTRIBUTE = /\b(?:href|src|srcset|content|action)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi

function htmlFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...htmlFiles(path))
    else if (entry.name.endsWith('.html')) files.push(path)
  }
  return files
}

// 与静态托管的解析方式一致：文件本身、目录下的 index.html、或省略 .html 的页面
function targetExists(root, pathname) {
  const rest = pathname.slice(PREFIX.length).replace(/^\/+/, '')
  const base = join(root, decodeURIComponent(rest))
  if (!rest) return existsSync(join(root, 'index.html'))
  if (existsSync(base) && statSync(base).isFile()) return true
  return existsSync(join(base, 'index.html')) || existsSync(`${base}.html`)
}

/** 返回断链列表：{ page, link }。root 是 dist/note 的路径。 */
export function findBrokenNoteLinks(root) {
  if (!existsSync(root)) throw new Error(`目录不存在：${root}`)
  const broken = []
  for (const file of htmlFiles(root)) {
    const html = readFileSync(file, 'utf8')
    for (const match of html.matchAll(ATTRIBUTE)) {
      const value = (match[1] ?? match[2] ?? '').trim()
      for (const candidate of value.split(',').map(part => part.trim().split(/\s+/)[0])) {
        if (candidate !== PREFIX && !candidate.startsWith(`${PREFIX}/`)) continue
        const pathname = candidate.split('#')[0].split('?')[0]
        if (!targetExists(root, pathname)) broken.push({ page: relative(root, file), link: candidate })
      }
    }
  }
  return broken
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(process.argv[2] ?? 'dist/note')
  const broken = findBrokenNoteLinks(root)
  if (broken.length) {
    for (const { page, link } of broken) console.error(`断链：${page} -> ${link}`)
    console.error(`共 ${broken.length} 处断链`)
    process.exit(1)
  }
  console.log(`notes 链接检查通过：${root}`)
}
