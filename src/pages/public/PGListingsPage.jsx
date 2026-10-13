import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Filter,
  LayoutDashboard,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/utils/helpers'
import { fetchPublicCities, fetchPublicProperties } from '@/services/publicPropertyService'

// ─── Property card (reused by HomePage too, but isolated here to keep deps clear) ──
function PropertyCard({ property }) {
  return (
    <Link
      to={`/pgs/${property.id}`}
      className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
    >
      <div className="h-44 bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center relative shrink-0 overflow-hidden">
        {property.coverImageUrl ? (
          <img
            src={property.coverImageUrl}
            alt={property.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Building2 size={40} className="text-indigo-300" />
        )}

        {property.vacantRooms > 0 && (
          <span className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs">
            {property.vacantRooms} Available
          </span>
        )}
        {property.vacantRooms === 0 && property.totalRooms > 0 && (
          <span className="absolute top-3 right-3 bg-gray-400 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs">
            Full
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm group-hover:text-indigo-700 transition-colors line-clamp-1">
          {property.name}
        </h3>

        {(property.city || property.address) && (
          <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{property.city || property.address}</span>
          </div>
        )}

        {property.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {property.amenities.slice(0, 3).map((a) => (
              <span key={a} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                {a.split(' (')[0]}
              </span>
            ))}
            {property.amenities.length > 3 && (
              <span className="text-xs text-gray-400">+{property.amenities.length - 3}</span>
            )}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
          <div>
            <p className="text-xs text-gray-400">From</p>
            <p className="font-bold text-indigo-600 text-sm">
              {property.minRent > 0 ? formatCurrency(property.minRent) : '—'}
              {property.minRent > 0 && <span className="text-xs font-normal text-gray-400">/mo</span>}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users size={12} />
            {property.totalRooms} room{property.totalRooms !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Main PGListingsPage ──────────────────────────────────────────────────────
export default function PGListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isMountedRef = useRef(true)
  const { user } = useAuth()

  // Filter state — initialise from URL params
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [cityFilter, setCityFilter] = useState(searchParams.get('city') || '')
  const [maxRent, setMaxRent] = useState(searchParams.get('maxRent') || '')
  const [availableOnly, setAvailableOnly] = useState(searchParams.get('available') === '1')
  const [showFilters, setShowFilters] = useState(false)

  const [properties, setProperties] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [unconfigured, setUnconfigured] = useState(false)

  // Load cities once for the filter dropdown
  useEffect(() => {
    fetchPublicCities().then(setCities)
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    setLoading(true)
    setError(null)

    async function load() {
      const result = await fetchPublicProperties({
        search: search.trim(),
        city: cityFilter,
        maxRent: maxRent ? Number(maxRent) : undefined,
        availableOnly,
      })
      if (!isMountedRef.current) return

      if (result.unconfigured) {
        setUnconfigured(true)
      } else if (result.migrationRequired) {
        setMigrationRequired(true)
      } else if (result.error) {
        setError(result.error)
      } else {
        setProperties(result.data || [])
      }
      setLoading(false)
    }

    load()
    return () => { isMountedRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, cityFilter, maxRent, availableOnly])

  // Sync filters to URL
  function applyFilters(e) {
    e.preventDefault()
    const params = {}
    if (search.trim()) params.search = search.trim()
    if (cityFilter) params.city = cityFilter
    if (maxRent) params.maxRent = maxRent
    if (availableOnly) params.available = '1'
    setSearchParams(params)
  }

  function clearFilters() {
    setSearch('')
    setCityFilter('')
    setMaxRent('')
    setAvailableOnly(false)
    setSearchParams({})
  }

  const hasActiveFilters = search || cityFilter || maxRent || availableOnly

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <ArrowLeft size={16} className="text-gray-400" />
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base hidden sm:block">PG Manager</span>
          </Link>
          {user ? (
            <Link
              to="/manager/dashboard"
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-1.5 shadow-xs"
            >
              <LayoutDashboard size={15} />
              <span>Manager Dashboard</span>
            </Link>
          ) : (
            <Link
              to="/manager/login"
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Manager Login
            </Link>
          )}
        </div>
      </nav>

      {/* ── Header + search ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Browse PG Accommodations</h1>

          <form onSubmit={applyFilters} className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name, city, or area…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Filter size={15} />
              Filters {hasActiveFilters ? '•' : ''}
            </button>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">All cities</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Rent (₹/month)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  placeholder="e.g. 15000"
                  value={maxRent}
                  onChange={(e) => setMaxRent(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-36 outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                <span className="text-sm text-gray-700">Available rooms only</span>
              </label>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-red-600 hover:underline flex items-center gap-1"
                >
                  <X size={12} /> Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3 mb-6">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 text-sm">Could not load properties</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-xs font-medium text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Unconfigured */}
        {unconfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
            <Building2 size={36} className="mx-auto text-amber-400 mb-3" />
            <p className="font-medium text-amber-800">Supabase not configured</p>
            <p className="text-xs text-amber-600 mt-1">
              Add credentials to <code className="bg-amber-100 px-1 rounded">frontend/.env.local</code>.
            </p>
          </div>
        )}

        {/* Migration required */}
        {migrationRequired && !unconfigured && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
            <ShieldCheck size={36} className="mx-auto text-blue-400 mb-3" />
            <p className="font-medium text-blue-800">Public listing not yet enabled</p>
            <p className="text-xs text-blue-600 mt-2 max-w-sm mx-auto">
              Run <code className="bg-blue-100 px-1 rounded">006_secure_public_listing_rls.sql</code> in
              your Supabase SQL Editor to allow visitors to browse properties.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && !unconfigured && !migrationRequired && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 h-64 animate-pulse" />
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && !error && !unconfigured && !migrationRequired && (
          <>
            <p className="text-sm text-gray-500 mb-5">
              {properties.length === 0
                ? 'No properties found'
                : `${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'} found`}
              {hasActiveFilters && ' (filtered)'}
            </p>
            {properties.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Building2 size={44} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 font-medium">
                  {hasActiveFilters ? 'No properties match your filters' : 'No PGs listed yet'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 text-sm text-indigo-600 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {properties.map((p) => (
                  <PropertyCard key={p.id} property={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4 sm:px-6 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <Link to="/" className="flex items-center gap-2 text-white font-bold">
            <Building2 size={16} className="text-indigo-400" /> PG Manager
          </Link>
          <div className="flex gap-5">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/manager/login" className="hover:text-white transition-colors">Manager Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
