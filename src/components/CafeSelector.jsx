import { useEffect, useRef, useState } from 'react'
import { IconMapPin } from './ui'

// One cafe today — the switcher is already wired for a multi-cafe future.
export default function CafeSelector({ cafes = [], selected, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = cafes.find((c) => c.id === selected) ?? cafes[0]

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={ref}>
      <button
        type="button"
        className={`cafe-select ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="pin"><IconMapPin /></span>
        {current?.name ?? 'Repair Cafe'}
        <svg className="caret" width="11" height="7" viewBox="0 0 12 8" fill="none" aria-hidden="true">
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="cafe-pop" role="listbox">
          {cafes.map((cafe) => (
            <div
              key={cafe.id}
              className={`cp-item ${cafe.id === current?.id ? 'on' : ''}`}
              role="option"
              aria-selected={cafe.id === current?.id}
              onClick={() => {
                onSelect?.(cafe.id)
                setOpen(false)
              }}
              style={{ cursor: 'pointer' }}
            >
              <span className="pin"><IconMapPin /></span>
              <div>
                {cafe.name}
                {cafe.venue && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{cafe.venue}</div>}
              </div>
              {cafe.id === current?.id && <span style={{ marginLeft: 'auto', color: 'var(--green-600)' }}>✓</span>}
            </div>
          ))}
          <div className="cp-soon">Additional repair cafes can be added here in future.</div>
        </div>
      )}
    </div>
  )
}
