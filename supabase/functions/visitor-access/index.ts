// Ticket-number access for visitors.
//
// Visitors never create a password or confirm an email. Behind the scenes each
// one still has a real Supabase account — with a synthetic address they never
// see — so every existing row-level security policy keeps working unchanged.
//
//   check-existing: do we already hold a record for these details?
//   claim-existing: open that record when two of name/phone/email agree
//   register:       create that hidden account and return a session
//   signin:         swap a ticket number (482137KM) for a session
//
// Runs without a JWT, so every action is rate limited by IP.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Six digits then two letters, skipping I and O.
const TICKET = /^[1-9]\d{5}[A-HJ-NP-Z]{2}$/
const normalise = (raw: unknown) => String(raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')

const SIGNIN_WINDOW_MIN = 15
const SIGNIN_LIMIT = 8
const REGISTER_WINDOW_MIN = 60
const REGISTER_LIMIT = 5
// Knowing a name and a phone number reveals whether that person uses the cafe,
// so this is capped too — generously, since the booking form calls it whenever
// someone edits their details and presses continue again.
const LOOKUP_WINDOW_MIN = 60
const LOOKUP_LIMIT = 20
// Two matching details open a record, so this is an authentication path and is
// capped tightly — it is the only thing stopping someone working through a list
// of names and mobile numbers.
const CLAIM_WINDOW_MIN = 60
const CLAIM_LIMIT = 10

async function hashIp(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function recentAttempts(ipHash: string, kind: string, minutes: number, onlyFailed: boolean) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString()
  let q = admin
    .from('ticket_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('kind', kind)
    .gte('created_at', since)
  if (onlyFailed) q = q.eq('succeeded', false)
  const { count } = await q
  return count ?? 0
}

const record = (ipHash: string, kind: string, succeeded: boolean) =>
  admin.from('ticket_attempts').insert({ ip_hash: ipHash, kind, succeeded })

// Someone who already has a record. Needs two of name, phone and email to
// agree; the identity itself is never returned to the browser, only whether
// there was a match.
async function findMatch(payload: Record<string, string>) {
  const { data } = await admin.rpc('find_visitor_match', {
    p_name: payload.full_name ?? '',
    p_phone: payload.phone ?? '',
    p_email: payload.email ?? '',
  })
  return data?.[0] ?? null
}

// A one-time token the browser exchanges for a real session via verifyOtp.
async function issueSession(userId: string) {
  const { data: found, error } = await admin.auth.admin.getUserById(userId)
  if (error || !found.user?.email) throw new Error('That ticket is not linked to an account.')
  const { data, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: found.user.email,
  })
  if (linkErr) throw linkErr
  return data.properties.hashed_token
}

// Tells the booking form whether we already hold a record for these details, and
// nothing else — no name, no ticket, no contact details come back.
async function checkExisting(payload: Record<string, string>, ipHash: string) {
  if (await recentAttempts(ipHash, 'lookup', LOOKUP_WINDOW_MIN, false) >= LOOKUP_LIMIT) {
    return json({ match: false }) // quietly stop answering rather than confirm a limit was hit
  }
  await record(ipHash, 'lookup', true)

  const match = await findMatch(payload)
  if (!match) return json({ match: false })
  return json({ match: true, repairs: Number(match.repairs ?? 0) })
}

// Opens the matched record. Stamped on the profile so the team can tell which
// records were opened this way rather than with a ticket number.
async function claimExisting(payload: Record<string, string>, ipHash: string) {
  if (await recentAttempts(ipHash, 'claim', CLAIM_WINDOW_MIN, false) >= CLAIM_LIMIT) {
    return json({ error: 'Too many attempts from this connection. Please try again later, or ask us at the next session.' }, 429)
  }
  await record(ipHash, 'claim', true)

  const match = await findMatch(payload)
  if (!match) {
    return json({ error: 'We could not match those details to a record. Please continue and we will create a new one.' }, 404)
  }

  await admin
    .from('profiles')
    .update({ last_claimed_at: new Date().toISOString() })
    .eq('id', match.visitor_id)

  const { data: profile } = await admin
    .from('profiles')
    .select('person_code')
    .eq('id', match.visitor_id)
    .single()

  const token_hash = await issueSession(match.visitor_id)
  return json({ token_hash, person_code: profile?.person_code ?? null })
}

async function register(payload: Record<string, string>, ipHash: string) {
  if (await recentAttempts(ipHash, 'register', REGISTER_WINDOW_MIN, false) >= REGISTER_LIMIT) {
    return json({ error: 'Too many bookings have been started from this connection. Please try again later, or call the cafe.' }, 429)
  }

  const fullName = (payload.full_name ?? '').trim()
  const phone = (payload.phone ?? '').trim()
  if (!fullName) return json({ error: 'Please enter your name.' }, 400)
  if (!phone) return json({ error: 'Please enter a phone number.' }, 400)

  // They were offered the matching record and chose to book separately. Noted
  // for the welcome desk in case it was a mistake, but taken at face value.
  const duplicateOf = payload.not_duplicate ? await findMatch(payload) : null

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: `visitor-${crypto.randomUUID()}@tickets.footscrayrepaircafe.invalid`,
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'visitor' },
  })
  if (createErr || !created.user) {
    console.error('createUser failed', createErr)
    return json({ error: 'We could not set up your record. Please try again.' }, 500)
  }

  // handle_new_user() has already inserted the profile (and its person_code).
  const { error: profErr } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
      email: (payload.email ?? '').trim() || null,
      postcode: (payload.postcode ?? '').trim() || null,
      role: 'visitor',
      possible_duplicate_of: duplicateOf?.visitor_id ?? null,
    })
    .eq('id', created.user.id)
  if (profErr) console.error('profile update failed', profErr)

  const { data: profile } = await admin
    .from('profiles')
    .select('person_code')
    .eq('id', created.user.id)
    .single()

  const token_hash = await issueSession(created.user.id)
  await record(ipHash, 'register', true)
  return json({ token_hash, person_code: profile?.person_code ?? null })
}

async function signin(payload: Record<string, string>, ipHash: string) {
  if (await recentAttempts(ipHash, 'signin', SIGNIN_WINDOW_MIN, true) >= SIGNIN_LIMIT) {
    return json({ error: 'Too many incorrect ticket numbers. Please wait fifteen minutes, or call the cafe and we will look it up for you.' }, 429)
  }

  const code = normalise(payload.code)
  if (!TICKET.test(code)) {
    await record(ipHash, 'signin', false)
    return json({ error: 'A ticket number is six digits and two letters, like 482137-KM. Please check the card we gave you.' }, 400)
  }

  const { data: repair } = await admin
    .from('repair_requests')
    .select('visitor_id')
    .eq('job_code', code)
    .limit(1)
    .maybeSingle()

  if (!repair?.visitor_id) {
    await record(ipHash, 'signin', false)
    return json({ error: 'We could not find that ticket number. Please check it and try again, or call the cafe for help.' }, 404)
  }

  const token_hash = await issueSession(repair.visitor_id)
  await record(ipHash, 'signin', true)
  return json({ token_hash })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const payload = await req.json()
    const ipHash = await hashIp(req)
    switch (payload.action) {
      case 'check-existing':
        return await checkExisting(payload, ipHash)
      case 'claim-existing':
        return await claimExisting(payload, ipHash)
      case 'register':
        return await register(payload, ipHash)
      case 'signin':
        return await signin(payload, ipHash)
      default:
        return json({ error: 'Unknown action' }, 400)
    }
  } catch (err) {
    console.error(err)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
