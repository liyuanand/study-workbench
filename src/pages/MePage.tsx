import { useLiveQuery } from 'dexie-react-hooks'
import { ArchiveRestore, BarChart3, Check, ChevronRight, Coins, Database, Download, Gift, HardDrive, KeyRound, LockKeyhole, Plus, ShieldCheck, Upload } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { ConfirmDialog, Field, Modal } from '../components/ui'
import { db, uid } from '../db'
import { hashPin, makeSalt, verifyPin } from '../lib/crypto'
import { calculateBalance } from '../lib/points'
import { addPointAdjustment, exportBackup, getWeeklyMetrics, importBackup, resolveRedemption, validateBackup } from '../services'
import type { AppSettings, BackupPayload, Reward } from '../types'

export function MePage({ notify }: { notify: (message: string) => void }) {
  const settings = useLiveQuery(() => db.settings.get('main'))
  const [parentOpen, setParentOpen] = useState(false)
  const [backupPreview, setBackupPreview] = useState<BackupPayload | null>(null)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    navigator.storage?.estimate().then((value) => setStorage({ usage: value.usage ?? 0, quota: value.quota ?? 0 }))
  }, [])

  async function downloadBackup() {
    try {
      const payload = await exportBackup()
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `学习工作台备份-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      notify('完整备份已导出，请妥善保存')
    } catch (error) {
      notify(error instanceof Error ? error.message : '备份导出失败')
    }
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const payload = validateBackup(JSON.parse(await file.text()))
      setBackupPreview(payload)
    } catch (error) {
      notify(error instanceof Error ? error.message : '备份文件读取失败')
    }
  }

  async function restoreBackup() {
    if (!backupPreview) return
    await importBackup(backupPreview)
    notify('备份恢复完成，正在重新载入')
    window.setTimeout(() => window.location.reload(), 500)
  }

  const usedMb = storage ? (storage.usage / 1024 / 1024).toFixed(1) : '—'
  const percent = storage?.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0

  return (
    <div className="page me-page">
      <header className="page-header"><div><span className="eyebrow">本机学习空间</span><h1>我的</h1></div></header>

      <section className="privacy-band"><ShieldCheck size={22} /><div><strong>资料仅保存在当前设备</strong><span>不会上传到 GitHub，也不会用于云端分析。</span></div></section>

      <section className="settings-section">
        <h2>家长协作</h2>
        <button type="button" className="settings-row" onClick={() => setParentOpen(true)}>
          <span className="settings-icon green"><LockKeyhole size={20} /></span>
          <span><strong>家长入口</strong><small>周报、奖励管理与兑换确认</small></span>
          <span className="settings-state">{settings?.pinHash ? '已设置' : '未设置'}</span><ChevronRight size={19} />
        </button>
      </section>

      <section className="settings-section">
        <h2>数据与备份</h2>
        <div className="storage-card">
          <div><HardDrive size={20} /><strong>本机存储</strong><span>{usedMb} MB 已使用</span></div>
          <div className="storage-track"><span style={{ width: `${Math.max(2, percent)}%` }} /></div>
          <small>清除浏览器站点数据会删除资料，请定期导出备份。</small>
        </div>
        <button type="button" className="settings-row" onClick={downloadBackup}>
          <span className="settings-icon blue"><Download size={20} /></span>
          <span><strong>导出完整备份</strong><small>包含图片、复习记录和奖励设置</small></span><ChevronRight size={19} />
        </button>
        <button type="button" className="settings-row" onClick={() => fileRef.current?.click()}>
          <span className="settings-icon amber"><Upload size={20} /></span>
          <span><strong>从备份恢复</strong><small>预览后整体替换当前数据</small></span><ChevronRight size={19} />
        </button>
        <input ref={fileRef} className="sr-only" type="file" accept="application/json,.json" onChange={chooseBackup} />
      </section>

      <section className="local-notice"><Database size={18} /><p>家长密码只用于区分操作入口。由于数据完全在本机保存，它不能防止通过浏览器工具修改或清除数据。</p></section>

      {parentOpen && settings && <ParentGate settings={settings} onClose={() => setParentOpen(false)} notify={notify} />}
      {backupPreview && <ConfirmDialog title="恢复这份备份？" text={`备份包含 ${backupPreview.contents.length} 条资料、${backupPreview.reviewLogs.length} 次复习和 ${backupPreview.media.length} 张图片。恢复后会整体替换当前数据，此操作无法撤销。`} confirmLabel="确认替换" danger onConfirm={restoreBackup} onClose={() => setBackupPreview(null)} />}
    </div>
  )
}

function ParentGate({ settings, onClose, notify }: { settings: AppSettings; onClose: () => void; notify: (message: string) => void }) {
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const pin = String(new FormData(event.currentTarget).get('pin') ?? '')
    if (!/^\d{4,8}$/.test(pin)) { setError('请输入 4–8 位数字密码。'); return }
    if (!settings.pinHash) {
      const salt = makeSalt()
      await db.settings.update('main', { pinSalt: salt, pinHash: await hashPin(pin, salt), updatedAt: new Date().toISOString() })
      setUnlocked(true)
      notify('家长密码已设置')
      return
    }
    if (!(await verifyPin(pin, settings.pinSalt, settings.pinHash))) { setError('密码不正确，请重试。'); return }
    setUnlocked(true)
  }

  if (unlocked) return <ParentDashboard onClose={onClose} notify={notify} />
  return (
    <Modal title={settings.pinHash ? '进入家长入口' : '设置家长密码'} onClose={onClose}>
      <form className="pin-form" onSubmit={submit}>
        <div className="pin-symbol"><KeyRound size={26} /></div>
        <p>{settings.pinHash ? '请输入家长密码查看周报并管理奖励。' : '首次使用，请设置 4–8 位数字密码。它只在当前设备生效。'}</p>
        <Field label="家长密码"><input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={8} autoFocus autoComplete="off" /></Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full-button">{settings.pinHash ? '验证并进入' : '保存并进入'}</button>
      </form>
    </Modal>
  )
}

function ParentDashboard({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const rewards = useLiveQuery(() => db.rewards.toArray()) ?? []
  const pending = useLiveQuery(() => db.redemptions.where('status').equals('pending').toArray()) ?? []
  const ledger = useLiveQuery(() => db.pointLedger.toArray()) ?? []
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getWeeklyMetrics>> | null>(null)
  const [addRewardOpen, setAddRewardOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  useEffect(() => { getWeeklyMetrics().then(setMetrics) }, [ledger.length])
  const total = metrics?.days.reduce((sum, day) => sum + day.total, 0) ?? 0
  const completed = metrics?.days.reduce((sum, day) => sum + day.completed, 0) ?? 0
  const completionRate = total ? Math.round((completed / total) * 100) : 0

  async function resolve(id: string, approved: boolean) {
    try { await resolveRedemption(id, approved); notify(approved ? '兑换已确认并扣除积分' : '兑换申请已拒绝') }
    catch (error) { notify(error instanceof Error ? error.message : '处理失败') }
  }

  return (
    <Modal title="家长入口" onClose={onClose} wide>
      <div className="parent-dashboard">
        <section className="parent-metrics">
          <div><BarChart3 size={19} /><span>7 天完成率</span><strong>{completionRate}%</strong></div>
          <div><Check size={19} /><span>完成复习</span><strong>{completed}</strong></div>
          <div><ArchiveRestore size={19} /><span>当前积压</span><strong>{metrics?.backlog ?? 0}</strong></div>
        </section>

        {pending.length > 0 && <section className="parent-section"><h3>待确认兑换</h3>{pending.map((item) => <div className="pending-row" key={item.id}><div><strong>{item.rewardName}</strong><span>{item.cost} 积分</span></div><button className="button secondary compact" onClick={() => resolve(item.id, false)}>拒绝</button><button className="button primary compact" onClick={() => resolve(item.id, true)}>确认</button></div>)}</section>}

        <section className="parent-section">
          <header><h3>奖励管理</h3><button className="button text-button" onClick={() => setAddRewardOpen(true)}><Plus size={17} /> 添加</button></header>
          <div className="manage-list">{rewards.map((reward) => <div className="manage-row" key={reward.id}><div><strong>{reward.name}</strong><span>{reward.cost} 分</span></div><label className="switch"><input type="checkbox" checked={reward.active} onChange={(event) => db.rewards.update(reward.id, { active: event.target.checked, updatedAt: new Date().toISOString() })} /><span aria-hidden="true" /></label></div>)}</div>
        </section>

        <section className="parent-section">
          <header><div><h3>积分账本</h3><small>当前可用 {calculateBalance(ledger)} 分</small></div><button className="button text-button" onClick={() => setAdjustOpen(true)}><Coins size={17} /> 调整</button></header>
          <div className="ledger-list">{ledger.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map((entry) => <div key={entry.id}><span>{entry.note}<small>{entry.dateKey}</small></span><strong className={entry.delta > 0 ? 'positive' : 'negative'}>{entry.delta > 0 ? '+' : ''}{entry.delta}</strong></div>)}</div>
        </section>

        {addRewardOpen && <RewardForm onClose={() => setAddRewardOpen(false)} notify={notify} />}
        {adjustOpen && <AdjustmentForm onClose={() => setAdjustOpen(false)} notify={notify} />}
      </div>
    </Modal>
  )
}

function RewardForm({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const cost = Number(form.get('cost'))
    if (!name || !Number.isInteger(cost) || cost < 1) { notify('请填写奖励名称和正整数积分'); return }
    const now = new Date().toISOString()
    const reward: Reward = { id: uid('reward'), name, cost, active: true, createdAt: now, updatedAt: now }
    await db.rewards.add(reward)
    notify('奖励已添加')
    onClose()
  }
  return <Modal title="添加奖励" onClose={onClose}><form className="content-form" onSubmit={submit}><Field label="奖励名称"><input name="name" autoFocus maxLength={40} placeholder="例如：选择周末晚餐" /></Field><Field label="所需积分"><input name="cost" type="number" inputMode="numeric" min={1} step={1} placeholder="100" /></Field><button className="button primary full-button">保存奖励</button></form></Modal>
}

function AdjustmentForm({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try { await addPointAdjustment(Number(form.get('delta')), String(form.get('note') ?? '')); notify('积分调整已写入账本'); onClose() }
    catch (caught) { setError(caught instanceof Error ? caught.message : '调整失败') }
  }
  return <Modal title="调整积分" onClose={onClose}><form className="content-form" onSubmit={submit}><Field label="调整数值" hint="增加填写正数，扣减填写负数。"><input name="delta" type="number" inputMode="numeric" step={1} autoFocus /></Field><Field label="调整原因"><input name="note" maxLength={60} placeholder="例如：线下任务补录" /></Field>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full-button">写入积分账本</button></form></Modal>
}
