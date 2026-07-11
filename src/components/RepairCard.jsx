import { CATEGORY_ICONS } from '../lib/constants'
import { formatSessionDate, formatShortDate } from '../lib/dates'
import { StatusBadge } from './ui'
import ProgressSteps from './ProgressSteps'

// Repair summary card. `showTracker` renders the visitor 4-step progress bar;
// the volunteer board uses the compact variant with visitor + assignee info.
export default function RepairCard({ repair, onClick, showTracker = false, showVisitor = false }) {
  return (
    <div className="card repair-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}>
      <div className="rc-top">
        <div className="rc-emoji">{CATEGORY_ICONS[repair.category] ?? '🧰'}</div>
        <div style={{ minWidth: 0 }}>
          <div className="rc-title">{repair.item}</div>
          <div className="rc-meta">
            <span>{repair.category}</span>
            {showVisitor && repair.visitor_name && <span className="dot">{repair.visitor_name}</span>}
            {repair.session_date
              ? <span className="dot">{formatSessionDate(repair.session_date)}</span>
              : <span className="dot">Booked {formatShortDate(repair.created_at)}</span>}
            {repair.assigned_repairer_name && (
              <span className="dot">🔧 {repair.assigned_repairer_name}</span>
            )}
          </div>
        </div>
        <div className="rc-right">
          <StatusBadge status={repair.status} />
        </div>
      </div>
      {showTracker && repair.status !== 'cancelled' && <ProgressSteps status={repair.status} />}
      {showTracker && repair.status === 'pending' && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          We&rsquo;ll confirm your booking by the Wednesday before the session.
        </div>
      )}
    </div>
  )
}
