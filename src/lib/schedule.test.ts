import { describe, expect, it } from 'vitest'
import { calculateReviewOutcome, REVIEW_INTERVALS } from './schedule'

describe('calculateReviewOutcome', () => {
  it('moves new material to the one-day stage when remembered', () => {
    expect(calculateReviewOutcome(-1, 'remembered', '2026-08-15')).toEqual({
      stage: 0,
      intervalDays: 1,
      dueDate: '2026-08-16',
    })
  })

  it('advances through all six intervals and caps at 60 days', () => {
    REVIEW_INTERVALS.forEach((interval, stage) => {
      const current = stage - 1
      expect(calculateReviewOutcome(current, 'remembered', '2026-01-01').intervalDays).toBe(interval)
    })
    expect(calculateReviewOutcome(5, 'remembered', '2026-01-01')).toEqual({
      stage: 5,
      intervalDays: 60,
      dueDate: '2026-03-02',
    })
  })

  it('keeps the stage and halves the interval when fuzzy', () => {
    expect(calculateReviewOutcome(3, 'fuzzy', '2026-08-15')).toEqual({
      stage: 3,
      intervalDays: 7,
      dueDate: '2026-08-22',
    })
  })

  it('resets forgotten material to tomorrow', () => {
    expect(calculateReviewOutcome(5, 'forgot', '2026-12-31')).toEqual({
      stage: 0,
      intervalDays: 1,
      dueDate: '2027-01-01',
    })
  })
})
