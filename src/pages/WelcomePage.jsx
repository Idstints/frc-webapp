import { Link } from 'react-router-dom'
import PublicShell from '../components/PublicShell'
import { IconWrench, IconHeart } from '../components/ui'

// The front door. Visitors need a ticket number, not an account — so the only
// thing asked of them here is which of the two things they came to do.
export default function WelcomePage() {
  return (
    <PublicShell>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Welcome</h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginBottom: 20 }}>
        No account, no password and no email to confirm — just a ticket number we give you.
      </p>

      <div className="welcome-actions">
        <Link to="/ticket" className="welcome-action primary">
          <span className="wa-icon"><IconWrench /></span>
          <span>
            <span className="wa-title">Want to get something repaired?</span>
            <span className="wa-sub">Book an item in, or check a repair you have already booked.</span>
          </span>
        </Link>

        <Link to="/team" className="welcome-action">
          <span className="wa-icon"><IconHeart /></span>
          <span>
            <span className="wa-title">Volunteer with us</span>
            <span className="wa-sub">Good with tools, sewing or electronics — or simply good with people?</span>
          </span>
        </Link>
      </div>

      <div className="divider">or</div>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
        Already on the repair team? <Link to="/team" style={{ fontWeight: 600 }}>Sign in here</Link>
      </p>
    </PublicShell>
  )
}
