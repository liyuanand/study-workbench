import { describe, expect, it } from 'vitest'
import { buildDailySchedule } from './dailyPlan'
import type { ContentItem } from '../types'

function item(id: string, reviewStage: number): ContentItem {
  return { id, reviewStage } as ContentItem
}

describe('buildDailySchedule', () => {
  it('keeps all due reviews outside the new-learning limit', () => {
    const due = [
      ...Array.from({ length: 12 }, (_, index) => item(`review-${index}`, 1)),
      ...Array.from({ length: 150 }, (_, index) => item(`new-${index}`, -1)),
    ]
    const plan = buildDailySchedule(due, 100)
    expect(plan.reviewIds).toHaveLength(12)
    expect(plan.newIds).toHaveLength(100)
    expect(plan.scheduledIds).toHaveLength(112)
  })

  it('pauses new learning when due reviews exceed 150', () => {
    const due = [
      ...Array.from({ length: 151 }, (_, index) => item(`review-${index}`, 2)),
      ...Array.from({ length: 100 }, (_, index) => item(`new-${index}`, -1)),
    ]
    const plan = buildDailySchedule(due, 100)
    expect(plan.reviewIds).toHaveLength(151)
    expect(plan.newIds).toHaveLength(0)
    expect(plan.scheduledIds).toHaveLength(151)
  })
})
