import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }
    setProfileLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfileLoading(false)
    if (error) {
      console.error('Failed to load profile', error)
      return null
    }
    setProfile(data)
    return data
  }, [])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession) await loadProfile(newSession.user.id)
      else setProfile(null)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = async ({ email, password, fullName, role }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    })
    if (error) throw error
    return data
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signInWithGoogle = async (role) => {
    // Role is remembered locally so we can apply it after the OAuth redirect.
    if (role) localStorage.setItem('frc-pending-role', role)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  // ---- ticket-number access ----------------------------------------------
  // Visitors never pick a password or confirm an email. The visitor-access
  // function checks their ticket, then hands back a one-time token we swap for
  // an ordinary session — so every row-level security rule still applies.
  const callVisitorAccess = async (body) => {
    const { data, error } = await supabase.functions.invoke('visitor-access', { body })
    if (error) {
      let message = 'Something went wrong. Please try again.'
      try {
        message = (await error.context.json()).error ?? message
      } catch { /* network-level failure — keep the generic message */ }
      throw new Error(message)
    }
    return data
  }

  const exchange = async (tokenHash) => {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
    if (error) throw error
    return data
  }

  const signInWithTicket = async (code) => {
    const { token_hash } = await callVisitorAccess({ action: 'signin', code })
    return exchange(token_hash)
  }

  // Creates the hidden account behind a first booking and signs them straight in.
  const registerVisitor = async (details) => {
    const { token_hash, person_code } = await callVisitorAccess({ action: 'register', ...details })
    const data = await exchange(token_hash)
    return { personCode: person_code, user: data.user }
  }

  // Do we already hold a record for these details? Answers yes or no and how
  // many repairs are on it — never a name, ticket or contact detail.
  const checkExistingVisitor = (details) =>
    callVisitorAccess({ action: 'check-existing', ...details })

  // Opens that record. Two of name, phone and email have to agree.
  const claimExistingVisitor = async (details) => {
    const { token_hash, person_code } = await callVisitorAccess({ action: 'claim-existing', ...details })
    const data = await exchange(token_hash)
    return { personCode: person_code, user: data.user }
  }

  const updateProfile = async (patch) => {
    if (!session) throw new Error('Not signed in')
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, ...patch })
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithTicket,
    registerVisitor,
    checkExistingVisitor,
    claimExistingVisitor,
    signOut,
    updateProfile,
    refreshProfile: () => loadProfile(session?.user?.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
