import { describe, expect, it } from 'vitest'
import type { PointLedgerEntry } from '../types'
import { calculateBalance, canRequestReward } from './points'

const entry = (delta: number): PointLedgerEntry => ({
  id: crypto.randomUUID(),
  dateKey: '2026-08-15',
  delta,
  reason: 'adjustment',
  relatedId: 'test',
  note: 'test',
  createdAt: '2026-08-15T08:00:00.000Z',
})

describe('point ledger', () => {
  it('derives balance from immutable entries', () => {
    expect(calculateBalance([entry(5), entry(10), entry(-8)])).toBe(7)
  })

  it('requires a positive integer cost and sufficient balance', () => {
    expect(canRequestReward(80, 80)).toBe(true)
    expect(canRequestReward(79, 80)).toBe(false)
    expect(canRequestReward(80, 0)).toBe(false)
    expect(canRequestReward(80, 2.5)).toBe(false)
  })
})
