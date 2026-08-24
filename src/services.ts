import { db, uid } from './db'
import { addDays, dateKeysBack, toDateKey } from './lib/date'
import { calculateBalance, canRequestReward } from './lib/points'
import { calculateReviewOutcome } from './lib/schedule'
import type {
  BackupPayload,
  ContentItem,
  ContentType,
  MediaAsset,
  Redemption,
  ReviewRating,
  Reward,
  ReviewSession,
} from './types'

export const DAILY_REVIEW_LIMIT = 100

function sortDueItems(items: ContentItem[]): ContentItem[] {
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt))
}

export async function ensureTodaySnapshot(dateKey = toDateKey()): Promise<void> {
  const dueItems = sortDueItems(await db.contents
    .filter((item) => !item.archived && item.dueDate <= dateKey)
    .toArray())
  const existing = await db.daySnapshots.get(dateKey)
  if (!existing) {
    const ids = dueItems.slice(0, DAILY_REVIEW_LIMIT).map((item) => item.id)
    await db.daySnapshots.add({ dateKey, itemIds: ids, scheduledItemIds: ids, createdAt: new Date().toISOString(), completionRewarded: false })
    return
  }
  const targetIds = existing.itemIds.slice(0, DAILY_REVIEW_LIMIT)
  const scheduled = [...new Set([...(existing.scheduledItemIds ?? targetIds), ...targetIds])].slice(0, DAILY_REVIEW_LIMIT)
  for (const item of dueItems) {
    if (scheduled.length >= DAILY_REVIEW_LIMIT) break
    if (!scheduled.includes(item.id)) scheduled.push(item.id)
  }
  if (existing.itemIds.length !== targetIds.length || !existing.scheduledItemIds || existing.scheduledItemIds.length !== scheduled.length || scheduled.some((id, index) => existing.scheduledItemIds?.[index] !== id)) {
    await db.daySnapshots.update(dateKey, { itemIds: targetIds, scheduledItemIds: scheduled })
  }
}

async function addToTodaySchedule(itemIds: string[], dateKey = toDateKey()): Promise<void> {
  await ensureTodaySnapshot(dateKey)
  const snapshot = await db.daySnapshots.get(dateKey)
  if (!snapshot) return
  const scheduled = [...new Set(snapshot.scheduledItemIds ?? snapshot.itemIds)].slice(0, DAILY_REVIEW_LIMIT)
  for (const id of itemIds) {
    if (scheduled.length >= DAILY_REVIEW_LIMIT) break
    if (!scheduled.includes(id)) scheduled.push(id)
  }
  await db.daySnapshots.update(dateKey, { scheduledItemIds: scheduled })
}

export async function addContent(
  values: Pick<ContentItem, 'type' | 'title' | 'category' | 'subject' | 'body' | 'tags' | 'imageIds' | 'answer' | 'analysis' | 'errorReason'>,
): Promise<ContentItem> {
  const now = new Date().toISOString()
  const item: ContentItem = {
    id: uid('content'),
    ...values,
    createdAt: now,
    updatedAt: now,
    dueDate: toDateKey(),
    reviewStage: -1,
    archived: false,
  }
  await db.contents.add(item)
  await addToTodaySchedule([item.id])
  return item
}

export async function addMistakePhotoBatch(
  files: File[],
  values: Pick<ContentItem, 'title' | 'subject' | 'tags' | 'answer' | 'analysis' | 'errorReason'>,
): Promise<number> {
  let saved = 0
  const digits = Math.max(2, String(files.length).length)
  for (const [index, file] of files.entries()) {
    let media: MediaAsset | undefined
    try {
      media = await saveMedia(file)
      const numberedTitle = files.length === 1 ? values.title : `${values.title} ${String(index + 1).padStart(digits, '0')}`
      await addContent({
        type: 'mistake',
        title: numberedTitle,
        category: '错题',
        subject: values.subject,
        body: '',
        tags: values.tags,
        imageIds: [media.id],
        answer: values.answer,
        analysis: values.analysis,
        errorReason: values.errorReason,
      })
      saved += 1
    } catch (error) {
      if (media) await db.media.delete(media.id)
      const detail = error instanceof Error ? error.message : '保存失败。'
      throw new Error(saved ? `已成功导入 ${saved} 张，第 ${saved + 1} 张失败。${detail}` : detail)
    }
  }
  return saved
}

