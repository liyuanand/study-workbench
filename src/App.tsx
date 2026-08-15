import { useLiveQuery } from 'dexie-react-hooks'
import { Award, BookOpenText, Library, RefreshCw, Settings, Sparkles, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { db, ensureDefaults } from './db'
import { ensureTodaySnapshot } from './services'
import { GrowthPage } from './pages/GrowthPage'
import { LibraryPage } from './pages/LibraryPage'
import { MePage } from './pages/MePage'
import { ReviewPage } from './pages/ReviewPage'
import { TodayPage } from './pages/TodayPage'
import { Toast } from './components/ui'

const navItems = [
  { to: '/today', label: '今日', icon: BookOpenText },
  { to: '/library', label: '资料库', icon: Library },
  { to: '/growth', label: '成长', icon: Award },
  { to: '/me', label: '我的', icon: UserRound },
]

export default function App() {
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [toast, setToast] = useState('')
  const updateServiceWorker = useRef<(reloadPage?: boolean) => Promise<void>>()
  const settings = useLiveQuery(() => db.settings.get('main'))
  const isReview = location.pathname.startsWith('/review/')

  useEffect(() => {
    Promise.all([ensureDefaults(), ensureTodaySnapshot()]).then(() => setReady(true)).catch((error) => setToast(error instanceof Error ? error.message : '初始化失败'))
  }, [])

  useEffect(() => {
    updateServiceWorker.current = registerSW({
      onNeedRefresh() { setUpdateReady(true) },
      onOfflineReady() { setToast('离线模式已准备好') },
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!ready) {
    return (
      <main className="app-frame loading-screen">
        <div className="brand-mark"><Sparkles size={24} /></div>
        <strong>正在整理今天的学习计划</strong>
      </main>
    )
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <main id="main-content" className={isReview ? 'main review-main' : 'main'}>
        <Routes>
          <Route path="/today" element={<TodayPage streak={settings?.streak ?? 0} />} />
          <Route path="/library" element={<LibraryPage notify={setToast} />} />
          <Route path="/growth" element={<GrowthPage notify={setToast} />} />
          <Route path="/me" element={<MePage notify={setToast} />} />
          <Route path="/review/:id" element={<ReviewPage notify={setToast} />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>
      {!isReview && (
        <nav className="bottom-nav" aria-label="主要导航">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={22} strokeWidth={1.9} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
      {updateReady && (
        <div className="update-banner" role="status">
          <RefreshCw size={18} />
          <span>新版本已准备好</span>
          <button type="button" onClick={() => updateServiceWorker.current?.(true)}>立即更新</button>
        </div>
      )}
      {toast && <Toast message={toast} />}
      <span className="sr-only">设置状态：{settings ? '已加载' : '未加载'} <Settings size={1} /></span>
    </div>
  )
}
