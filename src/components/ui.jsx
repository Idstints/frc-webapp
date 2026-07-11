import { useEffect } from 'react'
import { STATUS_META } from '../lib/constants'

/* ---------- icon set (stroke-based, consistent weight) ---------- */
const I = ({ children, ...props }) => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
)

export const IconWrench = (p) => (
  <I {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></I>
)
export const IconHome = (p) => (
  <I {...p}><path d="M3 9.5 12 3l9 6.5" /><path d="M5 8.5V21h14V8.5" /><path d="M9 21v-6h6v6" /></I>
)
export const IconHeart = (p) => (
  <I {...p}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" /></I>
)
export const IconCalendar = (p) => (
  <I {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></I>
)
export const IconMapPin = (p) => (
  <I {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></I>
)
export const IconClipboard = (p) => (
  <I {...p}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h6" /></I>
)
export const IconUsers = (p) => (
  <I {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></I>
)
export const IconChart = (p) => (
  <I {...p}><path d="M3 3v18h18" /><path d="M7 15v3M12 10v8M17 6v12" /></I>
)
export const IconCamera = (p) => (
  <I {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3.5" /></I>
)
export const IconImage = (p) => (
  <I {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L6 23" /></I>
)
export const IconDownload = (p) => (
  <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></I>
)
export const IconCheckCircle = (p) => (
  <I {...p}><circle cx="12" cy="12" r="10" /><path d="m8.5 12 2.5 2.5 5-5" /></I>
)
export const IconX = (p) => (
  <I {...p}><path d="M18 6 6 18M6 6l12 12" /></I>
)
export const IconCoffee = (p) => (
  <I {...p}><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" /></I>
)
export const FilterIcon = (p) => (
  <I {...p}><path d="M4 6h16M7 12h10M10 18h4" /></I>
)
export const SearchIcon = (p) => (
  <I {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></I>
)

/* ---------- shared pieces ---------- */
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

export function EmptyState({ icon = <IconClipboard />, title, children }) {
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
          <button className="modal-x" onClick={onClose} aria-label="Close"><IconX /></button>
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

// Site logo with graceful fallback to a wordmark tile.
// Replace frc-webapp/public/logo.png to change the logo.
export function BrandLogo({ height = 42 }) {
  return (
    <img
      src="/logo.png"
      alt="Footscray Repair Cafe"
      className="brand-logo"
      style={{ height }}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
        const fallback = e.currentTarget.nextElementSibling
        if (fallback) fallback.style.display = 'grid'
      }}
    />
  )
}

export function BrandMarkFallback() {
  return (
    <div className="brand-mark" style={{ display: 'none' }}>
      <IconWrench />
    </div>
  )
}
