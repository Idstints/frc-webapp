import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { STATUS_META, SKILLS } from '../../lib/constants'
import { formatShortDate } from '../../lib/dates'
import { EmptyState, FilterIcon, SearchIcon, ChipGroup, initialsOf, IconUsers } from '../../components/ui'
import RepairCard from '../../components/RepairCard'
import RepairDetailModal from '../../components/RepairDetailModal'

// Tab 1 — browse every repair in the database, or search the repairer roster.
export default function BrowseTab({ repairs, volunteers, pendingVolunteers = [], profile, onRepairUpdated, onTeamChanged }) {
  const [mode, setMode] = useState('repairs')
  const [selected, setSelected] = useState(null)
  const [actioning, setActioning] = useState('')
  const [teamError, setTeamError] = useState('')

  const decideVolunteer = async (id, approve) => {
    setActioning(id + approve)
    setTeamError('')
    const { error } = await supabase.rpc('set_volunteer_approval', { target_id: id, make_approved: approve })
    if (error) setTeamError(error.message)
    else await onTeamChanged?.()
    setActioning('')
  }

  // repair filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('newest')

  // repairer filters
  const [volSearch, setVolSearch] = useState('')
  const [skillFilter, setSkillFilter] = useState([])

  const visibleRepairs = useMemo(() => {
    let list = [...repairs]
    if (statusFilter === 'open') list = list.filter((r) => !['completed', 'cancelled'].includes(r.status))
    else if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((r) =>
        r.item.toLowerCase().includes(q) ||
        r.visitor_name?.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.assigned_repairer_name?.toLowerCase().includes(q))
    }
    if (sort === 'newest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sort === 'oldest') list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sort === 'name') list.sort((a, b) => a.item.localeCompare(b.item))
    return list
  }, [repairs, search, statusFilter, sort])

  const visibleVolunteers = useMemo(() => {
    let list = [...volunteers]
    if (volSearch.trim()) {
      const q = volSearch.trim().toLowerCase()
      list = list.filter((v) => v.full_name.toLowerCase().includes(q) || v.suburb?.toLowerCase().includes(q))
    }
    if (skillFilter.length) {
      list = list.filter((v) => skillFilter.every((s) => v.skills?.includes(s)))
    }
    return list
  }, [volunteers, volSearch, skillFilter])

  const activeCount = (volId) =>
    repairs.filter((r) => r.assigned_repairer_id === volId && ['assigned', 'in_progress'].includes(r.status)).length
  const doneCount = (volId) =>
    repairs.filter((r) => r.assigned_repairer_id === volId && r.status === 'completed').length

  return (
    <div>
      <div className="seg" role="tablist" style={{ marginBottom: 16 }}>
        <button role="tab" aria-selected={mode === 'repairs'} className={mode === 'repairs' ? 'on' : ''} onClick={() => setMode('repairs')}>
          Repairs
        </button>
        <button role="tab" aria-selected={mode === 'repairers'} className={mode === 'repairers' ? 'on' : ''} onClick={() => setMode('repairers')}>
          Repairers
        </button>
      </div>

      {mode === 'repairs' ? (
        <>
          <div className="filterbar">
            <span className="f-ic"><FilterIcon /></span>
            <span className="f-ic" style={{ paddingLeft: 0 }}><SearchIcon /></span>
            <input className="input search" placeholder="Search by item, visitor or repairer" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="open">Open (not finished)</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="newest">Date — newest first</option>
              <option value="oldest">Date — oldest first</option>
              <option value="name">Item name A–Z</option>
            </select>
          </div>

          {visibleRepairs.length === 0 ? (
            <EmptyState title={repairs.length ? 'Nothing matches those filters' : 'No repairs recorded yet'}>
              {repairs.length ? 'Try widening the search or status filter.' : 'Bookings will appear here as visitors submit them.'}
            </EmptyState>
          ) : (
            <div className="repair-list">
              {visibleRepairs.map((r) => (
                <RepairCard key={r.id} repair={r} showVisitor onClick={() => setSelected(r)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {pendingVolunteers.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 0 }}>
                <h2>Awaiting approval</h2>
                <span className="count">{pendingVolunteers.length} new volunteer{pendingVolunteers.length === 1 ? '' : 's'}</span>
              </div>
              {teamError && <div className="form-error">{teamError}</div>}
              <div className="repair-list" style={{ marginBottom: 24 }}>
                {pendingVolunteers.map((v) => (
                  <div key={v.id} className="card repairer-card approve-card">
                    <div className="avatar">{initialsOf(v.full_name)}</div>
                    <div className="r-main">
                      <div className="r-name">{v.full_name || 'Unnamed volunteer'}</div>
                      <div className="r-sub">
                        {[v.email, v.suburb].filter(Boolean).join(' · ')} · signed up {formatShortDate(v.created_at)}
                      </div>
                    </div>
                    <div className="a-actions">
                      <button className="btn btn-primary btn-sm" disabled={!!actioning}
                        onClick={() => decideVolunteer(v.id, true)}>
                        {actioning === v.id + true ? 'Approving…' : 'Approve'}
                      </button>
                      <button className="btn btn-danger btn-sm" disabled={!!actioning}
                        onClick={() => window.confirm(`Decline ${v.full_name}? Their account will become a visitor account.`) && decideVolunteer(v.id, false)}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="section-head" style={{ marginTop: 0 }}>
                <h2>Repair team</h2>
                <span className="count">{volunteers.length} approved</span>
              </div>
            </>
          )}
          <div className="filterbar">
            <span className="f-ic"><SearchIcon /></span>
            <input className="input search" placeholder="Search repairers by name or suburb" value={volSearch} onChange={(e) => setVolSearch(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <ChipGroup small options={SKILLS} value={skillFilter} onChange={setSkillFilter} />
          </div>

          {visibleVolunteers.length === 0 ? (
            <EmptyState icon={<IconUsers />} title="No repairers match">
              Try removing a specialisation filter, or invite more volunteers to register.
            </EmptyState>
          ) : (
            <div className="repair-list">
              {visibleVolunteers.map((v) => (
                <div key={v.id} className="card repairer-card">
                  <div className="avatar">{initialsOf(v.full_name)}</div>
                  <div className="r-main">
                    <div className="r-name">{v.full_name}{v.id === profile.id ? ' (you)' : ''}</div>
                    <div className="r-sub">
                      {[v.suburb, v.email].filter(Boolean).join(' · ')}
                      {' · '}{activeCount(v.id)} active · {doneCount(v.id)} completed · joined {formatShortDate(v.created_at)}
                    </div>
                  </div>
                  <div className="r-skills">
                    {(v.skills ?? []).slice(0, 4).map((s) => <span key={s} className="skill-tag">{s}</span>)}
                    {(v.skills?.length ?? 0) > 4 && <span className="skill-tag more">+{v.skills.length - 4}</span>}
                    {!v.skills?.length && <span className="skill-tag more">No specialisations listed</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
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
