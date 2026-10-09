import { supabase } from '@/lib/supabase'

/**
 * Fetches a user's profile by their auth user ID.
 * @param {string} userId
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, avatar_url, created_at, updated_at')
    .eq('id', userId)
    .single()
  return { data, error }
}

/**
 * Updates the current user's own profile (name and phone only).
 * Role changes are blocked by a database trigger.
 * @param {string} userId
 * @param {{ full_name?: string, phone?: string }} updates
 */
export async function updateProfile(userId, updates) {
  // Guard: never allow role to be passed through here
  const { role: _stripped, ...safeUpdates } = updates
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

/**
 * Checks whether a profile row exists for the given user ID.
 * Useful after signup to detect if the trigger has run.
 * @param {string} userId
 */
export async function profileExists(userId) {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('id', userId)
  return { exists: (count ?? 0) > 0, error }
}
