import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { isChunkLoadError, scheduleChunkReload, RELOAD_KEY } from './ErrorBoundary'

describe('isChunkLoadError', () => {
  it('匹配动态 import 拉取失败', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/EtfFlow-x.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 12 failed'))).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
  })

  it('匹配新 index 配旧 chunk 的模块图错配（default 为 undefined）', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'default')"))).toBe(true)
  })

  it('不误伤普通业务错误', () => {
    expect(isChunkLoadError(new Error('历史行情包含无效数据'))).toBe(false)
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'foo')"))).toBe(false)
  })
})

describe('scheduleChunkReload：跨传播窗口的递增重试', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('首次错误：排一次延迟刷新并记一次计数', () => {
    const reload = vi.fn()
    expect(scheduleChunkReload(reload)).toBe(true)
    expect(reload).not.toHaveBeenCalled()          // 延迟而非立刻，给 CDN 传播时间
    vi.advanceTimersByTime(2000)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(JSON.parse(sessionStorage.getItem(RELOAD_KEY)!).n).toBe(1)
  })

  it('同一窗口内连续失败最多重试 3 次，之后放弃（防死循环）', () => {
    const reload = vi.fn()
    expect(scheduleChunkReload(reload)).toBe(true)   // 1
    expect(scheduleChunkReload(reload)).toBe(true)   // 2
    expect(scheduleChunkReload(reload)).toBe(true)   // 3
    expect(scheduleChunkReload(reload)).toBe(false)  // 第 4 次放弃 → 显示手动屏
    vi.advanceTimersByTime(60000)
    expect(reload).toHaveBeenCalledTimes(3)
  })

  it('窗口过期后计数重置，可再次自动重试', () => {
    const reload = vi.fn()
    scheduleChunkReload(reload)
    scheduleChunkReload(reload)
    scheduleChunkReload(reload)
    expect(scheduleChunkReload(reload)).toBe(false)  // 窗口内已用尽
    // 模拟很久以后（超过窗口）又发版
    const st = JSON.parse(sessionStorage.getItem(RELOAD_KEY)!)
    st.first = Date.now() - 120000
    sessionStorage.setItem(RELOAD_KEY, JSON.stringify(st))
    expect(scheduleChunkReload(reload)).toBe(true)   // 新窗口，重新允许
  })

  it('sessionStorage 不可用时安全返回 false，不抛错', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(scheduleChunkReload(vi.fn())).toBe(false)
    spy.mockRestore()
  })
})
