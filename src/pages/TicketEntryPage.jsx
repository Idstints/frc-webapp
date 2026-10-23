import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PublicShell from '../components/PublicShell'
import { Field, IconWrench } from '../components/ui'
import { formatTicket, isTicket, normaliseTicket } from '../lib/tickets'

// Two ways in: straight into a booking if this is their first visit, or the
// ticket number from the card we gave them. Reached from a printed QR code as
// /t/482137-KM, which fills the number in for them.
export default function TicketEntryPage() {
  const { code: codeFromLink } = useParams()
  const { signInWithTicket } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const attempted = useRef(false)

  const submit = async (e, value = code) => {
    e?.preventDefault()
    const ticket = normaliseTicket(value)
    if (!isTicket(ticket)) {
      setError('A ticket number is six digits and two letters, like 482137-KM.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await signInWithTicket(ticket)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message ?? 'We could not open that ticket. Please try again.')
      setBusy(false)
    }
  }

  // A scanned QR code carries the number — sign them in without any typing.
  useEffect(() => {
    if (!codeFromLink || attempted.current) return
    attempted.current = true
    const ticket = normaliseTicket(codeFromLink)
    setCode(formatTicket(ticket))
    if (isTicket(ticket)) submit(null, ticket)
  }, [codeFromLink]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PublicShell>
      <Link to="/" style={{ fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Back</Link>
      <h2 style={{ fontSize: 20, margin: '12px 0 16px' }}>Get something repaired</h2>

      <div className="first-visit">
        <div className="fv-head">
          <span className="fv-icon"><IconWrench /></span>
          <h3>First time with us?</h3>
        </div>
        <p>Book your item in and we will give you a ticket number at the end.</p>
        <Link to="/book" className="btn btn-lg btn-block fv-btn">Book a repair</Link>
      </div>

      <h3 style={{ fontSize: 15.5, margin: '28px 0 12px' }}>Already have a ticket number?</h3>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={submit}>
        <Field label="Your ticket number" hint="It is on the card we gave you, for example 482137-KM.">
          <input
            className="input ticket-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onBlur={() => setCode((c) => (isTicket(c) ? formatTicket(c) : c))}
            placeholder="482137-KM"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck="false"
            maxLength={12}
            aria-label="Your ticket number"
          />
        </Field>
        <button className="btn btn-secondary btn-lg btn-block" disabled={busy}>
          {busy ? 'Opening your repairs…' : 'Show my repairs'}
        </button>
      </form>

      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 18, textAlign: 'center', lineHeight: 1.55 }}>
        Lost your ticket number? Ask us at the next session, or call Angliss Neighbourhood House and
        we will look it up for you.
      </p>
    </PublicShell>
  )
}
