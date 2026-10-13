import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Building2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import SupabaseSetupBanner from '@/components/ui/SupabaseSetupBanner'

export default function LoginPage() {
  const { user, signIn, loading, configError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirect back to the page the user tried to access (or manager dashboard)
  const from = location.state?.from?.pathname || '/manager/dashboard'
  // Success message from password reset or email confirmation
  const successMessage = location.state?.message || ''


  // Already logged in → redirect
  if (!loading && user) return <Navigate to={from} replace />

  // --- Validation ---
  function validate() {
    const errs = {}
    if (!form.email.trim()) errs.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email.'
    if (!form.password) errs.password = 'Password is required.'
    return errs
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined }))
    setAuthError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSubmitting(true)
    setAuthError('')

    const { error } = await signIn({ email: form.email, password: form.password })

    if (error) {
      // Humanise common Supabase auth error messages
      if (error.message.includes('Invalid login credentials')) {
        setAuthError('Incorrect email or password. Please try again.')
      } else if (error.message.includes('Email not confirmed')) {
        setAuthError('Please confirm your email address before signing in. Check your inbox.')
      } else {
        setAuthError(error.message)
      }
      setSubmitting(false)
    } else {
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Back to public site */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
            ← Browse PGs publicly
          </Link>
        </div>

        {/* Supabase not configured banner */}
        {configError && <SupabaseSetupBanner message={configError} />}

        {/* Success message (e.g. from password reset) */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 text-center">
            {successMessage}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3">
              <Building2 size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">PG Manager</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to your manager account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="email"
              name="email"
              type="email"
              label="Email address"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              required
              autoComplete="email"
              disabled={submitting || !!configError}
            />

            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                required
                autoComplete="current-password"
                disabled={submitting || !!configError}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-indigo-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

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
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-indigo-600 hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
