import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readJson, writeJsonIfChanged } from './json-io.mjs'

test('readJson 文件不存在返回 fallback', () => {
  assert.deepEqual(readJson(join(tmpdir(), 'nope-'+Date.now()+'.json'), { ok: 1 }), { ok: 1 })
})

test('readJson 损坏 JSON 返回 fallback（F5：与写侧容错对齐，不让 workflow 崩）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jsonio-'))
  const f = join(dir, 'broken.json')
  writeFileSync(f, '{这不是合法JSON')
  assert.deepEqual(readJson(f, { fallback: true }), { fallback: true })
})

test('writeJsonIfChanged 忽略 updated 时间戳，内容不变不重写（F4）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jsonio-'))
  const f = join(dir, 'd.json')
  assert.equal(writeJsonIfChanged(f, { updated: 'T1', series: [1, 2] }), true)   // 首次写入
  assert.equal(writeJsonIfChanged(f, { updated: 'T2', series: [1, 2] }), false)  // 仅 updated 变 → 不写
  assert.equal(writeJsonIfChanged(f, { updated: 'T3', series: [1, 2, 3] }), true) // series 变 → 写
})
