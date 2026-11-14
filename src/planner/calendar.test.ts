import { describe, expect, it } from 'vitest'
import { addDays, isDateKey, isPlannerDate, localDateKey, weekDates, weekStart } from './calendar'

describe('planner calendar dates', () => {
  it('uses the local day for times near midnight', () => {
    expect(localDateKey(new Date(2026, 0, 4, 23, 59))).toBe('2026-01-04')
    expect(localDateKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })

  it('puts Sunday in the preceding Monday-based week across New Year', () => {
    expect(weekDates('2026-01-04')).toEqual(['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
    expect(weekStart('2026-01-05')).toBe('2026-01-05')
  })

  it('steps across leap days and daylight-saving weekends by calendar date', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-02', -1)).toBe('2026-11-01')
  })

  it('rejects impossible dates and dates whose weeks exceed the calendar range', () => {
    expect(isDateKey('2026-02-29')).toBe(false)
    expect(isDateKey('2026-1-02')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('9999-12-31')).toBe(true)
    expect(isPlannerDate('9999-12-31')).toBe(false)
  })
})
