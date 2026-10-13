import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

/**
 * AuthCallbackPage
 *
 * Supabase redirects here after:
 *  - Email confirmation (signup)
 *  - OAuth flows (if added later)
 *
 * The URL contains a token/code fragment. @supabase/supabase-js v2 automatically
 * exchanges PKCE codes and hash fragments. We just wait for the session to appear
 * via onAuthStateChange and then redirect appropriately.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const handledRef = useRef(false)

  useEffect(() => {
    // Handle the code exchange from the URL (PKCE flow for email confirmation)
    const handleCallback = async () => {
      if (handledRef.current) return
      handledRef.current = true

      const { data, error } = await supabase.auth.getSession()

      if (error || !data.session) {
        // Token may be in the URL hash — Supabase JS handles this automatically
        // on the next auth state change. Give it a moment.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          subscription.unsubscribe()
          if (session) {
            navigate('/manager/dashboard', { replace: true })
          } else {
            navigate('/manager/login', {
              replace: true,
              state: { message: 'Email confirmation failed. Please try signing in.' }
            })
          }
        })

        // Safety timeout — if no event fires in 5s, redirect to login
        setTimeout(() => {
          subscription.unsubscribe()
          navigate('/manager/login', { replace: true })
        }, 5000)
      } else {
        // Session already exists — go to dashboard
        navigate('/manager/dashboard', { replace: true })
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Confirming your account...</p>
      </div>
    </div>
  )
}
