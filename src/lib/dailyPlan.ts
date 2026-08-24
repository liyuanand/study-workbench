import type { ContentItem } from '../types'

export const DEFAULT_DAILY_NEW_LIMIT = 100
export const REVIEW_PAUSE_THRESHOLD = 150

export function buildDailySchedule(dueItems: ContentItem[], dailyNewLimit: number): { reviewIds: string[]; newIds: string[]; scheduledIds: string[] } {
  const reviewIds = dueItems.filter((item) => item.reviewStage >= 0).map((item) => item.id)
  const newIds = reviewIds.length > REVIEW_PAUSE_THRESHOLD
    ? []
    : dueItems.filter((item) => item.reviewStage < 0).slice(0, dailyNewLimit).map((item) => item.id)
  return { reviewIds, newIds, scheduledIds: [...reviewIds, ...newIds] }
}
