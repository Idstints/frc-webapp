import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { IconCheckCircle } from '../components/ui'

// Volunteers see this until a current team member approves their account.
// Until then, row-level security keeps all repair and visitor data hidden.
export default function PendingApprovalPage() {
  const { profile, updateProfile, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  const switchToVisitor = async () => {
    setBusy(true)
    try {
      await updateProfile({ role: 'visitor' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="splash">
      <div className="card card-pad" style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <div className="done-ic" style={{ margin: '0 auto 16px' }}><IconCheckCircle /></div>
        <h2 style={{ fontSize: 19, marginBottom: 8 }}>Thanks for joining, {profile?.full_name?.split(' ')[0] || 'there'}</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.6, marginBottom: 8 }}>
          Volunteer accounts are reviewed by the repair cafe team before they&rsquo;re activated —
          this protects our visitors&rsquo; contact details. A coordinator will approve your account
          shortly, usually within a few days.
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 20 }}>
          Questions? Contact the team at Angliss Neighbourhood House.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={switchToVisitor} disabled={busy}>
            Continue as a visitor instead
          </button>
          <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </div>
  )
}
