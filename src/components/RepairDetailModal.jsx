import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { CATEGORY_ICONS, OUTCOMES, OUTCOME_LABELS } from '../lib/constants'
import { formatSessionDate, formatShortDate, upcomingSessionDates } from '../lib/dates'
import { Modal, DetailRow, StatusBadge, Field } from './ui'
import ProgressSteps from './ProgressSteps'

// Full repair record with the volunteer workflow:
// confirm appointment → assign repairer → start → complete (outcome form).
// Visitors get a read-only view of the same record (plus cancel while pending).
export default function RepairDetailModal({ repair, mode, profile, volunteers = [], onClose, onUpdated }) {
  const [view, setView] = useState('details') // details | complete
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assignTo, setAssignTo] = useState(repair.assigned_repairer_id ?? '')
  const [sessionDate, setSessionDate] = useState(repair.session_date ?? '')

  // completion form (pre-filled per the workflow: repairer name is automatic)
  const [doneFor, setDoneFor] = useState(repair.visitor_name ?? '')
  const [diagnosis, setDiagnosis] = useState(repair.diagnosis ?? '')
  const [workDone, setWorkDone] = useState(repair.work_done ?? '')
  const [outcome, setOutcome] = useState(repair.outcome ?? '')
  const [notes, setNotes] = useState(repair.repairer_notes ?? '')

  const isVolunteer = mode === 'volunteer'

  const dateOptions = useMemo(() => {
    const opts = [...new Set([...(repair.preferred_dates ?? []), ...upcomingSessionDates(6), ...(repair.session_date ? [repair.session_date] : [])])]
    return opts.sort()
  }, [repair])

  const patch = async (fields) => {
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('repair_requests')
      .update(fields)
      .eq('id', repair.id)
      .select()
      .single()
    setSaving(false)
    if (err) {
      setError(err.message)
      return null
    }
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
      setError('Pick a repairer to assign.')
      return
    }
    await patch({
      status: 'assigned',
      assigned_repairer_id: target.id,
      assigned_repairer_name: target.full_name,
      assigned_at: new Date().toISOString(),
      // keep whatever session date is currently chosen
      session_date: sessionDate || repair.session_date || null,
      ...(repair.confirmed_at ? {} : { confirmed_at: new Date().toISOString() }),
    })
  }

  const startRepair = () => patch({ status: 'in_progress', started_at: new Date().toISOString() })

  const completeRepair = async () => {
    if (!outcome) {
      setError('Select whether the repair was possible.')
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
      // a volunteer finishing an unassigned job claims it
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
          <Field label="Repair done for">
            <input className="input" value={doneFor} onChange={(e) => setDoneFor(e.target.value)} />
          </Field>
          <Field label="Repairer" hint="Filled in automatically">
            <input className="input" value={repair.assigned_repairer_name || profile?.full_name || ''} disabled />
          </Field>
        </div>
        <Field label="What was wrong with it?" required>
          <textarea className="textarea" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Your findings — e.g. broken solder joint on the power switch" />
        </Field>
        <Field label="What was done to fix it?">
          <textarea className="textarea" value={workDone} onChange={(e) => setWorkDone(e.target.value)}
            placeholder="e.g. Re-soldered the joint and replaced the fuse" />
        </Field>
        <Field label="Was the repair possible?" required>
          <div className="opt-cards">
            {OUTCOMES.map((o) => (
              <button type="button" key={o.value} className={`opt-card ${outcome === o.value ? 'on' : ''}`}
                onClick={() => setOutcome(o.value)}>
                <span className="oc-icon">{{ fixed: '✅', partially_fixed: '🔩', advice_given: '💡', not_repairable: '🪦' }[o.value]}</span>
                <span><span className="oc-title">{o.short}</span><div className="oc-sub">{o.label}</div></span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Extra notes" hint="Spare parts needed, advice given to the visitor, anything for next time">
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
              <option value="">Choose a date…</option>
              {dateOptions.map((d) => (
                <option key={d} value={d}>
                  {formatSessionDate(d)}{repair.preferred_dates?.includes(d) ? ' — requested' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="detail-row" style={{ alignSelf: 'end' }}>
            <button className="btn btn-primary btn-block" onClick={confirmAppointment} disabled={saving}>
              ✓ Confirm appointment
            </button>
          </div>
        </>
      )}

      {(repair.status === 'confirmed' || repair.status === 'assigned') && (
        <>
          <div className="detail-row">
            <div className="d-label">{repair.status === 'assigned' ? 'Reassign repairer' : 'Assign a repairer'}</div>
            <select className="select mt-8" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">Choose a repairer…</option>
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
                🔧 Start repair
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setView('complete')} disabled={saving}>
              ✓ Complete repair…
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <Modal
      title={`${CATEGORY_ICONS[repair.category] ?? '🧰'} ${repair.item}`}
      subtitle={`${repair.category} · booked ${formatShortDate(repair.created_at)}`}
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
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <StatusBadge status={repair.status} />
        {repair.session_date && (
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>📅 {formatSessionDate(repair.session_date)}{repair.preferred_time ? ` · ${repair.preferred_time}` : ''}</span>
        )}
      </div>

      {repair.status !== 'cancelled' && (
        <div style={{ marginBottom: 18 }}>
          <ProgressSteps status={repair.status} />
        </div>
      )}

      <div className="detail-grid">
        <DetailRow label="Visitor" value={repair.visitor_name} />
        <DetailRow label="Repairer" value={repair.assigned_repairer_name ?? 'Not assigned yet'} />
        {isVolunteer && <DetailRow label="Email" value={repair.email} />}
        {isVolunteer && <DetailRow label="Phone" value={repair.phone} />}
        {isVolunteer && <DetailRow label="Contact preference" value={repair.contact_methods?.join(', ')} />}
        {isVolunteer && <DetailRow label="Languages at home" value={repair.languages} />}

        <div className="detail-sep">The item</div>
        <DetailRow label="Brand" value={repair.brand} />
        <DetailRow label="Year of production" value={repair.year_of_production} />
        <DetailRow label="Model / serial" value={repair.model_serial} />
        <DetailRow label="Preferred time" value={repair.preferred_time} />
        <DetailRow wide label="The problem" value={repair.problem_description} />
        <DetailRow wide label="Parts & materials on hand" value={repair.parts_materials} />
        {!repair.session_date && repair.preferred_dates?.length > 0 && (
          <DetailRow wide label="Dates the visitor can attend" value={repair.preferred_dates.map(formatSessionDate).join(' · ')} />
        )}

        {(repair.diagnosis || repair.work_done || repair.outcome) && (
          <>
            <div className="detail-sep">Repair outcome</div>
            <DetailRow label="Was repair possible?" value={repair.outcome ? OUTCOME_LABELS[repair.outcome] : null} />
            <DetailRow label="Completed" value={repair.completed_at ? formatShortDate(repair.completed_at) : null} />
            <DetailRow wide label="What was wrong" value={repair.diagnosis} />
            <DetailRow wide label="What was done" value={repair.work_done} />
            <DetailRow wide label="Notes" value={repair.repairer_notes} />
          </>
        )}
      </div>

      {workflow}
    </Modal>
  )
}
