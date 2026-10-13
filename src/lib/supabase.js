import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Validates whether Supabase environment variables are present and configured with
 * valid (non-placeholder) credentials.
 *
 * Supports:
 * - Hosted Supabase URLs (https://<project>.supabase.co)
 * - Local / self-hosted Supabase URLs (http://localhost:*, http://127.0.0.1:*)
 * - Legacy JWT anon keys (eyJ...)
 * - Supabase publishable keys (sb_publishable_..., sb_...)
 *
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

  const urlValid =
    Boolean(url) &&
    !url.includes('placeholder') &&
    !url.includes('your-project-id') &&
    (url.startsWith('https://') ||
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1'))

  const keyValid =
    Boolean(key) &&
    key.length > 20 &&
    !key.includes('placeholder') &&
    !key.includes('your-anon-public-key') &&
    (key.startsWith('eyJ') || key.startsWith('sb_') || key.startsWith('sbp_'))

  return Boolean(urlValid && keyValid)
}

if (!isSupabaseConfigured()) {
  console.warn(
    '[supabase] Missing or invalid environment variables. ' +
    'Copy .env.example to .env.local and add your Supabase credentials.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

