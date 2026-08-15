import { useLiveQuery } from 'dexie-react-hooks'
import { Award, CheckCircle2, Clock3, Coins, Flame, Gift, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog, EmptyState } from '../components/ui'
import { db } from '../db'
import { dateKeysBack, toDateKey, weekdayLabel } from '../lib/date'
import { calculateBalance } from '../lib/points'
import { getWeeklyMetrics, requestRedemption } from '../services'
import type { Reward } from '../types'

export function GrowthPage({ notify }: { notify: (message: string) => void }) {
  const ledger = useLiveQuery(() => db.pointLedger.orderBy('createdAt').reverse().toArray()) ?? []
  const rewards = useLiveQuery(() => db.rewards.filter((reward) => reward.active).toArray()) ?? []
  const redemptions = useLiveQuery(() => db.redemptions.orderBy('requestedAt').reverse().toArray()) ?? []
  const settings = useLiveQuery(() => db.settings.get('main'))
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getWeeklyMetrics>> | null>(null)
  const [selected, setSelected] = useState<Reward | null>(null)
  const balance = calculateBalance(ledger)

  useEffect(() => { getWeeklyMetrics().then(setMetrics) }, [ledger.length])

  async function request() {
    if (!selected) return
    try {
      await requestRedemption(selected)
      notify('兑换申请已提交，等待家长确认')
    } catch (error) {
      notify(error instanceof Error ? error.message : '申请失败')
    }
  }

  const weeklyCompleted = metrics?.days.reduce((sum, day) => sum + day.reviewed, 0) ?? 0
  const maxDay = Math.max(1, ...(metrics?.days.map((day) => day.reviewed) ?? [1]))

  return (
    <div className="page growth-page">
      <header className="page-header"><div><span className="eyebrow">积累看得见</span><h1>成长</h1></div></header>

      <section className="balance-band">
        <div className="coin-mark"><Coins size={25} /></div>
        <div><span>可用积分</span><strong>{balance}</strong></div>
        <div className="streak-summary"><Flame size={18} /><span>连续<br /><strong>{settings?.streak ?? 0} 天</strong></span></div>
      </section>

      <section className="section-block">
        <header className="section-heading"><div><TrendingUp size={19} /><h2>近 7 天</h2></div><span>完成 {weeklyCompleted} 项</span></header>
        <div className="weekly-chart" aria-label="近七天完成数量柱状图">
          {(metrics?.days ?? dateKeysBack(7).map((dateKey) => ({ dateKey, completed: 0, reviewed: 0, total: 0 }))).map((day) => (
            <div className="chart-day" key={day.dateKey}>
              <div className="bar-track"><span style={{ height: `${Math.max(day.reviewed ? 12 : 2, (day.reviewed / maxDay) * 100)}%` }}><i>{day.reviewed}</i></span></div>
              <small>{day.dateKey === toDateKey() ? '今' : weekdayLabel(day.dateKey)}</small>
            </div>
          ))}
        </div>
        <div className="metric-strip">
          <span><strong>{metrics?.ratings.remembered ?? 0}</strong> 记住</span>
          <span><strong>{metrics?.ratings.fuzzy ?? 0}</strong> 模糊</span>
          <span><strong>{metrics?.ratings.forgot ?? 0}</strong> 忘记</span>
        </div>
      </section>

      <section className="section-block rewards-block">
        <header className="section-heading"><div><Gift size={19} /><h2>奖励清单</h2></div><span>由家长确认</span></header>
        {rewards.length ? rewards.map((reward) => (
          <article className="reward-row" key={reward.id}>
            <div className="reward-icon"><Award size={21} /></div>
            <div><strong>{reward.name}</strong><span><Coins size={15} /> {reward.cost} 分</span></div>
            <button type="button" className="button compact" disabled={balance < reward.cost} onClick={() => setSelected(reward)}>{balance < reward.cost ? '积分不足' : '兑换'}</button>
          </article>
        )) : <EmptyState icon={<Gift size={28} />} title="还没有奖励" text="请家长在“我的”中添加奖励。" />}
      </section>

      {redemptions.length > 0 && (
        <section className="section-block">
          <header className="section-heading"><div><Clock3 size={19} /><h2>兑换记录</h2></div></header>
          <div className="redemption-list">
            {redemptions.slice(0, 6).map((item) => (
              <div className="redemption-row" key={item.id}>
                {item.status === 'approved' ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}
                <div><strong>{item.rewardName}</strong><span>{item.status === 'pending' ? '等待家长确认' : item.status === 'approved' ? '已兑换' : '未通过'} · {item.cost} 分</span></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selected && <ConfirmDialog title="申请兑换？" text={`将申请使用 ${selected.cost} 积分兑换“${selected.name}”。积分会在家长确认后扣除。`} confirmLabel="提交申请" onConfirm={request} onClose={() => setSelected(null)} />}
    </div>
  )
}
