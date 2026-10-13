// 重新生成 src/styles/inlineStyleBaseline.json（只在迁移让数字下降后运行）
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SRC = resolve('src')
const INLINE = /style=\{\{/g
const COLOR = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d|'white'|'black'|"white"|"black"/g
const walk = dir => readdirSync(dir).flatMap(n => {
  const f = join(dir, n)
  return statSync(f).isDirectory() ? walk(f) : n.endsWith('.tsx') && !n.includes('.test.') ? [f] : []
})
const out = {}
for (const f of walk(SRC).sort()) {
  const s = readFileSync(f, 'utf8')
  const inline = s.match(INLINE)?.length ?? 0
  const color = s.match(COLOR)?.length ?? 0
  if (inline || color) out[relative(SRC, f)] = { inline, color }
}
writeFileSync('src/styles/inlineStyleBaseline.json', JSON.stringify(out, null, 2) + '\n')
const total = Object.values(out).reduce((a, c) => ({ inline: a.inline + c.inline, color: a.color + c.color }), { inline: 0, color: 0 })
console.log(`${Object.keys(out).length} files · style={{ ${total.inline} · colors ${total.color}`)
