import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CreditCard,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { fetchDashboardStats } from '@/services/dashboardService'
import { formatCurrency } from '@/utils/helpers'

// ─── Stat card component ────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, colorClass, loading, subLabel }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        {loading ? (
          <div className="h-8 w-20 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <>
            <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
            {subLabel && <p className="text-xs text-gray-400 mt-0.5">{subLabel}</p>}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Missing tables banner ───────────────────────────────────────────────────

function MissingTablesBanner({ missingTables }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-3">
      <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">Database tables not set up yet</p>
        <p className="text-sm text-amber-700 mt-1">
          The following tables are missing from your Supabase project:
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {missingTables.map((t) => (
            <li
              key={t}
              className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-xs"
            >
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-start gap-2">
          <p className="text-xs text-amber-700 leading-relaxed">
            Run{' '}
            <code className="bg-amber-100 px-1 rounded font-mono">
              supabase/migrations/003_create_core_tables.sql
            </code>{' '}
            in the Supabase SQL Editor to create them.
          </p>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-xs text-amber-700 font-medium hover:underline"
          >
            Dashboard <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Error banner ───────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex gap-3 items-start">
      <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-700">Failed to load dashboard data</p>
        <p className="text-xs text-red-600 mt-1 font-mono break-all">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-medium"
      >
        <RefreshCw size={13} /> Retry
      </button>
    </div>
  )
}

// ─── Main Dashboard Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const isMountedRef = useRef(true)

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tablesMissing, setTablesMissing] = useState(false)
  const [missingTables, setMissingTables] = useState([])
  const [error, setError] = useState(null)

  const handleFetchResult = useCallback((result) => {
    if (!isMountedRef.current) return
    if (result.tablesMissing) {
      setTablesMissing(true)
      setMissingTables(result.missingTables)
      setError(null)
      setStats(null)
    } else if (result.error) {
      setError(result.error)
      setTablesMissing(false)
      setMissingTables([])
      setStats(null)
    } else {
      setTablesMissing(false)
      setMissingTables([])
      setError(null)
      setStats(result.data)
    }
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDashboardStats()
    handleFetchResult(result)
  }, [handleFetchResult])

  useEffect(() => {
    isMountedRef.current = true
    fetchDashboardStats().then(handleFetchResult)
    return () => {
      isMountedRef.current = false
    }
  }, [handleFetchResult])


  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'there'

  const statCards = stats
    ? [
        {
          label: 'Total Rooms',
          value: stats.totalRooms,
          icon: Building2,
          colorClass: 'bg-indigo-50 text-indigo-600',
          subLabel: `${stats.vacantRooms} vacant`,
        },
        {
          label: 'Active Tenants',
          value: stats.activeTenants,
          icon: Users,
          colorClass: 'bg-emerald-50 text-emerald-600',
          subLabel: null,
        },
        {
          label: 'Monthly Revenue',
          value: formatCurrency(stats.monthlyRevenue),
          icon: CreditCard,
          colorClass: 'bg-blue-50 text-blue-600',
          subLabel: 'occupied rooms',
        },
        {
          label: 'Occupancy Rate',
          value: `${stats.occupancyRate}%`,
          icon: TrendingUp,
          colorClass: 'bg-amber-50 text-amber-600',
          subLabel: `${stats.occupiedRooms} of ${stats.totalRooms} rooms`,
        },
      ]
    : [
        { label: 'Total Rooms', value: '—', icon: Building2, colorClass: 'bg-indigo-50 text-indigo-600' },
        { label: 'Active Tenants', value: '—', icon: Users, colorClass: 'bg-emerald-50 text-emerald-600' },
        { label: 'Monthly Revenue', value: '—', icon: CreditCard, colorClass: 'bg-blue-50 text-blue-600' },
        { label: 'Occupancy Rate', value: '—', icon: TrendingUp, colorClass: 'bg-amber-50 text-amber-600' },
      ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hello, {displayName} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of your PG properties
            {stats && (
              <span className="ml-1">
                · {stats.totalProperties} propert{stats.totalProperties === 1 ? 'y' : 'ies'}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
          title="Refresh dashboard"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </div>

      {/* Alerts — shown only when relevant */}
      {!loading && tablesMissing && (
        <MissingTablesBanner missingTables={missingTables} />
      )}

      {!loading && error && (
        <ErrorBanner message={error} onRetry={loadStats} />
      )}

      {/* Pending payments alert */}
      {!loading && stats && (stats.pendingPayments > 0 || stats.overduePayments > 0) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3 items-center">
          <AlertTriangle size={18} className="text-orange-400 shrink-0" />
          <p className="text-sm text-orange-700">
            {stats.overduePayments > 0 && (
              <strong>{stats.overduePayments} overdue payment{stats.overduePayments > 1 ? 's' : ''}</strong>
            )}
            {stats.overduePayments > 0 && stats.pendingPayments > 0 && ' · '}
            {stats.pendingPayments > 0 && (
              <>{stats.pendingPayments} pending this month</>
            )}
          </p>
        </div>
      )}

      {/* Empty state — tables exist but no data yet */}
      {!loading && stats && stats.totalRooms === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
          <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium mb-1">No rooms added yet</p>
          <p className="text-gray-400 text-sm">
            Go to <strong>Rooms</strong> to add your first property and rooms.
          </p>
        </div>
      )}

      {/* Loading skeleton for main content area */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-48" />
            <div className="h-4 bg-gray-100 rounded w-36" />
            <div className="h-4 bg-gray-100 rounded w-56" />
          </div>
        </div>
      )}
    </div>
  )
}
