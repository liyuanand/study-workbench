import { describe, expect, it } from 'vitest'
import { addDays, dateKeysBack } from './date'

describe('local date helpers', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('returns seven ordered local date keys', () => {
    expect(dateKeysBack(3, '2026-08-15')).toEqual(['2026-08-13', '2026-08-14', '2026-08-15'])
  })
})
