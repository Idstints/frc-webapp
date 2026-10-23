import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PublicShell from '../components/PublicShell'
import { Field } from '../components/ui'
import { ANGLISS_CONTACT, ANGLISS_WEBSITE } from '../lib/constants'

// The stack sends no email, so a reset link would never arrive. A coordinator
// at Angliss sets a new password instead (Repair team > Set new password).
function ForgotPasswordNote() {
  const { name, phone, email } = ANGLISS_CONTACT
  const reach = [
    phone && <a key="p" href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>,
    email && <a key="e" href={`mailto:${email}`}>{email}</a>,
  ].filter(Boolean)

  return (
    <div className="forgot-box" role="note">
      {name || reach.length ? (
        <>
          Contact {name ? <strong>{name}</strong> : 'us'} at Angliss Neighbourhood House
          {reach.length > 0 && <> on {reach.reduce((acc, el, i) => (i ? [...acc, ' or ', el] : [el]), [])}</>}.
          {' '}They can set a new password for you.
        </>
      ) : (
        <>
          Contact Angliss Neighbourhood House and a coordinator will set a new password for you.
          {' '}<a href={ANGLISS_WEBSITE} target="_blank" rel="noopener noreferrer">Find their contact details ↗</a>
        </>
      )}
    </div>
  )
}

// Sign-in for the repair team. Visitors no longer come through here — they use
// a ticket number instead — but anyone who already has an account can still
// sign in with it.
export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [tab, setTab] = useState('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (tab === 'signin') {
        await signIn({ email, password })
      } else {
        if (!fullName.trim()) throw new Error('Please enter your name.')
        const { session } = await signUp({ email, password, fullName: fullName.trim(), role: 'volunteer' })
        if (!session) {
          setNotice('Almost done — please check your email for a confirmation link, then sign in.')
        }
      }
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      <Link to="/" style={{ fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Back</Link>
      <h2 style={{ fontSize: 20, margin: '12px 0 4px' }}>
        {tab === 'signin' ? 'Repair team sign-in' : 'Join the repair team'}
      </h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginBottom: 18 }}>
        {tab === 'signin'
          ? 'For volunteers and coordinators. Visitors do not need an account.'
          : 'New volunteer accounts are activated after review by a coordinator.'}
      </p>

      <div className="auth-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'signin'} className={tab === 'signin' ? 'on' : ''} onClick={() => setTab('signin')}>Sign in</button>
        <button role="tab" aria-selected={tab === 'signup'} className={tab === 'signup' ? 'on' : ''} onClick={() => setTab('signup')}>Create account</button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {notice && <div className="form-ok">{notice}</div>}

      <form onSubmit={submit}>
        {tab === 'signup' && (
          <Field label="Full name">
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Password">
          <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} />
        </Field>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'One moment…' : tab === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {tab === 'signin' && (
        <>
          <button type="button" className="forgot-link" aria-expanded={forgotOpen}
            onClick={() => setForgotOpen((o) => !o)}>
            Forgot your password?
          </button>
          {forgotOpen && <ForgotPasswordNote />}
        </>
      )}

      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 18, textAlign: 'center' }}>
        Here to get something repaired? <Link to="/ticket" style={{ fontWeight: 600 }}>Use your ticket number</Link>
      </p>
    </PublicShell>
  )
}
