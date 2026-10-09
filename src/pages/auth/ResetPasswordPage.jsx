import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

/**
 * ResetPasswordPage
 *
 * Supabase redirects here after the user clicks the password-reset link in their email.
 * The URL contains a recovery token that Supabase auto-exchanges for a session.
 * We simply present a new-password form and call supabase.auth.updateUser().
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const errs = {}
    if (!form.password) errs.password = 'New password is required.'
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.'
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Include at least one uppercase letter.'
    else if (!/[0-9]/.test(form.password)) errs.password = 'Include at least one number.'
    if (!form.confirmPassword) errs.confirmPassword = 'Please confirm your new password.'
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.'
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

    // Supabase has already established a recovery session from the URL hash token
    const { error } = await supabase.auth.updateUser({ password: form.password })

    if (error) {
      setAuthError(error.message)
      setSubmitting(false)
    } else {
      // Sign out the recovery session and redirect to login with a success message
      await supabase.auth.signOut()
      navigate('/login', { state: { message: 'Password updated successfully. Please sign in.' } })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3">
              <Building2 size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
            <p className="text-sm text-gray-500 mt-1">Choose a strong password for your account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                label="New password"
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                required
                autoComplete="new-password"
                disabled={submitting}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm new password"
              placeholder="Re-enter new password"
              value={form.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              required
              autoComplete="new-password"
              disabled={submitting}
            />

            {authError && (
              <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {authError}
              </div>
            )}

            <Button type="submit" className="w-full" loading={submitting} size="lg">
              Update password
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
