// 跳转面板快捷键的显示文字：Mac 系显示 ⌘K，其他系统显示 Ctrl K（读屏读作 Ctrl+K）
const currentPlatform = (): string =>
  typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent

export function isMacPlatform(platform: string = currentPlatform()): boolean {
  return /Mac|iPhone|iPad/.test(platform)
}

export function paletteShortcut(platform: string = currentPlatform()): { keys: string; spoken: string } {
  return isMacPlatform(platform) ? { keys: '⌘K', spoken: '⌘K' } : { keys: 'Ctrl K', spoken: 'Ctrl+K' }
}
