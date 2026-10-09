import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import AuthCallbackPage from '@/pages/auth/AuthCallbackPage'
import UnauthorizedPage from '@/pages/auth/UnauthorizedPage'

// App pages
import DashboardPage from '@/pages/dashboard/DashboardPage'
import RoomsPage from '@/pages/rooms/RoomsPage'
import TenantsPage from '@/pages/tenants/TenantsPage'
import PaymentsPage from '@/pages/payments/PaymentsPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Public routes ─────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Auth callback — Supabase redirects here after email confirmation */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* Also handle the legacy hash-based redirect path */}
        <Route path="/auth/confirm" element={<AuthCallbackPage />} />
        {/* Password reset redirect */}
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* ── Protected routes (any authenticated user) ─────────── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout><Outlet /></AppLayout>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/payments" element={<PaymentsPage />} />

            {/* Owner-only routes */}
            <Route element={<ProtectedRoute requiredRole="pg_owner" />}>
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/tenants" element={<TenantsPage />} />
            </Route>
          </Route>
        </Route>

        {/* ── Redirects ─────────────────────────────────────────── */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
