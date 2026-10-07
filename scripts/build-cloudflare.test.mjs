import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { copyNotesDist } from './build-cloudflare.mjs'
import { findBrokenNoteLinks } from './check-note-links.mjs'

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'build-cloudflare-'))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}

test('copyNotesDist：把产物复制到目标目录，保持目录结构', () => {
  const root = tree({ 'src/index.html': 'home', 'src/lab/grid/index.html': 'grid', 'src/_astro/a.css': 'css' })
  try {
    copyNotesDist({ notesDist: join(root, 'src'), target: join(root, 'dist/note') })
    assert.equal(readFileSync(join(root, 'dist/note/index.html'), 'utf8'), 'home')
    assert.equal(readFileSync(join(root, 'dist/note/lab/grid/index.html'), 'utf8'), 'grid')
    assert.equal(readFileSync(join(root, 'dist/note/_astro/a.css'), 'utf8'), 'css')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('copyNotesDist：替换已有的 dist/note，但不动 dist 里的其他文件', () => {
  const root = tree({ 'src/index.html': 'new', 'dist/note/old-only.html': 'old', 'dist/index.html': '主站', 'dist/assets/app.js': 'js' })
  try {
    copyNotesDist({ notesDist: join(root, 'src'), target: join(root, 'dist/note') })
    assert.equal(existsSync(join(root, 'dist/note/old-only.html')), false, '旧文件应被清掉')
    assert.equal(readFileSync(join(root, 'dist/note/index.html'), 'utf8'), 'new')
    assert.equal(readFileSync(join(root, 'dist/index.html'), 'utf8'), '主站')
    assert.equal(readFileSync(join(root, 'dist/assets/app.js'), 'utf8'), 'js')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('copyNotesDist：来源缺少 index.html 时失败，且不会清掉已有的 dist/note', () => {
  const root = tree({ 'src/readme.txt': 'x', 'dist/note/index.html': '线上正在用的版本' })
  try {
    assert.throws(() => copyNotesDist({ notesDist: join(root, 'src'), target: join(root, 'dist/note') }), /index\.html/)
    assert.equal(readFileSync(join(root, 'dist/note/index.html'), 'utf8'), '线上正在用的版本')
    assert.throws(() => copyNotesDist({ notesDist: join(root, 'missing'), target: join(root, 'dist/note') }))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('findBrokenNoteLinks：能解析文件、目录索引与省略 .html 的页面', () => {
  const root = tree({
    'index.html': '<a href="/note/">首页</a><a href="/note/notes/a">笔记</a><link href="/note/_astro/s.css"><a href="/note/page">页</a><a href="/note/rss.xml#x">订阅</a>',
    'notes/a/index.html': '<a href="/note/">回首页</a>',
    '_astro/s.css': '',
    'page.html': '',
    'rss.xml': '',
  })
  try { assert.deepEqual(findBrokenNoteLinks(root), []) } finally { rmSync(root, { recursive: true, force: true }) }
})

test('findBrokenNoteLinks：报告断链，忽略外部链接与非 /note 链接', () => {
  const root = tree({
    'index.html': '<a href="/note/missing">断</a><a href="https://example.com/note/x">外</a><a href="/other/x">别处</a><img src="/note/img/none.png"><img srcset="/note/a.png 1x, /note/b.png 2x">',
    'a.png': '',
  })
  try {
    const broken = findBrokenNoteLinks(root).map(item => item.link).sort()
    assert.deepEqual(broken, ['/note/b.png', '/note/img/none.png', '/note/missing'])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('findBrokenNoteLinks：目录不存在时报错', () => {
  assert.throws(() => findBrokenNoteLinks(join(tmpdir(), 'no-such-dir-for-links-check')), /不存在/)
})
