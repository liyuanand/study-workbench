import { X } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useId, useRef } from 'react'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const focusable = [...(sheetRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]') ?? [])]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handle)
    return () => { window.removeEventListener('keydown', handle); previousFocus?.focus() }
  }, [onClose])
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={sheetRef} className={`modal-sheet ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={22} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onClose, danger = false }: {
  title: string
  text: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
  onClose: () => void
  danger?: boolean
}) {
  async function submit(event: FormEvent) {
    event.preventDefault()
    await onConfirm()
    onClose()
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="dialog-copy">{text}</p>
        <div className="button-row">
          <button type="button" className="button secondary" onClick={onClose}>取消</button>
          <button type="submit" className={`button ${danger ? 'danger' : 'primary'}`}>{confirmLabel}</button>
        </div>
      </form>
    </Modal>
  )
}

export function Toast({ message }: { message: string }) {
  return <div className="toast" role="status" aria-live="polite">{message}</div>
}
