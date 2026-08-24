export type ContentType = 'recitation' | 'mistake'
export type ReviewRating = 'forgot' | 'fuzzy' | 'remembered'

export interface ContentItem {
  id: string
  type: ContentType
  title: string
  category: string
  subject: string
  body: string
  tags: string[]
  imageIds: string[]
  answer: string
  analysis: string
  errorReason: string
  createdAt: string
  updatedAt: string
  dueDate: string
  reviewStage: number
  archived: boolean
}

export interface MediaAsset {
  id: string
  blob: Blob
  createdAt: string
}

export interface ReviewLog {
  id: string
  itemId: string
  itemType: ContentType
  rating: ReviewRating
  reviewedAt: string
  dateKey: string
  pointsAwarded: number
}

export interface DaySnapshot {
  dateKey: string
  itemIds: string[]
  scheduledItemIds?: string[]
  createdAt: string
  completionRewarded: boolean
}

export interface ReviewSession {
  id: 'active'
  dateKey: string
  itemIds: string[]
  currentIndex: number
  updatedAt: string
}

export type PointReason = 'review' | 'daily_complete' | 'redemption' | 'adjustment'

export interface PointLedgerEntry {
  id: string
  dateKey: string
  delta: number
  reason: PointReason
  relatedId: string
  note: string
  createdAt: string
}

export interface Reward {
  id: string
  name: string
  cost: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type RedemptionStatus = 'pending' | 'approved' | 'rejected'

export interface Redemption {
  id: string
  rewardId: string
  rewardName: string
  cost: number
  status: RedemptionStatus
  requestedAt: string
  resolvedAt?: string
}

export interface AppSettings {
  id: 'main'
  pinSalt: string
  pinHash: string
  streak: number
  lastCompletedDate: string
  createdAt: string
  updatedAt: string
}

export interface BackupPayload {
  version: 1
  exportedAt: string
  contents: ContentItem[]
  media: Array<Omit<MediaAsset, 'blob'> & { dataUrl: string }>
  reviewLogs: ReviewLog[]
  daySnapshots: DaySnapshot[]
  pointLedger: PointLedgerEntry[]
  rewards: Reward[]
  redemptions: Redemption[]
  settings: AppSettings[]
  reviewSessions?: ReviewSession[]
}

export interface ReviewOutcome {
  stage: number
  intervalDays: number
  dueDate: string
}
