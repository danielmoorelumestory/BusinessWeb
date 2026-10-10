import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const script = resolve('scripts/prepare-pages.mjs')

function run() {
  const dir = mkdtempSync(join(tmpdir(), 'pages-'))
  mkdirSync(join(dir, 'dist'))
  writeFileSync(join(dir, 'dist', 'index.html'), '<!doctype html><title>spa</title>')
  execFileSync(process.execPath, [script], { cwd: dir })
  return dir
}

test('主导航的每个页面都有稳定入口（状态码 200，而不是靠 404.html 兜底）', () => {
  const dir = run()
  try {
    for (const route of ['invest', 'invest/ai-tools', 'ai', 'life', 'about', 'first-book', 'notes', 'industry-etf', 'grid-trading', 'grid-trading/records']) {
      const f = join(dir, 'dist', route, 'index.html')
      assert.ok(existsSync(f), route)
      assert.equal(readFileSync(f, 'utf8'), '<!doctype html><title>spa</title>', route)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('仍然生成 404.html 兜底（深层路径和未知路径）', () => {
  const dir = run()
  try {
    assert.ok(existsSync(join(dir, 'dist', '404.html')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
