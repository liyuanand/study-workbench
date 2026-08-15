import type { PointLedgerEntry } from '../types'

export function calculateBalance(entries: PointLedgerEntry[]): number {
  return entries.reduce((total, entry) => total + entry.delta, 0)
}

export function canRequestReward(balance: number, cost: number): boolean {
  return Number.isInteger(cost) && cost > 0 && balance >= cost
}
