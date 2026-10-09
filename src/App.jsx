import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import RoomsPage from '@/pages/rooms/RoomsPage'
import TenantsPage from '@/pages/tenants/TenantsPage'
import PaymentsPage from '@/pages/payments/PaymentsPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes wrapped in sidebar layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout><Outlet /></AppLayout>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
          </Route>
        </Route>

        {/* Root and catch-all redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
