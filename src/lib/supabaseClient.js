import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check your .env file.')
}

export const supabase = createClient(url, key)

// Booking photos are stored as full URLs, so they carry whatever address the
// site had on the day of booking (localhost, an old tunnel, the old cloud
// project). Re-point them at the current address so they keep loading after
// set-public-url.sh changes it.
const STORAGE_PATH = '/storage/v1/object/public/'
export function photoUrl(stored) {
  const i = stored?.indexOf(STORAGE_PATH) ?? -1
  return i === -1 ? stored : url.replace(/\/$/, '') + stored.slice(i)
}
