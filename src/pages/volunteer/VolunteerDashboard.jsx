import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { DEFAULT_CAFE_ID } from '../../lib/constants'
import CafeSelector from '../../components/CafeSelector'
import { Splash } from '../../components/ui'
import BrowseTab from './BrowseTab'
import MyBenchTab from './MyBenchTab'
import InsightsTab from './InsightsTab'

const TABS = [
  { key: 'browse', label: 'Repair board' },
  { key: 'bench', label: 'My assignments' },
  { key: 'insights', label: 'Reports' },
]

export default function VolunteerDashboard() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('browse')
  const [cafes, setCafes] = useState([])
  const [cafeId, setCafeId] = useState(DEFAULT_CAFE_ID)
  const [repairs, setRepairs] = useState(null)
  const [people, setPeople] = useState(null)
  const [unread, setUnread] = useState({}) // job_code → messages waiting on us

  const loadPeople = async () => {
    const { data, error } = await supabase
      .from('profiles').select('*')
      .eq('is_active', true)
      .order('full_name')
    if (error) console.error(error)
    setPeople(data ?? [])
  }

  const loadUnread = async () => {
    const { data, error } = await supabase
      .from('repair_messages').select('job_code')
      .eq('sender_kind', 'visitor')
      .is('read_by_team_at', null)
    if (error) {
      console.error(error)
      return
    }
    const counts = {}
    for (const m of data ?? []) counts[m.job_code] = (counts[m.job_code] ?? 0) + 1
    setUnread(counts)
  }

  useEffect(() => {
    let live = true
    const load = async () => {
      const [cafeRes, repairRes] = await Promise.all([
        supabase.from('cafes').select('*').order('created_at'),
        supabase.from('repair_requests').select('*').order('created_at', { ascending: false }),
      ])
      if (!live) return
      setCafes(cafeRes.data ?? [])
      setRepairs(repairRes.data ?? [])
      for (const res of [cafeRes, repairRes]) if (res.error) console.error(res.error)
      await Promise.all([loadPeople(), loadUnread()])
    }
    load()
    return () => { live = false }
  }, [])

  if (repairs === null || people === null) return <Splash />

  const volunteers = people.filter((p) => p.role === 'volunteer')
  const team = volunteers.filter((v) => v.approved)
  const pendingTeam = volunteers.filter((v) => !v.approved)
  const visitors = people.filter((p) => p.role === 'visitor')
  const cafeRepairs = repairs.filter((r) => !r.cafe_id || r.cafe_id === cafeId)
  const updateRepair = (updated) =>
    setRepairs((rs) => rs.map((r) => (r.id === updated.id ? updated : r)))

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <CafeSelector cafes={cafes} selected={cafeId} onSelect={setCafeId} />
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Sessions run on the second Saturday of each month, 11am – 1.30pm
        </span>
      </div>

      <div className="tabbar" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <BrowseTab repairs={cafeRepairs} volunteers={team} pendingVolunteers={pendingTeam}
          visitors={visitors} unread={unread} profile={profile}
          onRepairUpdated={updateRepair} onTeamChanged={loadPeople} onThreadRead={loadUnread} />
      )}
      {tab === 'bench' && (
        <MyBenchTab repairs={cafeRepairs} volunteers={team} profile={profile} onRepairUpdated={updateRepair} />
      )}
      {tab === 'insights' && <InsightsTab repairs={cafeRepairs} volunteers={team} />}
    </div>
  )
}
