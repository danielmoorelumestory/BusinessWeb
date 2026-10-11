import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanText, parseNote, pickLatest, sqlString, titlesFromNotesTs, toSql } from './noteAnalysis.mjs'

const note = (rows, extra = '') => `> 标的：测试（600000）\n> 数据基准：2026-10-09 收盘\n\n## 一、结论速览\n\n| 维度 | 最终判断 | 关键依据 |\n|---|---|---|\n${rows}\n\n${extra}## 二、其他\n\n| 短期（不该被取） | x | y |\n`

test('去除粗体与行内代码并压缩空白', () => {
  assert.equal(cleanText('**偏强反弹，但进入压力区**'), '偏强反弹，但进入压力区')
  assert.equal(cleanText('  a   `b`\n c '), 'a b c')
})

test('取「短期」「中期（」两行的最终判断，忽略其他行与其他小节', () => {
  const text = note('| 短期（1–5日） | **偏强反弹** | 依据甲 |\n| 中期（数周–数月） | 筑底修复，反转尚未确认 | 依据乙 |\n| 中期确认线 | **1.032** | 不该被取 |\n| 中期延伸目标 | 30.15 | 不该被取 |')
  const row = parseNote('public/notes/600000-test-analysis.md', text, '测试标题')
  assert.deepEqual(row, { code: '600000', slug: '600000-test-analysis', title: '测试标题', asOf: '2026-10-09', short: '偏强反弹', mid: '筑底修复，反转尚未确认' })
})

test('兼容半角括号与带粗体、无空格的数据基准写法', () => {
  const text = `> **数据基准**：2026-10-09收盘\n\n## 一、结论速览\n\n| 维度 | 最终判断 | 关键依据 |\n|---|---|---|\n| 短期(1-5日) | 甲 | x |\n| 中期(数周) | 乙 | y |\n`
  const row = parseNote('159146-x-analysis.md', text)
  assert.equal(row.asOf, '2026-10-09')
  assert.equal(row.short, '甲')
  assert.equal(row.mid, '乙')
  assert.equal(row.title, '159146-x-analysis')
})

test('结构不符的笔记被跳过并说明原因', () => {
  assert.match(parseNote('600000-a-analysis.md', note('| 中期（数周） | 乙 | y |')).skipped, /短期/)
  assert.match(parseNote('600000-a-analysis.md', note('| 短期（1–5日） | 甲 | x |')).skipped, /中期/)
  assert.match(parseNote('600000-a-analysis.md', '## 二、别的\n').skipped, /结论速览/)
  assert.match(parseNote('robotics-industry-research.md', note('| 短期 | 甲 | x |')).skipped, /代码/)
})

test('同一代码取数据基准日最新的一篇，相同则取 slug 较大者', () => {
  const rows = [
    { code: '600000', slug: '600000-a', asOf: '2026-09-01' }, { code: '600000', slug: '600000-b', asOf: '2026-10-09' },
    { code: '600000', slug: '600000-c', asOf: '2026-10-09' }, { code: '000001', slug: '000001-a', asOf: '2026-10-01' },
  ]
  assert.deepEqual(pickLatest(rows).map(row => row.slug), ['000001-a', '600000-c'])
})

test('SQL 字符串转义单引号并去掉控制字符', () => {
  assert.equal(sqlString("it's"), "'it''s'")
  assert.equal(sqlString('a\u0000b'), "'ab'")
})

test('生成的 SQL 含建表与 upsert，含引号的文字不破坏语句', () => {
  const sql = toSql([{ code: '600000', slug: '600000-a', title: "O'Neil", asOf: '2026-10-09', short: "x'; DROP TABLE note_analysis; --", mid: '乙' }], 123)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS note_analysis/)
  assert.match(sql, /ON CONFLICT\(code\) DO UPDATE/)
  assert.ok(sql.includes("'x''; DROP TABLE note_analysis; --'"))
  assert.ok(sql.includes("'O''Neil'"))
  assert.equal((sql.match(/;\n/g) ?? []).length, 2) // 只有建表和一条 upsert 两条语句
})

test('从 notes.ts 文本取 slug → title', () => {
  const ts = `export const NOTES = [\n  {\n    slug: 'a-analysis',\n    title: '甲：it\\'s',\n    date: 'x',\n  },\n  {\n    slug: 'b-analysis',\n    title: '乙',\n  },\n]`
  const titles = titlesFromNotesTs(ts)
  assert.equal(titles.get('a-analysis'), "甲：it's")
  assert.equal(titles.get('b-analysis'), '乙')
})

test('仓库里所有标的分析笔记都能解析出短期与中期判断', () => {
  const dir = 'public/notes'
  const titles = titlesFromNotesTs(readFileSync('src/data/notes.ts', 'utf8'))
  const files = readdirSync(dir).filter(file => /^\d{6}-.*\.md$/.test(file))
  assert.ok(files.length >= 12, `期望至少 12 篇标的分析，实际 ${files.length}`)
  for (const file of files) {
    const row = parseNote(join(dir, file), readFileSync(join(dir, file), 'utf8'), titles.get(file.replace(/\.md$/, '')))
    assert.ok(!row.skipped, `${file}: ${row.skipped}`)
    assert.ok(row.short.length > 3 && row.mid.length > 3, file)
    assert.ok(!/\*\*/.test(row.short + row.mid), `${file} 仍含粗体标记`)
    assert.match(row.asOf, /^\d{4}-\d{2}-\d{2}$/, file)
  }
})
