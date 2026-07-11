import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { SKILLS } from '../../lib/constants'
import { formatShortDate } from '../../lib/dates'
import { EmptyState, ChipGroup, initialsOf } from '../../components/ui'
import RepairCard from '../../components/RepairCard'
import RepairDetailModal from '../../components/RepairDetailModal'

// Tab 2 — the volunteer's own details and the repairs on their bench.
export default function MyBenchTab({ repairs, volunteers, profile, onRepairUpdated }) {
  const { updateProfile } = useAuth()
  const [selected, setSelected] = useState(null)
  const [editingSkills, setEditingSkills] = useState(false)
  const [skillDraft, setSkillDraft] = useState(profile?.skills ?? [])
  const [savingSkills, setSavingSkills] = useState(false)

  const mine = useMemo(() => repairs.filter((r) => r.assigned_repairer_id === profile.id), [repairs, profile.id])
  const active = mine.filter((r) => ['assigned', 'in_progress'].includes(r.status))
  const finished = mine.filter((r) => r.status === 'completed')

  const saveSkills = async () => {
    setSavingSkills(true)
    try {
      await updateProfile({ skills: skillDraft })
      setEditingSkills(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingSkills(false)
    }
  }

  return (
    <div>
      <div className="card vol-card">
        <div className="avatar">{initialsOf(profile.full_name)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="v-name">{profile.full_name || 'Unnamed volunteer'}</div>
          <div className="v-meta">
            {[profile.email, profile.phone, profile.suburb].filter(Boolean).join(' · ') || 'No contact details yet'}
          </div>
          <div className="v-meta">Volunteering since {formatShortDate(profile.created_at)}</div>
          <div style={{ marginTop: 10 }}>
            {editingSkills ? (
              <>
                <ChipGroup small options={SKILLS} value={skillDraft} onChange={setSkillDraft} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveSkills} disabled={savingSkills}>
                    {savingSkills ? 'Saving…' : 'Save specialisations'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditingSkills(false); setSkillDraft(profile.skills ?? []) }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(profile.skills ?? []).map((s) => <span key={s} className="skill-tag">{s}</span>)}
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingSkills(true)}>
                  {profile.skills?.length ? '✎ Edit' : '+ Add your specialisations'}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="vol-stats">
          <div className="vol-stat"><div className="n">{active.length}</div><div className="l">On the bench</div></div>
          <div className="vol-stat"><div className="n">{finished.length}</div><div className="l">Completed</div></div>
        </div>
      </div>

      <div className="section-head">
        <h2>On my bench</h2>
        <span className="count">{active.length} repair{active.length === 1 ? '' : 's'} assigned to you</span>
      </div>
      {active.length === 0 ? (
        <EmptyState icon="🛋️" title="Nothing on your bench">
          Head to the Repair board and assign yourself something from the queue.
        </EmptyState>
      ) : (
        <div className="repair-list">
          {active.map((r) => (
            <RepairCard key={r.id} repair={r} showVisitor onClick={() => setSelected(r)} />
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <>
          <div className="section-head">
            <h2>Completed by me</h2>
            <span className="count">{finished.length}</span>
          </div>
          <div className="repair-list">
            {finished.slice(0, 8).map((r) => (
              <RepairCard key={r.id} repair={r} showVisitor onClick={() => setSelected(r)} />
            ))}
          </div>
        </>
      )}

      {selected && (
        <RepairDetailModal
          repair={selected}
          mode="volunteer"
          profile={profile}
          volunteers={volunteers}
          onClose={() => setSelected(null)}
          onUpdated={(u) => { onRepairUpdated(u); setSelected(u) }}
        />
      )}
    </div>
  )
}
