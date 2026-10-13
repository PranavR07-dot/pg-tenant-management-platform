import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'

// Public pages (no auth required)
import HomePage from '@/pages/public/HomePage'
import PGListingsPage from '@/pages/public/PGListingsPage'
import PGDetailPage from '@/pages/public/PGDetailPage'

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import AuthCallbackPage from '@/pages/auth/AuthCallbackPage'
import UnauthorizedPage from '@/pages/auth/UnauthorizedPage'

// App pages (authenticated)
import DashboardPage from '@/pages/dashboard/DashboardPage'
import RoomsPage from '@/pages/rooms/RoomsPage'
import TenantsPage from '@/pages/tenants/TenantsPage'
import PaymentsPage from '@/pages/payments/PaymentsPage'
import ReportsPage from '@/pages/reports/ReportsPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Public routes (no auth required) ────────────────────────── */}
        <Route path="/" element={<HomePage />} />
        <Route path="/pgs" element={<PGListingsPage />} />
        <Route path="/pgs/:id" element={<PGDetailPage />} />

        {/* ── Auth routes ───────────────────────────────────────────────── */}
        {/* Keep /login for Supabase email links and existing bookmarks */}
        <Route path="/login" element={<LoginPage />} />
        {/* /manager/login is the canonical manager entry point */}
        <Route path="/manager/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Auth callbacks — Supabase redirects here after email confirmation */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/confirm" element={<AuthCallbackPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* ── Protected routes (any authenticated user) ─────────────────── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout><Outlet /></AppLayout>}>
            {/* /manager/dashboard → manager's existing dashboard */}
            <Route path="/manager/dashboard" element={<DashboardPage />} />
            {/* Keep /dashboard for existing bookmarks and email links */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/payments" element={<PaymentsPage />} />

            {/* Owner-only routes */}
            <Route element={<ProtectedRoute requiredRole="pg_owner" />}>
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/tenants" element={<TenantsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>
          </Route>
        </Route>

        {/* ── Fallback redirects ─────────────────────────────────────────── */}
        {/* Unknown routes → public homepage (not login) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
