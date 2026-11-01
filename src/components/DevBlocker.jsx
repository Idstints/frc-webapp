import { useEffect, useRef, useState } from 'react'
import { ANGLISS_WEBSITE, DEV_BLOCKER } from '../lib/constants'
import { IconX } from './ui'

// Holding screen while the site is still being built. Nothing behind it loads
// (not even sign-in) until the team code is entered, so the public only ever
// sees this page and a link to the neighbourhood house.
//
// It's a curtain, not a lock: the code ships inside the page like everything
// else. Records stay protected by sign-in and the database rules as usual.

const STORAGE_KEY = 'frc-dev-unlocked'

function wasUnlocked() {
  try {
    return localStorage.getItem(STORAGE_KEY) === DEV_BLOCKER.code
  } catch {
    return false
  }
}

export default function DevBlocker({ children }) {
  const [unlocked, setUnlocked] = useState(() => !DEV_BLOCKER.enabled || wasUnlocked())
  const [asking, setAsking] = useState(false)
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (asking) inputRef.current?.focus()
  }, [asking])

  if (unlocked) return children

  function toggleCodeEntry() {
    setAsking((a) => !a)
    setCode('')
    setWrong(false)
  }

  function submit(e) {
    e.preventDefault()
    if (code.trim().toLowerCase() !== DEV_BLOCKER.code.toLowerCase()) {
      setWrong(true)
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, DEV_BLOCKER.code)
    } catch {
      // Private window or storage blocked: let them in for this visit only.
    }
    setUnlocked(true)
  }

  return (
    <main className="devblock">
      <img
        className="devblock-logo"
        src="/logo.png"
        alt="Footscray Repair Cafe"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />

      <section className="devblock-card" aria-labelledby="devblock-title">
        <button
          type="button"
          className="devblock-close"
          onClick={toggleCodeEntry}
          aria-label={asking ? 'Close team access' : 'Team access'}
          aria-expanded={asking}
        >
          <IconX />
        </button>

        <h1 id="devblock-title">This site is currently under development</h1>
        <p>Please go to the Angliss Neighbourhood House website.</p>
        <a className="devblock-go" href={ANGLISS_WEBSITE}>
          Angliss Neighbourhood House
        </a>

        {asking && (
          <form
            className="devblock-form"
            onSubmit={submit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') toggleCodeEntry()
            }}
          >
            <div className="devblock-row">
              <input
                ref={inputRef}
                aria-label="Team code"
                placeholder="Code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setWrong(false)
                }}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" className="devblock-enter" aria-label="Enter">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
            {wrong && (
              <p className="devblock-error" role="alert">
                Not recognised.
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  )
}
