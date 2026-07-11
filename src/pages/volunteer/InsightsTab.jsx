import { useMemo } from 'react'
import { STATUS_META, SUCCESS_OUTCOMES, OUTCOME_LABELS } from '../../lib/constants'
import { monthKey, formatMonthKey } from '../../lib/dates'
import { StatTile, HBarChart, DonutChart, LineChart, RankList } from '../../components/charts/Charts'

// Tab 3 — reporting & analytics: what got repaired, how often it worked,
// and what people bring in most (the RepairMonitor wrap-up view).
export default function InsightsTab({ repairs, volunteers }) {
  const stats = useMemo(() => {
    const real = repairs.filter((r) => r.status !== 'cancelled')
    const completed = real.filter((r) => r.status === 'completed')
    const succeeded = completed.filter((r) => SUCCESS_OUTCOMES.includes(r.outcome))
    const fixRate = completed.length ? Math.round((succeeded.length / completed.length) * 100) : null

    const now = new Date()
    const thisMonth = real.filter((r) => {
      const d = new Date(r.session_date ?? r.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const queue = real.filter((r) => !['completed'].includes(r.status))

    // repairs per month, last 12 months (by session date when set)
    const byMonth = new Map()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      byMonth.set(monthKey(d), 0)
    }
    for (const r of real) {
      const k = monthKey(r.session_date ?? r.created_at)
      if (byMonth.has(k)) byMonth.set(k, byMonth.get(k) + 1)
    }
    const monthly = [...byMonth.entries()].map(([k, v]) => ({ label: formatMonthKey(k), value: v }))

    // category counts (top 8, rest folded into Other)
    const catCount = new Map()
    for (const r of real) catCount.set(r.category, (catCount.get(r.category) ?? 0) + 1)
    const cats = [...catCount.entries()].sort((a, b) => b[1] - a[1])
    const topCats = cats.slice(0, 8).map(([label, value]) => ({ label, value }))
    const rest = cats.slice(8).reduce((s, [, v]) => s + v, 0)
    if (rest > 0) topCats.push({ label: 'Other', value: rest })

    // fix rate per category (needs at least one completed repair)
    const fixByCat = [...catCount.keys()]
      .map((cat) => {
        const done = completed.filter((r) => r.category === cat)
        if (!done.length) return null
        const ok = done.filter((r) => SUCCESS_OUTCOMES.includes(r.outcome)).length
        return { label: cat, value: Math.round((ok / done.length) * 100), extra: `${ok} of ${done.length} repairs` }
      })
      .filter(Boolean)
      .sort((a, b) => b.value - a.value)

    // most brought-in items (grouped loosely by name)
    const itemCount = new Map()
    for (const r of real) {
      const k = r.item.trim().toLowerCase()
      itemCount.set(k, (itemCount.get(k) ?? 0) + 1)
    }
    const topItems = [...itemCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([label, value]) => ({ label, value }))

    // status + outcome mixes
    const statusMix = Object.keys(STATUS_META)
      .filter((s) => s !== 'cancelled')
      .map((s) => ({
        label: STATUS_META[s].label,
        value: real.filter((r) => r.status === s).length,
        color: STATUS_META[s].chart,
      }))
    const outcomeMix = Object.entries(OUTCOME_LABELS).map(([k, label], i) => ({
      label,
      value: completed.filter((r) => r.outcome === k).length,
      color: ['#008300', '#eda100', '#2a78d6', '#e34948'][i],
    }))

    return { real, completed, succeeded, fixRate, thisMonth, queue, monthly, topCats, fixByCat, topItems, statusMix, outcomeMix }
  }, [repairs])

  const exportCsv = () => {
    const cols = ['created_at', 'session_date', 'status', 'item', 'category', 'brand', 'visitor_name', 'assigned_repairer_name', 'outcome', 'diagnosis', 'work_done', 'repairer_notes']
    const esc = (v) => `"${String(v ?? '').replaceAll('"', '""').replaceAll(/\r?\n/g, ' ')}"`
    const rows = [cols.join(','), ...repairs.map((r) => cols.map((c) => esc(r[c])).join(','))]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `footscray-repair-cafe-repairs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="section-head" style={{ marginTop: 0 }}>
        <h2>How the cafe is going</h2>
        <span className="count">across {stats.real.length} booking{stats.real.length === 1 ? '' : 's'}</span>
        <span className="spacer" />
        <button className="btn btn-secondary btn-sm" onClick={exportCsv}>⭳ Export CSV</button>
      </div>

      <div className="stat-row">
        <StatTile label="Repairs booked" value={stats.real.length} note="all time" />
        <StatTile label="Repairs completed" value={stats.completed.length}
          note={stats.completed.length ? `${stats.succeeded.length} left better than they came` : 'none yet'} noteUp={stats.succeeded.length > 0} />
        <StatTile label="Fix rate" value={stats.fixRate === null ? '—' : `${stats.fixRate}%`}
          note="fixed, improved or advised" />
        <StatTile label="This month" value={stats.thisMonth.length} note="bookings" />
        <StatTile label="Repair team" value={volunteers.length} note="active volunteers" />
      </div>

      <div className="charts-grid">
        <div className="card chart-card wide">
          <h3>Repairs per month</h3>
          <div className="ch-sub">Bookings by session date, last 12 months</div>
          <LineChart data={stats.monthly} yLabel="repairs" />
        </div>

        <div className="card chart-card">
          <h3>Where things stand</h3>
          <div className="ch-sub">Every booking by current status</div>
          <DonutChart data={stats.statusMix} />
        </div>

        <div className="card chart-card">
          <h3>What people bring in</h3>
          <div className="ch-sub">Bookings by category</div>
          <HBarChart data={stats.topCats} color="#2a78d6" />
        </div>

        <div className="card chart-card">
          <h3>Fix rate by category</h3>
          <div className="ch-sub">Share of completed repairs that succeeded</div>
          <HBarChart data={stats.fixByCat} color="#008300" valueSuffix="%" maxBars={12} />
        </div>

        <div className="card chart-card">
          <h3>Most common items</h3>
          <div className="ch-sub">The things Footscray brings back to life</div>
          <RankList items={stats.topItems} suffix=" brought in" />
        </div>

        <div className="card chart-card wide">
          <h3>Repair outcomes</h3>
          <div className="ch-sub">How completed repairs ended up</div>
          <DonutChart data={stats.outcomeMix} />
        </div>
      </div>
    </div>
  )
}
