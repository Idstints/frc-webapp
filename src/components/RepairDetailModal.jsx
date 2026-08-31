import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { OUTCOMES, OUTCOME_LABELS } from '../lib/constants'
import { formatSessionDate, formatShortDate, upcomingSessionDates } from '../lib/dates'
import { formatTicket } from '../lib/tickets'
import { Modal, DetailRow, StatusBadge, Field, Spinner } from './ui'
import ProgressSteps from './ProgressSteps'
import MessageThread from './MessageThread'

// Full repair record with the volunteer workflow:
// confirm appointment → assign repairer → start → complete (outcome form).
// Visitors get a read-only view of the same record (plus cancel while pending),
// and either side can open the conversation for this ticket.
export default function RepairDetailModal({ repair, mode, profile, volunteers = [], onClose, onUpdated }) {
  const [view, setView] = useState('details') // details | messages | complete
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assignTo, setAssignTo] = useState(repair.assigned_repairer_id ?? '')
  const [sessionDate, setSessionDate] = useState(repair.session_date ?? '')
  const [lightbox, setLightbox] = useState(null)
  const [history, setHistory] = useState(null)
  const navigate = useNavigate()

  // completion form (repairer name is filled in automatically)
  const [doneFor, setDoneFor] = useState(repair.visitor_name ?? '')
  const [diagnosis, setDiagnosis] = useState(repair.diagnosis ?? '')
  const [workDone, setWorkDone] = useState(repair.work_done ?? '')
  const [outcome, setOutcome] = useState(repair.outcome ?? '')
  const [notes, setNotes] = useState(repair.repairer_notes ?? '')

  const isVolunteer = mode === 'volunteer'

  // Earlier visits on this same ticket — the context a repairer needs when an
  // item comes back for a second go.
  useEffect(() => {
    let live = true
    supabase
      .from('repair_requests')
      .select('*')
      .eq('job_code', repair.job_code)
      .neq('id', repair.id)
      .order('visit_number', { ascending: false })
      .then(({ data, error: err }) => {
        if (!live) return
        if (err) console.error(err)
        setHistory(data ?? [])
      })
    return () => { live = false }
  }, [repair.job_code, repair.id])

  const dateOptions = useMemo(() => {
    const opts = [...new Set([...(repair.preferred_dates ?? []), ...upcomingSessionDates(6), ...(repair.session_date ? [repair.session_date] : [])])]
    return opts.sort()
  }, [repair])

  const patch = async (fields) => {
    setSaving(true)
    setError('')
    // only apply if the record hasn't moved on since we loaded it — protects
    // against two people acting on the same repair at once
    const { data, error: err } = await supabase
      .from('repair_requests')
      .update(fields)
      .eq('id', repair.id)
      .eq('status', repair.status)
      .select()
      .maybeSingle()
    if (err) {
      setSaving(false)
      setError(err.message)
      return null
    }
    if (!data) {
      const { data: fresh } = await supabase
        .from('repair_requests')
        .select('*')
        .eq('id', repair.id)
        .maybeSingle()
      setSaving(false)
      if (fresh) onUpdated?.(fresh)
      setError('This repair was just updated by someone else — the details shown are now the latest.')
      return null
    }
    setSaving(false)
    onUpdated?.(data)
    return data
  }

  const confirmAppointment = () =>
    patch({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      session_date: sessionDate || repair.preferred_dates?.[0] || null,
    })

  const assignRepairer = async () => {
    const target = volunteers.find((v) => v.id === assignTo)
    if (!target) {
      setError('Please select a repairer to assign.')
      return
    }
    await patch({
      status: 'assigned',
      assigned_repairer_id: target.id,
      assigned_repairer_name: target.full_name,
      assigned_at: new Date().toISOString(),
      session_date: sessionDate || repair.session_date || null,
      ...(repair.confirmed_at ? {} : { confirmed_at: new Date().toISOString() }),
    })
  }

  const startRepair = () => patch({ status: 'in_progress', started_at: new Date().toISOString() })

  const completeRepair = async () => {
    if (!outcome) {
      setError('Please record whether the repair was possible.')
      return
    }
    const done = await patch({
      status: 'completed',
      completed_at: new Date().toISOString(),
      visitor_name: doneFor || repair.visitor_name,
      diagnosis,
      work_done: workDone,
      outcome,
      repair_possible: outcome !== 'not_repairable',
      repairer_notes: notes,
      // a volunteer completing an unassigned job takes ownership of it
      ...(repair.assigned_repairer_id
        ? {}
        : { assigned_repairer_id: profile?.id, assigned_repairer_name: profile?.full_name, assigned_at: new Date().toISOString() }),
    })
    if (done) onClose()
  }

  const cancelRepair = async () => {
    if (!window.confirm('Cancel this repair booking?')) return
    const done = await patch({ status: 'cancelled' })
    if (done) onClose()
  }

  const ticket = formatTicket(repair.job_code)
  const visitLabel = (repair.visit_number ?? 1) > 1 ? ` · visit ${repair.visit_number}` : ''

  /* ---------- completion form ---------- */
  if (view === 'complete') {
    return (
      <Modal
        title="Complete repair"
        subtitle={`${repair.item} — ${repair.category}`}
        onClose={onClose}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setView('details')} disabled={saving}>Back</button>
            <button className="btn btn-primary" onClick={completeRepair} disabled={saving}>
              {saving ? 'Saving…' : 'Mark as completed'}
            </button>
          </>
        }
      >
        {error && <div className="form-error">{error}</div>}
        <div className="grid-2">
          <Field label="Repair completed for">
            <input className="input" value={doneFor} onChange={(e) => setDoneFor(e.target.value)} />
          </Field>
          <Field label="Repairer" hint="Recorded automatically">
            <input className="input" value={repair.assigned_repairer_name || profile?.full_name || ''} disabled />
          </Field>
        </div>
        <Field label="What was wrong with the item?" required>
          <textarea className="textarea" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Your findings — for example, a failed solder joint on the power switch" />
        </Field>
        <Field label="What work was carried out?">
          <textarea className="textarea" value={workDone} onChange={(e) => setWorkDone(e.target.value)}
            placeholder="For example, re-soldered the joint and replaced the fuse" />
        </Field>
        <Field label="Was the repair possible?" required>
          <div className="opt-cards">
            {OUTCOMES.map((o) => (
              <button type="button" key={o.value} className={`opt-card ${outcome === o.value ? 'on' : ''}`}
                onClick={() => setOutcome(o.value)}>
                <span><span className="oc-title">{o.short}</span><div className="oc-sub">{o.label}</div></span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Additional notes" hint="Parts required, advice given to the visitor, or anything useful for next time">
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Modal>
    )
  }

  /* ---------- detail view ---------- */
  const workflow = isVolunteer && repair.status !== 'completed' && repair.status !== 'cancelled' && (
    <div className="detail-grid" style={{ marginTop: 14 }}>
      <div className="detail-sep">Workflow</div>

      {repair.status === 'pending' && (
        <>
          <div className="detail-row">
            <div className="d-label">Session date</div>
            <select className="select mt-8" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}>
              <option value="">Select a date…</option>
              {dateOptions.map((d) => (
                <option key={d} value={d}>
                  {formatSessionDate(d)}{repair.preferred_dates?.includes(d) ? ' — requested' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="detail-row" style={{ alignSelf: 'end' }}>
            <button className="btn btn-primary btn-block" onClick={confirmAppointment} disabled={saving}>
              Confirm appointment
            </button>
          </div>
        </>
      )}

      {(repair.status === 'confirmed' || repair.status === 'assigned') && (
        <>
          <div className="detail-row">
            <div className="d-label">{repair.status === 'assigned' ? 'Reassign repairer' : 'Assign a repairer'}</div>
            <select className="select mt-8" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">Select a repairer…</option>
              {volunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name}{v.id === profile?.id ? ' (me)' : ''}{v.skills?.length ? ` — ${v.skills.slice(0, 2).join(', ')}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="detail-row" style={{ alignSelf: 'end' }}>
            <div className="workflow-strip">
              {profile && assignTo !== profile.id && (
                <button className="btn btn-secondary" onClick={() => setAssignTo(profile.id)} disabled={saving}>
                  Assign to me
                </button>
              )}
              <button className="btn btn-primary" onClick={assignRepairer} disabled={saving || !assignTo}>
                {repair.status === 'assigned' ? 'Update assignment' : 'Assign repairer'}
              </button>
            </div>
          </div>
        </>
      )}

      {(repair.status === 'assigned' || repair.status === 'in_progress') && (
        <div className="detail-row wide">
          <div className="workflow-strip">
            {repair.status === 'assigned' && (
              <button className="btn btn-secondary" onClick={startRepair} disabled={saving}>
                Start repair
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setView('complete')} disabled={saving}>
              Complete repair…
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <Modal
      title={repair.item}
      subtitle={`Ticket ${ticket}${visitLabel} · ${repair.category}`}
      onClose={onClose}
      footer={
        <>
          {isVolunteer && repair.status !== 'cancelled' && repair.status !== 'completed' && (
            <button className="btn btn-danger btn-sm" onClick={cancelRepair} disabled={saving} style={{ marginRight: 'auto' }}>
              Cancel booking
            </button>
          )}
          {!isVolunteer && repair.status === 'pending' && (
            <button className="btn btn-danger btn-sm" onClick={cancelRepair} disabled={saving} style={{ marginRight: 'auto' }}>
              Cancel my booking
            </button>
          )}
          {!isVolunteer && repair.status === 'completed' && (
            <button className="btn btn-secondary" onClick={() => navigate(`/book?followup=${repair.job_code}`)}>
              Book a follow-up
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </>
      }
    >
      <div className="modal-tabs" role="tablist">
        <button role="tab" aria-selected={view === 'details'} className={view === 'details' ? 'on' : ''}
          onClick={() => setView('details')}>Details</button>
        <button role="tab" aria-selected={view === 'messages'} className={view === 'messages' ? 'on' : ''}
          onClick={() => setView('messages')}>Messages</button>
      </div>

      {view === 'messages' ? (
        <MessageThread jobCode={repair.job_code} requestId={repair.id} mode={mode} />
      ) : (
        <>
          {error && <div className="form-error">{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <StatusBadge status={repair.status} />
            {repair.session_date && (
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                {formatSessionDate(repair.session_date)}{repair.preferred_time ? ` · ${repair.preferred_time}` : ''}
              </span>
            )}
          </div>

          {repair.photos?.length > 0 && (
            <div className="photo-strip">
              {repair.photos.map((url) => (
                <img key={url} src={url} alt={repair.item} onClick={() => setLightbox(url)} />
              ))}
            </div>
          )}

          {repair.status !== 'cancelled' && (
            <div style={{ marginBottom: 18 }}>
              <ProgressSteps status={repair.status} />
            </div>
          )}

          <div className="detail-grid">
            <DetailRow label="Ticket number" value={ticket} />
            <DetailRow label="Visitor" value={repair.visitor_name} />
            <DetailRow label="Repairer" value={repair.assigned_repairer_name ?? 'Not yet assigned'} />
            {isVolunteer && <DetailRow label="Email" value={repair.email} />}
            {isVolunteer && <DetailRow label="Phone" value={repair.phone} />}
            {isVolunteer && <DetailRow label="Contact preference" value={repair.contact_methods?.join(', ')} />}
            {isVolunteer && <DetailRow label="Languages spoken at home" value={repair.languages} />}

            <div className="detail-sep">Item details</div>
            <DetailRow label="Brand" value={repair.brand} />
            <DetailRow label="Year of production" value={repair.year_of_production} />
            <DetailRow label="Model / serial number" value={repair.model_serial} />
            <DetailRow label="Preferred time" value={repair.preferred_time} />
            <DetailRow wide label="Reported problem" value={repair.problem_description} />
            <DetailRow wide label="Parts and materials supplied" value={repair.parts_materials} />
            {!repair.session_date && repair.preferred_dates?.length > 0 && (
              <DetailRow wide label="Available dates" value={repair.preferred_dates.map(formatSessionDate).join(' · ')} />
            )}

            {(repair.diagnosis || repair.work_done || repair.outcome) && (
              <>
                <div className="detail-sep">Repair outcome</div>
                <DetailRow label="Result" value={repair.outcome ? OUTCOME_LABELS[repair.outcome] : null} />
                <DetailRow label="Completed" value={repair.completed_at ? formatShortDate(repair.completed_at) : null} />
                <DetailRow wide label="Diagnosis" value={repair.diagnosis} />
                <DetailRow wide label="Work carried out" value={repair.work_done} />
                <DetailRow wide label="Notes" value={repair.repairer_notes} />
              </>
            )}
          </div>

          {history === null ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: 16 }}><Spinner /></div>
          ) : history.length > 0 && (
            <div className="detail-grid" style={{ marginTop: 14 }}>
              <div className="detail-sep">Earlier visits on this ticket</div>
              <div className="detail-row wide">
                {history.map((h) => (
                  <div className="visit-note" key={h.id}>
                    <div className="vn-head">
                      <strong>Visit {h.visit_number}</strong>
                      <span>{formatShortDate(h.completed_at ?? h.session_date ?? h.created_at)}</span>
                      {h.outcome && <span className="vn-outcome">{OUTCOME_LABELS[h.outcome]}</span>}
                      {h.assigned_repairer_name && <span>{h.assigned_repairer_name}</span>}
                    </div>
                    {h.problem_description && <p><span className="vn-label">Reported:</span> {h.problem_description}</p>}
                    {h.diagnosis && <p><span className="vn-label">Diagnosis:</span> {h.diagnosis}</p>}
                    {h.work_done && <p><span className="vn-label">Work done:</span> {h.work_done}</p>}
                    {h.repairer_notes && <p><span className="vn-label">Notes:</span> {h.repairer_notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {workflow}
        </>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt={repair.item} />
        </div>
      )}
    </Modal>
  )
}
