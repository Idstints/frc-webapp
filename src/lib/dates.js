// Footscray Repair Cafe runs on the second Saturday of each month.

function secondSaturdayOf(year, month) {
  const first = new Date(year, month, 1)
  const firstSaturdayDate = 1 + ((6 - first.getDay() + 7) % 7)
  return new Date(year, month, firstSaturdayDate + 7)
}

export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// The next `count` session dates (ISO strings), starting today or later.
export function upcomingSessionDates(count = 6) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out = []
  let y = today.getFullYear()
  let m = today.getMonth()
  while (out.length < count) {
    const sat = secondSaturdayOf(y, m)
    if (sat >= today) out.push(toISODate(sat))
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
  return out
}

export function formatSessionDate(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatShortDate(isoOrTimestamp) {
  if (!isoOrTimestamp) return ''
  const d = new Date(isoOrTimestamp)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function monthKey(dateLike) {
  const d = new Date(dateLike)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthKey(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
}
