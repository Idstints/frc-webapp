import { useEffect } from 'react'
import { STATUS_META } from '../lib/constants'

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />
}

export function Splash() {
  return (
    <div className="splash">
      <Spinner />
    </div>
  )
}

export function EmptyState({ icon = '🧰', title, children }) {
  return (
    <div className="empty">
      <div className="e-icon">{icon}</div>
      <div className="e-title">{title}</div>
      {children && <p>{children}</p>}
    </div>
  )
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status }
  return (
    <span className={`badge badge-${status}`}>
      <span className="bdot" />
      {meta.label}
    </span>
  )
}

export function Modal({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="m-sub">{subtitle}</div>}
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// Multi-select chips backed by an array value.
export function ChipGroup({ options, value, onChange, single = false, small = false }) {
  const toggle = (opt) => {
    if (single) {
      onChange(value === opt ? null : opt)
      return
    }
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])
  }
  const isOn = (opt) => (single ? value === opt : value.includes(opt))
  return (
    <div className="chip-group">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          className={`chip ${small ? 'chip-sm' : ''} ${isOn(opt) ? 'on' : ''}`}
          onClick={() => toggle(opt)}
          aria-pressed={isOn(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, required, children }) {
  return (
    <div className="field">
      <label>
        {label}
        {required && <span style={{ color: '#c04543' }}> *</span>}
      </label>
      {hint && <div className="hint">{hint}</div>}
      {children}
    </div>
  )
}

export function DetailRow({ label, value, wide }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className={`detail-row ${wide ? 'wide' : ''}`}>
      <div className="d-label">{label}</div>
      <div className="d-value">{value}</div>
    </div>
  )
}

export function initialsOf(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export const FilterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
)

export const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)

export const WrenchMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
  </svg>
)
