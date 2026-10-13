import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getToday, getWeekday } from './date'

describe('getWeekday', () => {
  // getWeekday uses the local zone's getDay(); pin it so results do not depend on the machine
  const originalTZ = process.env.TZ
  beforeEach(() => {
    process.env.TZ = 'UTC'
  })
  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it('returns 周日 for Sunday', () => {
    expect(getWeekday('2024-01-07T12:00:00Z')).toBe('周日')
  })

  it('returns 周一 for Monday', () => {
    expect(getWeekday('2024-01-08T12:00:00Z')).toBe('周一')
  })

  it('returns 周二 for Tuesday', () => {
    expect(getWeekday('2024-01-09T12:00:00Z')).toBe('周二')
  })

  it('returns 周三 for Wednesday', () => {
    expect(getWeekday('2024-01-10T12:00:00Z')).toBe('周三')
  })

  it('returns 周四 for Thursday', () => {
    expect(getWeekday('2024-01-11T12:00:00Z')).toBe('周四')
  })

  it('returns 周五 for Friday', () => {
    expect(getWeekday('2024-01-12T12:00:00Z')).toBe('周五')
  })

  it('returns 周六 for Saturday', () => {
    expect(getWeekday('2024-01-13T12:00:00Z')).toBe('周六')
  })

  it('parses ISO datetime strings without timezone offset as local time', () => {
    // no offset => local time, so the weekday is the same in every timezone
    expect(getWeekday('2024-06-15T15:30:00')).toBe('周六')
    expect(getWeekday('2024-06-16T00:00:00')).toBe('周日')
  })

  it('handles dates near year boundaries', () => {
    expect(getWeekday('2023-12-31T12:00:00Z')).toBe('周日')
    expect(getWeekday('2024-01-01T12:00:00Z')).toBe('周一')
    expect(getWeekday('2024-12-31T12:00:00Z')).toBe('周二')
    expect(getWeekday('2025-01-01T12:00:00Z')).toBe('周三')
  })

  it('handles leap day in a leap year', () => {
    expect(getWeekday('2024-02-29T12:00:00Z')).toBe('周四')
  })

  it('handles dates in February across the leap boundary', () => {
    expect(getWeekday('2024-02-28T12:00:00Z')).toBe('周三')
    expect(getWeekday('2023-02-28T12:00:00Z')).toBe('周二')
  })

  it('handles month boundaries', () => {
    expect(getWeekday('2024-03-01T12:00:00Z')).toBe('周五')
    expect(getWeekday('2024-04-01T12:00:00Z')).toBe('周一')
    expect(getWeekday('2024-05-01T12:00:00Z')).toBe('周三')
  })

  describe('date-only YYYY-MM-DD strings (parsed as UTC midnight)', () => {
    it('returns the exact weekday when the local zone is UTC', () => {
      expect(getWeekday('2024-06-15')).toBe('周六')
      expect(getWeekday('2024-01-01')).toBe('周一')
    })

    it('shifts to the previous weekday in a zone behind UTC', () => {
      process.env.TZ = 'America/New_York'
      expect(getWeekday('2024-06-15')).toBe('周五')
    })
  })

  it('returns one of the seven weekday labels for arbitrary valid dates', () => {
    const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    for (let day = 1; day <= 31; day += 1) {
      const dateStr = `2024-01-${String(day).padStart(2, '0')}T12:00:00Z`
      expect(labels).toContain(getWeekday(dateStr))
    }
  })

  it('returns undefined for an invalid date string', () => {
    expect(getWeekday('not-a-date')).toBeUndefined()
  })

  it('returns undefined for an empty string', () => {
    expect(getWeekday('')).toBeUndefined()
  })
})

describe('getToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a string in YYYY-MM-DD format', () => {
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
    expect(getToday()).toBe('2024-06-15')
  })

  it('matches the YYYY-MM-DD regex pattern', () => {
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
    expect(getToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns the UTC date for a midday UTC instant', () => {
    vi.setSystemTime(new Date('2024-06-15T00:00:01Z'))
    expect(getToday()).toBe('2024-06-15')
  })

  it('handles dates one second before UTC midnight', () => {
    vi.setSystemTime(new Date('2024-06-15T23:59:59Z'))
    expect(getToday()).toBe('2024-06-15')
  })

  it('rolls over to the next UTC day at midnight', () => {
    vi.setSystemTime(new Date('2024-06-15T00:00:00Z'))
    expect(getToday()).toBe('2024-06-15')
    vi.setSystemTime(new Date('2024-06-15T23:59:59.999Z'))
    expect(getToday()).toBe('2024-06-15')
    vi.setSystemTime(new Date('2024-06-16T00:00:00Z'))
    expect(getToday()).toBe('2024-06-16')
  })

  it('returns the UTC date even when local time would be the previous day', () => {
    vi.setSystemTime(new Date('2024-06-15T23:30:00-05:00'))
    expect(getToday()).toBe('2024-06-16')
  })

  it('handles month and year boundaries', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:01Z'))
    expect(getToday()).toBe('2024-01-01')

    vi.setSystemTime(new Date('2023-12-31T23:59:59Z'))
    expect(getToday()).toBe('2023-12-31')

    vi.setSystemTime(new Date('2024-02-29T12:00:00Z'))
    expect(getToday()).toBe('2024-02-29')

    vi.setSystemTime(new Date('2024-03-01T00:00:00Z'))
    expect(getToday()).toBe('2024-03-01')
  })

  it('produces a different value when the fake clock advances', () => {
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
    const first = getToday()

    vi.setSystemTime(new Date('2024-06-16T12:00:00Z'))
    const second = getToday()

    expect(first).toBe('2024-06-15')
    expect(second).toBe('2024-06-16')
    expect(first).not.toBe(second)
  })

  it('reflects changes in system time across consecutive calls', () => {
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
    expect(getToday()).toBe('2024-06-15')

    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'))
    expect(getToday()).toBe('2025-01-01')

    vi.setSystemTime(new Date('1999-12-31T12:00:00Z'))
    expect(getToday()).toBe('1999-12-31')
  })
})
