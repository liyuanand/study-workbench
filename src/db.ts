import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings,
  ContentItem,
  DaySnapshot,
  MediaAsset,
  PointLedgerEntry,
  Redemption,
  ReviewLog,
  Reward,
} from './types'

class StudyDatabase extends Dexie {
  contents!: EntityTable<ContentItem, 'id'>
  media!: EntityTable<MediaAsset, 'id'>
  reviewLogs!: EntityTable<ReviewLog, 'id'>
  daySnapshots!: EntityTable<DaySnapshot, 'dateKey'>
  pointLedger!: EntityTable<PointLedgerEntry, 'id'>
  rewards!: EntityTable<Reward, 'id'>
  redemptions!: EntityTable<Redemption, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('study-workbench-v1')
    this.version(1).stores({
      contents: 'id, type, dueDate, archived, createdAt, subject',
      media: 'id, createdAt',
      reviewLogs: 'id, itemId, itemType, dateKey, reviewedAt, [itemId+dateKey]',
      daySnapshots: 'dateKey, createdAt',
      pointLedger: 'id, dateKey, reason, relatedId, createdAt',
      rewards: 'id, active, createdAt',
      redemptions: 'id, rewardId, status, requestedAt',
      settings: 'id',
    })
  }
}

export const db = new StudyDatabase()

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export async function ensureDefaults(): Promise<void> {
  const now = new Date().toISOString()
  if (!(await db.settings.get('main'))) {
    await db.settings.add({
      id: 'main',
      pinSalt: '',
      pinHash: '',
      streak: 0,
      lastCompletedDate: '',
      createdAt: now,
      updatedAt: now,
    })
  }
  if ((await db.rewards.count()) === 0) {
    await db.rewards.bulkAdd([
      { id: uid('reward'), name: '周末自由安排 30 分钟', cost: 80, active: true, createdAt: now, updatedAt: now },
      { id: uid('reward'), name: '选择一次家庭电影', cost: 150, active: true, createdAt: now, updatedAt: now },
    ])
  }
}