export async function addRecitationTemplateItems(items: Array<Pick<ContentItem, 'title' | 'category' | 'subject' | 'body' | 'tags'>>): Promise<void> {
  const now = new Date().toISOString()
  const records = items.map((values) => ({
    id: uid('content'),
    type: 'recitation' as const,
    ...values,
    imageIds: [],
    answer: '',
    analysis: '',
    errorReason: '',
    createdAt: now,
    updatedAt: now,
    dueDate: toDateKey(),
    reviewStage: -1,
    archived: false,
  }))
  await db.contents.bulkAdd(records)
  await addToTodaySchedule(records.map((item) => item.id))
}

export async function completeReview(itemId: string, rating: ReviewRating, dateKey = toDateKey()): Promise<void> {
  await ensureTodaySnapshot(dateKey)
  await db.transaction('rw', db.contents, db.reviewLogs, db.pointLedger, db.daySnapshots, db.settings, async () => {
    const item = await db.contents.get(itemId)
    if (!item || item.archived) throw new Error('这条资料已不存在或已归档。')
    const snapshot = await db.daySnapshots.get(dateKey)
    const scheduledIds = snapshot?.scheduledItemIds ?? snapshot?.itemIds ?? []
    if (!scheduledIds.includes(itemId)) throw new Error(`今天最多复习 ${DAILY_REVIEW_LIMIT} 项，这条内容已排在后续。`)

    const existing = await db.reviewLogs.where('[itemId+dateKey]').equals([itemId, dateKey]).first()
    const outcome = calculateReviewOutcome(item.reviewStage, rating, dateKey)
    const now = new Date().toISOString()

    await db.contents.update(itemId, {
      reviewStage: outcome.stage,
      dueDate: outcome.dueDate,
      updatedAt: now,
    })
    await db.reviewLogs.add({
      id: uid('review'),
      itemId,
      itemType: item.type,
      rating,
      reviewedAt: now,
      dateKey,
      pointsAwarded: existing ? 0 : 5,
    })
    if (!existing) {
      await db.pointLedger.add({
        id: uid('points'),
        dateKey,
        delta: 5,
        reason: 'review',
        relatedId: itemId,
        note: `完成《${item.title}》复习`,
        createdAt: now,
      })
    }

    if (!snapshot || snapshot.completionRewarded || snapshot.itemIds.length === 0) return
    const logs = await db.reviewLogs.where('dateKey').equals(dateKey).toArray()
    const reviewedIds = new Set(logs.map((log) => log.itemId))
    const snapshotItems = await db.contents.bulkGet(snapshot.itemIds)
    const allDone = snapshot.itemIds.every((id, index) => reviewedIds.has(id) || !snapshotItems[index] || snapshotItems[index]?.archived)
    if (!allDone) return

    await db.pointLedger.add({
      id: uid('points'),
      dateKey,
      delta: 10,
      reason: 'daily_complete',
      relatedId: dateKey,
      note: '完成今日全部初始任务',
      createdAt: now,
    })
    await db.daySnapshots.update(dateKey, { completionRewarded: true })

    const settings = await db.settings.get('main')
    if (settings) {
      const streak = settings.lastCompletedDate === addDays(dateKey, -1) ? settings.streak + 1 : settings.lastCompletedDate === dateKey ? settings.streak : 1
      await db.settings.update('main', { streak, lastCompletedDate: dateKey, updatedAt: now })
    }
  })
}

export async function getNextDueItem(currentId: string, dateKey = toDateKey()): Promise<ContentItem | undefined> {
  const [items, logs] = await Promise.all([
    db.contents.filter((item) => !item.archived && item.dueDate <= dateKey).toArray(),
    db.reviewLogs.where('dateKey').equals(dateKey).toArray(),
  ])
  const reviewed = new Set(logs.map((log) => log.itemId))
  return items
    .filter((item) => item.id !== currentId && !reviewed.has(item.id))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt))[0]
}

