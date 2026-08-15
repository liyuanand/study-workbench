import type { ReviewOutcome, ReviewRating } from '../types'
import { addDays } from './date'

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60] as const

export function calculateReviewOutcome(
  currentStage: number,
  rating: ReviewRating,
  reviewedOn: string,
): ReviewOutcome {
  if (rating === 'forgot') {
    return { stage: 0, intervalDays: 1, dueDate: addDays(reviewedOn, 1) }
  }

  if (rating === 'fuzzy') {
    const stage = Math.min(Math.max(currentStage, 0), REVIEW_INTERVALS.length - 1)
    const intervalDays = Math.max(1, Math.ceil(REVIEW_INTERVALS[stage] / 2))
    return { stage, intervalDays, dueDate: addDays(reviewedOn, intervalDays) }
  }

  const stage = Math.min(Math.max(currentStage + 1, 0), REVIEW_INTERVALS.length - 1)
  const intervalDays = REVIEW_INTERVALS[stage]
  return { stage, intervalDays, dueDate: addDays(reviewedOn, intervalDays) }
}
