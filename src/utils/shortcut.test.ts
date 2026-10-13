import { describe, expect, it } from 'vitest'
import { isMacPlatform, paletteShortcut } from './shortcut'

describe('快捷键提示', () => {
  it('Mac / iPhone / iPad 显示 ⌘K，其他显示 Ctrl K', () => {
    expect(isMacPlatform('MacIntel')).toBe(true)
    expect(isMacPlatform('iPhone')).toBe(true)
    expect(isMacPlatform('Win32')).toBe(false)
    expect(paletteShortcut('MacIntel')).toEqual({ keys: '⌘K', spoken: '⌘K' })
    expect(paletteShortcut('Linux x86_64')).toEqual({ keys: 'Ctrl K', spoken: 'Ctrl+K' })
  })
})
