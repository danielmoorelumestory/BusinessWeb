// @vitest-environment node
import { describe, expect, it } from 'vitest'
import config from '../vite.config.js'

// Vite 的代理键：以 ^ 开头是正则，否则是前缀匹配。'/note' 会连 '/notes' 一起代理走，所以必须用 '^/note/'。
const keys = Object.keys(((config as unknown as (env: { command: string; mode: string }) => { server: { proxy: Record<string, unknown> } })({ command: 'serve', mode: 'development' })).server.proxy)
const matches = (key: string, path: string): boolean => (key.startsWith('^') ? new RegExp(key).test(path) : path.startsWith(key))

describe('开发服务器代理', () => {
  it('/note/ 下的路径被代理到 notes-site', () => {
    expect(keys.some(k => matches(k, '/note/lab/grid-trading/'))).toBe(true)
    expect(keys.some(k => matches(k, '/note/lab/stock/'))).toBe(true)
  })

  it('主站自己的 /notes 与 /industry-etf 不会被任何代理键匹配', () => {
    for (const path of ['/notes', '/notes/robotics-industry-research', '/industry-etf', '/notes?tag=ETF']) {
      expect(keys.filter(k => matches(k, path)), path).toEqual([])
    }
  })
})
