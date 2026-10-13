import {
  BarChart3,
  Building2,
  CreditCard,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn, getInitials } from '@/utils/helpers'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rooms', label: 'Rooms', icon: Building2 },
  { to: '/tenants', label: 'Tenants', icon: Users },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
]

// ─── Extracted as a top-level component to prevent remount on sidebar state change ───
function NavItem({ to, label, icon: Icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  )
}

function SidebarContent({ user, profile, onSignOut, onNavigate }) {
  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'Owner'
  const displayEmail = user?.email ?? ''

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200 w-64">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg leading-none">PG Manager</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} onNavigate={onNavigate} />
        ))}

        {/* View Public Website Link in Sidebar */}
        <div className="pt-3 mt-2 border-t border-gray-100">
          <Link
            to="/"
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            <Globe size={18} className="text-emerald-600" />
            <span>View Public Website</span>
          </Link>
        </div>
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-gray-100">
        {/* Role badge */}
        {profile?.role && (
          <div className="px-3 mb-2">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              profile.role === 'pg_owner'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-emerald-100 text-emerald-700'
            )}>
              {profile.role === 'pg_owner' ? 'PG Owner' : 'Tenant'}
            </span>
          </div>
        )}

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold shrink-0">
            {getInitials(displayName || displayEmail)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{displayEmail}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

export default function AppLayout({ children }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleNavigate = () => setSidebarOpen(false)

  const sidebarProps = { user, profile, onSignOut: handleSignOut, onNavigate: handleNavigate }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar — always visible ≥ md */}
      <div className="hidden md:flex">
        <SidebarContent {...sidebarProps} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 flex h-full w-64">
            <SidebarContent {...sidebarProps} />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-2.5 flex items-center justify-between shrink-0">
          {/* Mobile menu trigger + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded-lg hover:bg-gray-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <span className="font-semibold text-gray-900 md:hidden">PG Manager</span>
          </div>

          {/* Quick link to public website */}
          <div className="flex items-center gap-3 ml-auto">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors border border-gray-200 hover:border-emerald-200"
              title="Go to public homepage"
            >
              <Globe size={14} className="text-emerald-600" />
              <span>View Public Website</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