export async function getOrCreateReviewSession(startId: string, dateKey = toDateKey()): Promise<ReviewSession> {
  await ensureTodaySnapshot(dateKey)
  const snapshot = await db.daySnapshots.get(dateKey)
  const allowed = new Set(snapshot?.scheduledItemIds ?? snapshot?.itemIds ?? [])
  const existing = await db.reviewSessions.get('active')
  if (existing && existing.dateKey === dateKey && existing.currentIndex < existing.itemIds.length) {
    const currentId = existing.itemIds[existing.currentIndex]
    const current = currentId ? await db.contents.get(currentId) : undefined
    if (current && !current.archived && allowed.has(current.id)) {
      const remaining = existing.itemIds.slice(existing.currentIndex).filter((id) => allowed.has(id))
      const resumed = { ...existing, itemIds: remaining, currentIndex: 0 }
      await db.reviewSessions.put(resumed)
      return resumed
    }
  }

  const logs = await db.reviewLogs.where('dateKey').equals(dateKey).toArray()
  const reviewed = new Set(logs.map((log) => log.itemId))
  const queue = (snapshot?.scheduledItemIds ?? snapshot?.itemIds ?? []).filter((id) => !reviewed.has(id))
  const session: ReviewSession = { id: 'active', dateKey, itemIds: queue, currentIndex: Math.max(0, queue.indexOf(startId)), updatedAt: new Date().toISOString() }
  await db.reviewSessions.put(session)
  return session
}

export async function advanceReviewSession(itemId: string, dateKey = toDateKey()): Promise<string | undefined> {
  const session = await db.reviewSessions.get('active')
  if (!session || session.dateKey !== dateKey) return undefined
  const index = session.itemIds.indexOf(itemId)
  const nextIndex = index >= 0 ? index + 1 : session.currentIndex + 1
  const nextId = session.itemIds[nextIndex]
  if (!nextId) {
    await db.reviewSessions.delete('active')
    return undefined
  }
  await db.reviewSessions.update('active', { currentIndex: nextIndex, updatedAt: new Date().toISOString() })
  return nextId
}

export async function requestRedemption(reward: Reward): Promise<Redemption> {
  const entries = await db.pointLedger.toArray()
  const balance = calculateBalance(entries)
  if (!canRequestReward(balance, reward.cost)) throw new Error('当前积分不足，先完成今天的复习吧。')
  if (!reward.active) throw new Error('这个奖励已暂停兑换。')
  const redemption: Redemption = {
    id: uid('redemption'),
    rewardId: reward.id,
    rewardName: reward.name,
    cost: reward.cost,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  }
  await db.redemptions.add(redemption)
  return redemption
}

export async function resolveRedemption(id: string, approved: boolean): Promise<void> {
  await db.transaction('rw', db.redemptions, db.pointLedger, async () => {
    const redemption = await db.redemptions.get(id)
    if (!redemption || redemption.status !== 'pending') throw new Error('兑换申请已经处理。')
    if (approved) {
      const balance = calculateBalance(await db.pointLedger.toArray())
      if (balance < redemption.cost) throw new Error('当前积分已不足，无法确认兑换。')
      await db.pointLedger.add({
        id: uid('points'),
        dateKey: toDateKey(),
        delta: -redemption.cost,
        reason: 'redemption',
        relatedId: redemption.id,
        note: `兑换：${redemption.rewardName}`,
        createdAt: new Date().toISOString(),
      })
    }
    await db.redemptions.update(id, {
      status: approved ? 'approved' : 'rejected',
      resolvedAt: new Date().toISOString(),
    })
  })
}

export async function addPointAdjustment(delta: number, note: string): Promise<void> {
  if (!Number.isInteger(delta) || delta === 0) throw new Error('调整积分必须是非零整数。')
  const balance = calculateBalance(await db.pointLedger.toArray())
  if (balance + delta < 0) throw new Error('调整后积分不能小于 0。')
  await db.pointLedger.add({
    id: uid('points'),
    dateKey: toDateKey(),
    delta,
    reason: 'adjustment',
    relatedId: uid('adjustment'),
    note: note.trim() || '家长积分调整',
    createdAt: new Date().toISOString(),
  })
}

export async function saveMedia(file: File): Promise<MediaAsset> {
  const blob = await compressImage(file)
  const asset: MediaAsset = { id: uid('media'), blob, createdAt: new Date().toISOString() }
  try {
    await db.media.add(asset)
  } catch (error) {
    throw new Error(`图片保存失败。请先导出备份并清理旧资料后重试。${error instanceof Error ? ` ${error.message}` : ''}`)
  }
  return asset
}

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法处理图片。')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78))
  if (!blob) throw new Error('图片压缩失败，请换一张图片重试。')
  return blob
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

