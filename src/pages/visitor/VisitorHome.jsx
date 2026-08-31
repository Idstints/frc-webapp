import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { STATUS_META } from '../../lib/constants'
import { groupIntoCases } from '../../lib/tickets'
import { EmptyState, Spinner, FilterIcon, SearchIcon, IconWrench, IconHeart, IconClipboard } from '../../components/ui'
import RepairCard from '../../components/RepairCard'
import RepairDetailModal from '../../components/RepairDetailModal'

export default function VisitorHome() {
  const { profile } = useAuth()
  const [repairs, setRepairs] = useState(null)
  const [unread, setUnread] = useState({}) // job_code → count
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('newest')

  useEffect(() => {
    let live = true
    supabase
      .from('repair_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!live) return
        if (error) console.error(error)
        setRepairs(data ?? [])
      })

    supabase
      .from('repair_messages')
      .select('job_code')
      .eq('sender_kind', 'team')
      .is('read_by_visitor_at', null)
      .then(({ data }) => {
        if (!live) return
        const counts = {}
        for (const m of data ?? []) counts[m.job_code] = (counts[m.job_code] ?? 0) + 1
        setUnread(counts)
      })

    return () => { live = false }
  }, [])

  // One card per item, not per booking — a follow-up shows up as another visit
  // on the ticket the visitor already has.
  const cases = useMemo(() => (repairs ? groupIntoCases(repairs) : []), [repairs])

  const visible = useMemo(() => {
    let list = [...cases]
    if (statusFilter !== 'all') list = list.filter((c) => c.latest.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((c) =>
        c.latest.item.toLowerCase().includes(q) ||
        c.latest.category.toLowerCase().includes(q) ||
        c.jobCode.toLowerCase().includes(q))
    }
    if (sort === 'newest') list.sort((a, b) => new Date(b.latest.created_at) - new Date(a.latest.created_at))
    if (sort === 'oldest') list.sort((a, b) => new Date(a.latest.created_at) - new Date(b.latest.created_at))
    if (sort === 'name') list.sort((a, b) => a.latest.item.localeCompare(b.latest.item))
    return list
  }, [cases, search, statusFilter, sort])

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="page">
      <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em' }}>
        {firstName ? `Welcome back, ${firstName}` : 'Welcome'}
      </h1>
      <p style={{ color: 'var(--ink-2)', marginTop: 4, marginBottom: 22, fontSize: 13.5 }}>
        Book a repair for our next session, or track the items you&rsquo;ve already brought in.
      </p>

      <div className="action-grid">
        <Link to="/book" className="action-card action-book">
          <div className="ac-icon"><IconWrench /></div>
          <h3>Book a repair</h3>
          <p>Reserve a place at our next session. Bring one item along and our volunteer repairers will work on it with you, free of charge.</p>
          <span className="ac-cta">Start a booking →</span>
        </Link>
        <Link to="/volunteer-apply" className="action-card action-volunteer">
          <div className="ac-icon"><IconHeart /></div>
          <h3>Volunteer with us</h3>
          <p>Good with tools, sewing, electronics — or simply good with people? Join the repair team or help welcome visitors on the day.</p>
          <span className="ac-cta">Apply to volunteer →</span>
        </Link>
      </div>

      <div className="section-head">
        <h2>My repairs</h2>
        {repairs && <span className="count">{cases.length} item{cases.length === 1 ? '' : 's'}</span>}
      </div>

      <div className="filterbar">
        <span className="f-ic"><FilterIcon /></span>
        <span className="f-ic" style={{ paddingLeft: 0 }}><SearchIcon /></span>
        <input className="input search" placeholder="Search by item or ticket number" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="newest">Date — newest first</option>
          <option value="oldest">Date — oldest first</option>
          <option value="name">Item name A–Z</option>
        </select>
      </div>

      {!repairs ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<IconClipboard />} title={cases.length ? 'Nothing matches those filters' : 'No repairs booked yet'}>
          {cases.length ? 'Try clearing the search or status filter.' : 'Book your first repair above — it only takes a couple of minutes.'}
        </EmptyState>
      ) : (
        <div className="repair-list">
          {visible.map((c) => (
            <RepairCard
              key={c.jobCode}
              repair={c.latest}
              visitCount={c.visits.length}
              unread={unread[c.jobCode] ?? 0}
              showTracker
              onClick={() => setSelected(c.latest)}
            />
          ))}
        </div>
      )}

      {selected && (
        <RepairDetailModal
          repair={selected}
          mode="visitor"
          profile={profile}
          onClose={() => {
            setSelected(null)
            setUnread((u) => ({ ...u, [selected.job_code]: 0 }))
          }}
          onUpdated={(u) => {
            setRepairs((rs) => rs.map((r) => (r.id === u.id ? u : r)))
            setSelected(u)
          }}
        />
      )}
    </div>
  )
}
