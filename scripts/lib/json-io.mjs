import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const VOLATILE = new Set(['generatedAt', 'fetchedAt', 'updated'])
const strip = value => JSON.stringify(value, (key, v) => (VOLATILE.has(key) ? undefined : v))

export function readJson(file, fallback) {
  if (!existsSync(file)) return fallback
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback // 文件损坏时回退，与 writeJsonIfChanged 的损坏兜底对齐，不让读取方崩
  }
}

/** 写 JSON；除时间戳字段外内容不变时不动文件，避免定时任务每次都产生无意义提交。返回是否写入。 */
export function writeJsonIfChanged(file, data, { pretty = false } = {}) {
  if (existsSync(file)) {
    try {
      if (strip(JSON.parse(readFileSync(file, 'utf8'))) === strip(data)) return false
    } catch { /* 旧文件损坏就直接覆盖 */ }
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(data, null, pretty ? 2 : 0)}\n`)
  return true
}