export async function exportBackup(): Promise<BackupPayload> {
  const media = await Promise.all(
    (await db.media.toArray()).map(async ({ blob, ...asset }) => ({ ...asset, dataUrl: await blobToDataUrl(blob) })),
  )
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    contents: await db.contents.toArray(),
    media,
    reviewLogs: await db.reviewLogs.toArray(),
    daySnapshots: await db.daySnapshots.toArray(),
    pointLedger: await db.pointLedger.toArray(),
    rewards: await db.rewards.toArray(),
    redemptions: await db.redemptions.toArray(),
    settings: await db.settings.toArray(),
    reviewSessions: await db.reviewSessions.toArray(),
  }
}

export function validateBackup(value: unknown): BackupPayload {
  if (!value || typeof value !== 'object') throw new Error('备份文件格式不正确。')
  const payload = value as Partial<BackupPayload>
  if (payload.version !== 1 || !Array.isArray(payload.contents) || !Array.isArray(payload.media) || !Array.isArray(payload.reviewLogs)) {
    throw new Error('无法识别这个备份文件或版本不受支持。')
  }
  const requiredArrays: Array<keyof BackupPayload> = ['daySnapshots', 'pointLedger', 'rewards', 'redemptions', 'settings']
  if (requiredArrays.some((key) => !Array.isArray(payload[key]))) throw new Error('备份文件缺少必要数据。')
  return payload as BackupPayload
}

export async function importBackup(payload: BackupPayload): Promise<void> {
  const media = await Promise.all(payload.media.map(async ({ dataUrl, ...asset }) => ({ ...asset, blob: await dataUrlToBlob(dataUrl) })))
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
    if (payload.contents.length) await db.contents.bulkAdd(payload.contents)
    if (media.length) await db.media.bulkAdd(media)
    if (payload.reviewLogs.length) await db.reviewLogs.bulkAdd(payload.reviewLogs)
    if (payload.daySnapshots.length) await db.daySnapshots.bulkAdd(payload.daySnapshots)
    if (payload.pointLedger.length) await db.pointLedger.bulkAdd(payload.pointLedger)
    if (payload.rewards.length) await db.rewards.bulkAdd(payload.rewards)
    if (payload.redemptions.length) await db.redemptions.bulkAdd(payload.redemptions)
    if (payload.settings.length) await db.settings.bulkAdd(payload.settings)
    if (payload.reviewSessions?.length) await db.reviewSessions.bulkAdd(payload.reviewSessions)
  })
}

export async function getWeeklyMetrics(): Promise<{
  days: Array<{ dateKey: string; completed: number; reviewed: number; total: number }>
  ratings: Record<ReviewRating, number>
  bySubject: Array<{ subject: string; count: number }>
  backlog: number
}> {
  const today = toDateKey()
  const keys = dateKeysBack(7, today)
  const logs = await db.reviewLogs.where('dateKey').anyOf(keys).toArray()
  const snapshots = await db.daySnapshots.where('dateKey').anyOf(keys).toArray()
  const items = await db.contents.toArray()
  const itemMap = new Map(items.map((item) => [item.id, item]))
  const days = keys.map((dateKey) => {
    const snapshot = snapshots.find((entry) => entry.dateKey === dateKey)
    const reviewed = new Set(logs.filter((log) => log.dateKey === dateKey).map((log) => log.itemId))
    return {
      dateKey,
      completed: snapshot?.itemIds.filter((id) => reviewed.has(id)).length ?? 0,
      reviewed: reviewed.size,
      total: snapshot?.itemIds.length ?? 0,
    }
  })
  const ratings: Record<ReviewRating, number> = { forgot: 0, fuzzy: 0, remembered: 0 }
  const subjects = new Map<string, number>()
  logs.forEach((log) => {
    ratings[log.rating] += 1
    const subject = itemMap.get(log.itemId)?.subject || itemMap.get(log.itemId)?.category || '未分类'
    subjects.set(subject, (subjects.get(subject) ?? 0) + 1)
  })
  return {
    days,
    ratings,
    bySubject: [...subjects.entries()].map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count),
    backlog: items.filter((item) => !item.archived && item.dueDate < today).length,
  }
}

export function contentTypeLabel(type: ContentType): string {
  return type === 'recitation' ? '背诵' : '错题'
}
