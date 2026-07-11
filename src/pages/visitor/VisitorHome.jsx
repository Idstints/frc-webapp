import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { STATUS_META } from '../../lib/constants'
import { EmptyState, Spinner, FilterIcon, SearchIcon, IconWrench, IconHeart, IconClipboard } from '../../components/ui'
import RepairCard from '../../components/RepairCard'
import RepairDetailModal from '../../components/RepairDetailModal'

export default function VisitorHome() {
  const { profile } = useAuth()
  const [repairs, setRepairs] = useState(null)
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
    return () => { live = false }
  }, [])

  const visible = useMemo(() => {
    if (!repairs) return []
    let list = [...repairs]
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((r) => r.item.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
    }
    if (sort === 'newest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sort === 'oldest') list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sort === 'name') list.sort((a, b) => a.item.localeCompare(b.item))
    return list
  }, [repairs, search, statusFilter, sort])

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
        {repairs && <span className="count">{repairs.length} booking{repairs.length === 1 ? '' : 's'}</span>}
      </div>

      <div className="filterbar">
        <span className="f-ic"><FilterIcon /></span>
        <span className="f-ic" style={{ paddingLeft: 0 }}><SearchIcon /></span>
        <input className="input search" placeholder="Search by item name" value={search} onChange={(e) => setSearch(e.target.value)} />
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
        <EmptyState icon={<IconClipboard />} title={repairs.length ? 'Nothing matches those filters' : 'No repairs booked yet'}>
          {repairs.length ? 'Try clearing the search or status filter.' : 'Book your first repair above — it only takes a couple of minutes.'}
        </EmptyState>
      ) : (
        <div className="repair-list">
          {visible.map((r) => (
            <RepairCard key={r.id} repair={r} showTracker onClick={() => setSelected(r)} />
          ))}
        </div>
      )}

      {selected && (
        <RepairDetailModal
          repair={selected}
          mode="visitor"
          onClose={() => setSelected(null)}
          onUpdated={(u) => {
            setRepairs((rs) => rs.map((r) => (r.id === u.id ? u : r)))
            setSelected(u)
          }}
        />
      )}
    </div>
  )
}
