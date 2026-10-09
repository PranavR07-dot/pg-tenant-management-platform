import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** @typedef {'pg_owner' | 'tenant'} UserRole */

/**
 * @typedef {Object} AuthContextValue
 * @property {import('@supabase/supabase-js').User | null} user
 * @property {import('@supabase/supabase-js').Session | null} session
 * @property {{ id: string, full_name: string, phone: string|null, role: UserRole, avatar_url: string|null } | null} profile
 * @property {boolean} loading      - true while initial session + profile are being resolved
 * @property {boolean} profileLoading - true while profile is being fetched after login
 * @property {string | null} configError - set when Supabase env vars are missing/invalid
 * @property {(args: {email: string, password: string}) => Promise<{error: import('@supabase/supabase-js').AuthError | null}>} signIn
 * @property {(args: {email: string, password: string, fullName: string}) => Promise<{error: import('@supabase/supabase-js').AuthError | null}>} signUp
 * @property {() => Promise<void>} signOut
 * @property {(email: string) => Promise<{error: import('@supabase/supabase-js').AuthError | null}>} resetPassword
 * @property {(updates: {full_name?: string, phone?: string}) => Promise<{error: Error | null}>} updateProfile
 */

const AuthContext = createContext(/** @type {AuthContextValue | null} */ (null))

// Detect if Supabase is configured with real (non-placeholder) credentials
function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return (
    url.startsWith('https://') &&
    !url.includes('placeholder') &&
    key.length > 20 &&
    !key.includes('placeholder')
  )
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [configError, setConfigError] = useState(null)

  // Fetch profile from public.profiles table
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, avatar_url, created_at')
        .eq('id', userId)
        .single()

      if (error) {
        // Profile might not exist yet (race with trigger) — not fatal
        console.warn('[AuthContext] Could not fetch profile:', error.message)
        setProfile(null)
      } else {
        setProfile(data)
      }
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    // Check Supabase configuration before attempting any calls
    if (!isSupabaseConfigured()) {
      setConfigError(
        'Supabase is not configured. ' +
        'Copy frontend/.env.example to frontend/.env.local and add your project credentials.'
      )
      setLoading(false)
      return
    }

    // Get initial session from local storage (instant — no network call)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[AuthContext] getSession error:', error.message)
      }
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Subscribe to auth state changes (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            await fetchProfile(session.user.id)
          }
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null)
        }

        // Ensure loading is cleared on any auth event
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  // Sign in with email + password
  const signIn = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }, [])

  // Register a new account (role is set server-side by trigger, not here)
  const signUp = useCallback(async ({ email, password, fullName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // Redirect to /auth/callback after email confirmation
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { data, error }
  }, [])

  // Sign out and clear state
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  // Send password reset email
  const resetPassword = useCallback(async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { data, error }
  }, [])

  // Update profile fields (name, phone) — role change blocked server-side by trigger
  const updateProfile = useCallback(async (updates) => {
    if (!user) return { error: new Error('Not authenticated') }

    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (!error) {
      setProfile((prev) => prev ? { ...prev, ...updates } : prev)
    }

    return { error }
  }, [user])

  const value = {
    user,
    session,
    profile,
    loading,
    profileLoading,
    configError,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/** Convenience hook — returns true if the current user is a PG owner */
export function useIsOwner() {
  const { profile } = useAuth()
  return profile?.role === 'pg_owner'
}

/** Convenience hook — returns true if the current user is a tenant */
export function useIsTenant() {
  const { profile } = useAuth()
  return profile?.role === 'tenant'
}
