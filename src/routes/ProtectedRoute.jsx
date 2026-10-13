import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/**
 * ProtectedRoute — guards all authenticated routes.
 *
 * Props:
 *  - requiredRole: 'pg_owner' | 'tenant' | undefined (any authenticated user)
 *
 * Behaviour:
 *  - While auth is loading → show full-screen spinner
 *  - Not authenticated → redirect to /login, preserving intended destination
 *  - Authenticated but wrong role → redirect to /unauthorized
 *  - Authenticated + correct role → render <Outlet />
 */
export default function ProtectedRoute({ requiredRole }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Show spinner while session is being resolved
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading session...</p>
        </div>
      </div>
    )
  }

  // Not logged in → redirect to manager login, saving the intended URL
  if (!user) {
    return <Navigate to="/manager/login" state={{ from: location }} replace />
  }

  // Role check (only if a specific role is required and profile is loaded)
  if (requiredRole && profile && profile.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
