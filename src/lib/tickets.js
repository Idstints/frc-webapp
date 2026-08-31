// Ticket numbers look like 482137-KM.
//
// The six digits identify the visitor and never change; the two letters
// identify one item. Every visit for that item — the first repair and any
// follow-ups — shares the same ticket, so entering any ticket a person holds
// opens their whole record.
//
// I and O are never generated: they are too easily read as 1 and 0 on a
// handwritten card or over the phone.
const TICKET = /^[1-9]\d{5}[A-HJ-NP-Z]{2}$/

export function normaliseTicket(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
}

export function isTicket(raw) {
  return TICKET.test(normaliseTicket(raw))
}

// 482137KM → 482137-KM
export function formatTicket(code) {
  const c = normaliseTicket(code)
  return c.length === 8 ? `${c.slice(0, 6)}-${c.slice(6)}` : c
}

// The visitor half of a ticket number.
export function personCodeOf(code) {
  return normaliseTicket(code).slice(0, 6)
}

// Groups a flat list of repairs into cases — one per item, newest visit first.
// Every row sharing a job_code is the same item coming back for more work.
export function groupIntoCases(repairs) {
  const byCode = new Map()
  for (const r of repairs) {
    const list = byCode.get(r.job_code) ?? []
    list.push(r)
    byCode.set(r.job_code, list)
  }
  return [...byCode.entries()]
    .map(([jobCode, visits]) => {
      const ordered = [...visits].sort((a, b) => (b.visit_number ?? 1) - (a.visit_number ?? 1))
      return { jobCode, latest: ordered[0], visits: ordered, history: ordered.slice(1) }
    })
    .sort((a, b) => new Date(b.latest.created_at) - new Date(a.latest.created_at))
}
