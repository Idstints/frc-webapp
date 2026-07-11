import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Shown once after a Google sign-in when we don't yet know the person's role.
export default function RoleSelectPage() {
  const { user, updateProfile } = useAuth()
  const [role, setRole] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // If they picked a role on the auth screen before the OAuth redirect, apply it.
  useEffect(() => {
    const pending = localStorage.getItem('frc-pending-role')
    if (pending === 'visitor' || pending === 'volunteer') setRole(pending)
  }, [])

  const save = async () => {
    if (!role) return
    setBusy(true)
    setError('')
    try {
      await updateProfile({
        role,
        full_name: user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '',
        email: user?.email,
      })
      localStorage.removeItem('frc-pending-role')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="splash">
      <div className="card card-pad" style={{ width: '100%', maxWidth: 460 }}>
        <h2 style={{ fontSize: 21, marginBottom: 6 }}>Welcome! One quick thing…</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 18 }}>How will you be using Footscray Repair Cafe?</p>
        {error && <div className="form-error">{error}</div>}
        <div className="opt-cards">
          <button type="button" className={`opt-card ${role === 'visitor' ? 'on' : ''}`} onClick={() => setRole('visitor')}>
            <span className="oc-icon">🏠</span>
            <span><span className="oc-title">Visitor</span><div className="oc-sub">I&rsquo;ve got something that needs repairing</div></span>
          </button>
          <button type="button" className={`opt-card ${role === 'volunteer' ? 'on' : ''}`} onClick={() => setRole('volunteer')}>
            <span className="oc-icon">🔧</span>
            <span><span className="oc-title">Volunteer / repairer</span><div className="oc-sub">I&rsquo;m part of the repair team</div></span>
          </button>
        </div>
        <button className="btn btn-primary btn-lg btn-block mt-16" onClick={save} disabled={!role || busy}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
