import { describe, expect, it } from 'vitest'
import { describeDailyMaEvents, upgradeLegacyMaSegments } from './etfMaDescription'

const bars = (closes: number[]) => closes.map((close, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), close }))

describe('日线 MA 排列与均线方向', () => {
  const run = (closes: number[]) => describeDailyMaEvents(bars(closes))
  it('价格 > MA5 > MA10 红色', () => {
    expect(run([...Array(20).fill(10), 11])).toMatchObject({ description: '价格 > MA5 > MA10、MA5↑、MA10↑', signal: 'up' })
  })
  it('价格最低且 MA10 > MA5：绿色', () => {
    expect(run([...Array(20).fill(10), 11, 8]).segments[0]).toEqual({ text: 'MA10 > MA5 > 价格', signal: 'down' })
  })
  it('价格介于两线之间：灰色', () => {
    expect(run([...Array(20).fill(10), 11, 10.15, 10.16]).segments[0]).toEqual({ text: 'MA5 > 价格 > MA10', signal: 'neutral' })
  })
  it('MA10 > 价格 > MA5', () => {
    expect(run([...Array(20).fill(10), 9, 9.85, 9.84]).segments[0].text).toBe('MA10 > 价格 > MA5')
  })
  it('价格 > MA10 > MA5 与 MA5 > MA10 > 价格', () => {
    expect(run([...Array(20).fill(10), 8, 8, 8, 8, 9.5]).segments[0]).toEqual({ text: '价格 > MA10 > MA5', signal: 'up' })
    expect(run([...Array(20).fill(10), 12, 12, 12, 12, 10.5]).segments[0]).toEqual({ text: 'MA5 > MA10 > 价格', signal: 'down' })
  })
  it('两条均线方向独立着色', () => {
    expect(run([...Array(20).fill(10), 20, 11, 11, 11, 11, 11]).segments.slice(1)).toEqual([{ text: 'MA5↓', signal: 'down' }, { text: 'MA10↑', signal: 'up' }])
  })
  it('平盘粘合为中性，历史不足明确提示', () => {
    expect(run(Array(20).fill(10))).toMatchObject({ description: '均线粘合、MA5→、MA10→', signal: 'neutral' })
    expect(run(Array(10).fill(10)).description).toContain('历史不足')
  })
  it('旧快照的单色文案可升级为三段：顺序重算，方向从文案解析', () => {
    expect(upgradeLegacyMaSegments('MA5上10上、M5回升10回落', { close: 11, ma5: 10.5, ma10: 10 })).toEqual([
      { text: '价格 > MA5 > MA10', signal: 'up' }, { text: 'MA5↑', signal: 'up' }, { text: 'MA10↓', signal: 'down' },
    ])
    expect(upgradeLegacyMaSegments('历史不足，暂不判断', { close: 11, ma5: null, ma10: null })).toBeNull()
  })
})
