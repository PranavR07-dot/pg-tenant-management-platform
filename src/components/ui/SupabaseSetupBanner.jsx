import { AlertTriangle, ExternalLink } from 'lucide-react'

/**
 * Shown on auth pages when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * are missing or still set to placeholder values.
 */
export default function SupabaseSetupBanner({ message }) {
  return (
    <div
      role="alert"
      className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3"
    >
      <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">Supabase not configured</p>
        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
          {message || 'Add your Supabase credentials to frontend/.env.local to enable authentication.'}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
          >
            Open Supabase Dashboard
            <ExternalLink size={11} />
          </a>
          <span className="text-xs text-amber-600">
            Settings → API → copy URL and anon key → paste into .env.local
          </span>
        </div>
      </div>
    </div>
  )
}
