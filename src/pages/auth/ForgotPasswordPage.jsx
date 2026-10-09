import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import SupabaseSetupBanner from '@/components/ui/SupabaseSetupBanner'

export default function ForgotPasswordPage() {
  const { resetPassword, configError } = useAuth()

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [authError, setAuthError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    if (!email.trim()) return 'Email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setEmailError(err); return }

    setSubmitting(true)
    setAuthError('')

    const { error } = await resetPassword(email.trim())

    if (error) {
      setAuthError(error.message)
      setSubmitting(false)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-sm text-gray-500 mb-1">
            If an account exists for <strong>{email}</strong>, we sent a password reset link.
          </p>
          <p className="text-xs text-gray-400 mt-3 mb-6">
            The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
          </p>
          <Link to="/login" className="text-indigo-600 hover:underline text-sm font-medium">
            ← Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {configError && <SupabaseSetupBanner message={configError} />}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3">
              <Building2 size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
            <p className="text-sm text-gray-500 mt-1 text-center">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="email"
              name="email"
              type="email"
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(''); setAuthError('') }}
              error={emailError}
              required
              autoComplete="email"
              disabled={submitting || !!configError}
            />

            {authError && (
              <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={submitting}
              size="lg"
              disabled={!!configError}
            >
              Send reset link
            </Button>
          </form>

          <div className="mt-6 flex justify-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
