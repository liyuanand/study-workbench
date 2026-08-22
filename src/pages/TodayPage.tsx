import { useLiveQuery } from 'dexie-react-hooks'
import { BookCheck, BookOpenText, CheckCircle2, CircleAlert, Flame, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ContentRow, DueAlert } from '../components/ContentRow'
import { EmptyState } from '../components/ui'
import { db } from '../db'
import { formatShortDate, toDateKey, weekdayLabel } from '../lib/date'
import type { ContentItem } from '../types'

function isCreatedToday(item: ContentItem, today: string): boolean {
  return item.createdAt.slice(0, 10) === today
}

export function TodayPage({ streak }: { streak: number }) {
  const today = toDateKey()
  const data = useLiveQuery(async () => {
    const [items, snapshot, logs] = await Promise.all([
      db.contents.filter((item) => !item.archived && item.dueDate <= today).toArray(),
      db.daySnapshots.get(today),
      db.reviewLogs.where('dateKey').equals(today).toArray(),
    ])
    const reviewed = new Set(logs.map((log) => log.itemId))
    const due = items.filter((item) => !reviewed.has(item.id))
    const snapshotIds = new Set(snapshot?.itemIds ?? [])
    return {
      due: due.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt)),
      reviewedCount: reviewed.size,
      initialTotal: snapshot?.itemIds.length ?? 0,
      initialDone: snapshot?.itemIds.filter((id) => reviewed.has(id)).length ?? 0,
      snapshotIds,
      completionRewarded: snapshot?.completionRewarded ?? false,
    }
  }, [today])

  const due = data?.due ?? []
  const overdue = due.filter((item) => item.dueDate < today)
  const newlyAdded = due.filter((item) => item.dueDate === today && isCreatedToday(item, today) && !data?.snapshotIds.has(item.id))
  const todayDue = due.filter((item) => !overdue.includes(item) && !newlyAdded.includes(item))
  const recitationCount = due.filter((item) => item.type === 'recitation').length
  const mistakeCount = due.filter((item) => item.type === 'mistake').length
  const minutes = recitationCount * 3 + mistakeCount * 5
  const targetProgress = data?.initialTotal ? Math.round(((data.initialDone ?? 0) / data.initialTotal) * 100) : 100
  const allDone = data?.reviewedCount ?? 0
  const allTotal = due.length + allDone
  const allProgress = allTotal ? Math.round((allDone / allTotal) * 100) : 100

  return (
    <div className="page today-page">
      <header className="page-header today-header">
        <div>
          <span className="eyebrow">{formatShortDate(today)} · 周{weekdayLabel(today)}</span>
          <h1>今天，稳稳推进</h1>
        </div>
        <div className="streak-pill" aria-label={`连续完成 ${streak} 天`}><Flame size={18} /> <strong>{streak}</strong> 天</div>
      </header>

      <section className="daily-summary" aria-labelledby="daily-title">
        <div className="summary-top">
          <div>
            <span id="daily-title">今日目标</span>
            <strong>{data?.initialDone ?? 0}<small> / {data?.initialTotal ?? 0}</small></strong>
          </div>
          <div className="progress-ring" style={{ '--progress': `${targetProgress * 3.6}deg` } as React.CSSProperties} aria-label={`今日目标完成 ${targetProgress}%`}>
            <span>{targetProgress}%</span>
          </div>
        </div>
        <div className="progress-track"><span style={{ width: `${targetProgress}%` }} /></div>
        <div className="all-progress" aria-label={`全部待复习进度 ${allDone} / ${allTotal}`}>
          <div><span>全部待复习</span><strong>{allDone} / {allTotal}</strong><small>{allProgress}%</small></div>
          <div className="all-progress-track"><span style={{ width: `${allProgress}%` }} /></div>
        </div>
        <div className="summary-stats">
          <span><BookOpenText size={17} /> 背诵 {recitationCount}</span>
          <span><BookCheck size={17} /> 错题 {mistakeCount}</span>
          <span>约 {minutes} 分钟</span>
        </div>
        {data?.completionRewarded && <div className="completion-note"><CheckCircle2 size={18} /> 今日整组奖励已获得 +10 分</div>}
      </section>

      <DueAlert count={overdue.length} />

      {due.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          title="今天的到期任务完成了"
          text={data?.reviewedCount ? '做得很扎实。可以去资料库加练，也可以安心收工。' : '还没有到期内容，先录入一篇背诵或一道错题。'}
          action={<Link className="button primary inline-button" to="/library"><Plus size={18} /> 添加资料</Link>}
        />
      ) : (
        <div className="task-sections">
          {overdue.length > 0 && <TaskGroup title="已逾期" icon={<CircleAlert size={18} />} items={overdue} status="已逾期" />}
          {todayDue.length > 0 && <TaskGroup title="今天到期" icon={<BookCheck size={18} />} items={todayDue} status="今天" />}
          {newlyAdded.length > 0 && <TaskGroup title="今天新增" icon={<Plus size={18} />} items={newlyAdded} status="不计入整组" />}
        </div>
      )}
    </div>
  )
}

function TaskGroup({ title, icon, items, status }: { title: string; icon: React.ReactNode; items: ContentItem[]; status: string }) {
  return (
    <section className="task-group">
      <header><h2>{icon}{title}</h2><span>{items.length} 项</span></header>
      <div className="content-list">{items.map((item) => <ContentRow key={item.id} item={item} status={status} />)}</div>
    </section>
  )
}
