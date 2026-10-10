import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  if (typeof window === 'undefined') return // node 环境的测试（api/、server/）没有浏览器全局
  vi.stubGlobal('localStorage', window.localStorage)
  vi.stubGlobal('sessionStorage', window.sessionStorage)
  vi.stubGlobal('Storage', window.Storage)
})

afterEach(() => {
  cleanup()
})
