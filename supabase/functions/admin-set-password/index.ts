// A coordinator sets a new password for a volunteer.
//
// Passwords are stored only as a hash, so nobody can look one up — not even
// in Studio. When a volunteer is locked out, a coordinator sets a new one here
// and tells them what it is. Every reset is written to password_resets.
//
// Needs a signed-in coordinator's JWT (verify_jwt = true in config.toml).
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

// Matches the minimum on the sign-in form.
const MIN_LENGTH = 8

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller, error: callerErr } = await admin.auth.getUser(jwt)
    if (callerErr || !caller.user) return json({ error: 'Please sign in again.' }, 401)

    const { data: me } = await admin
      .from('profiles')
      .select('role, approved, is_coordinator')
      .eq('id', caller.user.id)
      .maybeSingle()
    if (!me || me.role !== 'volunteer' || !me.approved || !me.is_coordinator) {
      return json({ error: 'Only coordinators can set a password for someone else.' }, 403)
    }

    const payload = await req.json()
    const userId = String(payload.user_id ?? '')
    const password = String(payload.password ?? '')
    if (password.length < MIN_LENGTH) {
      return json({ error: `The password needs at least ${MIN_LENGTH} characters.` }, 400)
    }

    // Visitors sign in with a ticket number and never use a password.
    const { data: target } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    if (!target || target.role !== 'volunteer') {
      return json({ error: 'Passwords can only be set for repair team accounts.' }, 400)
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { password })
    if (updateErr) {
      console.error('updateUserById failed', updateErr)
      return json({ error: 'The password could not be changed. Please try again.' }, 500)
    }

    const { error: logErr } = await admin
      .from('password_resets')
      .insert({ actor_id: caller.user.id, target_id: userId })
    if (logErr) console.error('password_resets insert failed', logErr)

    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
