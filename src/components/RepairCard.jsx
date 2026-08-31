import { formatSessionDate, formatShortDate } from '../lib/dates'
import { formatTicket } from '../lib/tickets'
import { StatusBadge, IconImage } from './ui'
import ProgressSteps from './ProgressSteps'

// Repair summary card. Shows the visitor's item photo when one was provided.
// `showTracker` renders the visitor-facing 4-step progress bar; the volunteer
// board uses the compact variant with visitor and repairer details.
export default function RepairCard({ repair, onClick, showTracker = false, showVisitor = false, visitCount = 1, unread = 0 }) {
  const photo = repair.photos?.[0]
  return (
    <div className="card repair-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}>
      <div className="rc-top">
        {photo ? (
          <img className="photo-thumb" src={photo} alt={repair.item} loading="lazy" />
        ) : (
          <div className="photo-thumb photo-thumb--empty" aria-hidden="true"><IconImage /></div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="rc-title">
            {repair.item}
            {unread > 0 && <span className="unread-dot" title={`${unread} unread message${unread === 1 ? '' : 's'}`}>{unread}</span>}
          </div>
          <div className="rc-meta">
            <span className="rc-ticket">{formatTicket(repair.job_code)}</span>
            <span className="dot">{repair.category}</span>
            {showVisitor && repair.visitor_name && <span className="dot">{repair.visitor_name}</span>}
            {repair.session_date
              ? <span className="dot">{formatSessionDate(repair.session_date)}</span>
              : <span className="dot">Requested {formatShortDate(repair.created_at)}</span>}
            {repair.assigned_repairer_name && (
              <span className="dot">Repairer: {repair.assigned_repairer_name}</span>
            )}
            {visitCount > 1 && <span className="dot">{visitCount} visits</span>}
          </div>
        </div>
        <div className="rc-right">
          <StatusBadge status={repair.status} />
        </div>
      </div>
      {showTracker && repair.status !== 'cancelled' && <ProgressSteps status={repair.status} />}
      {showTracker && repair.status === 'pending' && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          Your booking will be confirmed by 6pm on the Wednesday before the session.
        </div>
      )}
    </div>
  )
}
