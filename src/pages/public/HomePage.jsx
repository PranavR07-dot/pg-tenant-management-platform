import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  LayoutDashboard,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Users,
  Wifi,
  Wind,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/utils/helpers'
import { fetchPublicProperties } from '@/services/publicPropertyService'

// ─── Shared amenity icon map ──────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()

const AMENITY_ICONS = {
  'Wi-Fi': Wifi,
  'Air Conditioning (AC)': Wind,
  'Power Backup': Zap,
}

function AmenityIcon({ name }) {
  const Icon = AMENITY_ICONS[name]
  return Icon ? <Icon size={14} /> : null
}

// ─── Property card ────────────────────────────────────────────────────────────
function PropertyCard({ property }) {
  return (
    <Link
      to={`/pgs/${property.id}`}
      className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
    >
      {/* Property Cover Image or Placeholder */}
      <div className="h-48 bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center relative shrink-0 overflow-hidden">
        {property.coverImageUrl ? (
          <img
            src={property.coverImageUrl}
            alt={property.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Building2 size={48} className="text-indigo-300" />
        )}

        {property.vacantRooms > 0 && (
          <span className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs">
            {property.vacantRooms} Available
          </span>
        )}
        {property.vacantRooms === 0 && property.totalRooms > 0 && (
          <span className="absolute top-3 right-3 bg-gray-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs">
            Full
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-base group-hover:text-indigo-700 transition-colors line-clamp-1">
          {property.name}
        </h3>

        {(property.city || property.address) && (
          <div className="flex items-center gap-1.5 text-gray-400 text-xs mt-1.5">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{property.city || property.address}</span>
          </div>
        )}

        {property.description && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-2 flex-1">{property.description}</p>
        )}

        {/* Amenities */}
        {property.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {property.amenities.slice(0, 4).map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full"
              >
                <AmenityIcon name={a} />
                {a.split(' (')[0]}
              </span>
            ))}
            {property.amenities.length > 4 && (
              <span className="text-xs text-gray-400">+{property.amenities.length - 4} more</span>
            )}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Starting from</p>
            <p className="text-lg font-bold text-indigo-600">
              {property.minRent > 0 ? formatCurrency(property.minRent) : '—'}
              {property.minRent > 0 && <span className="text-xs font-normal text-gray-400">/mo</span>}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Users size={13} />
            {property.totalRooms} room{property.totalRooms !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Static feature highlights ────────────────────────────────────────────────
const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Verified Properties',
    desc: 'All PGs are registered and managed by verified owners on our platform.',
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: Star,
    title: 'Transparent Pricing',
    desc: 'See actual room rent and deposit amounts — no hidden charges.',
    color: 'bg-amber-100 text-amber-600',
  },
  {
    icon: Wifi,
    title: 'Detailed Amenities',
    desc: 'Filter by Wi-Fi, AC, attached bathroom, and other facilities you need.',
    color: 'bg-indigo-100 text-indigo-600',
  },
]

// ─── Main HomePage ────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate()
  const isMountedRef = useRef(true)
  const { user } = useAuth()

  const [search, setSearch] = useState('')
  const [featured, setFeatured] = useState([])
  const [loadingFeatured, setLoadingFeatured] = useState(true)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [unconfigured, setUnconfigured] = useState(false)

  useEffect(() => {
    isMountedRef.current = true

    async function loadFeatured() {
      const result = await fetchPublicProperties({ availableOnly: false })
      if (!isMountedRef.current) return

      if (result.unconfigured) {
        setUnconfigured(true)
      } else if (result.migrationRequired) {
        setMigrationRequired(true)
      } else {
        // Show up to 6 featured properties
        setFeatured((result.data || []).slice(0, 6))
      }
      setLoadingFeatured(false)
    }

    loadFeatured()
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    navigate(`/pgs${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg leading-none">PG Manager</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/pgs"
              className="text-sm text-gray-600 hover:text-indigo-700 font-medium transition-colors hidden sm:block"
            >
              Browse PGs
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
                PG Manager Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-indigo-50 via-white to-cyan-50 py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Building2 size={12} />
            Find your perfect paying guest accommodation
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight">
            Discover PGs &amp;{' '}
            <span className="text-indigo-600">Hostels</span> near you
          </h1>

          <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto">
            Browse verified PG accommodations with transparent pricing, detailed amenities, and real
            availability — no hidden charges.
          </p>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="mt-8 flex gap-2 max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-md p-2"
          >
            <div className="flex-1 flex items-center gap-2 px-3">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by city, area, or PG name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm outline-none placeholder-gray-400 bg-transparent"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shrink-0"
            >
              Search
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/pgs"
              className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm hover:underline"
            >
              Explore all PGs <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Why choose PG Manager?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50">
                <div className={`p-3 rounded-xl mb-4 ${f.color}`}>
                  <f.icon size={22} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured PGs ───────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Featured PG Accommodations</h2>
              <p className="text-sm text-gray-400 mt-1">Browse available properties listed on our platform</p>
            </div>
            <Link
              to="/pgs"
              className="text-sm font-medium text-indigo-600 hover:underline flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {/* Configuration not set up */}
          {unconfigured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <Building2 size={32} className="mx-auto text-amber-400 mb-3" />
              <p className="font-medium text-amber-800 text-sm">Supabase is not configured</p>
              <p className="text-xs text-amber-600 mt-1">
                Add your Supabase credentials to{' '}
                <code className="bg-amber-100 px-1 rounded">frontend/.env.local</code> to see live
                properties.
              </p>
            </div>
          )}

          {/* Migration needed */}
          {migrationRequired && !unconfigured && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
              <ShieldCheck size={32} className="mx-auto text-blue-400 mb-3" />
              <p className="font-medium text-blue-800 text-sm">One-time setup required</p>
              <p className="text-xs text-blue-600 mt-1 max-w-md mx-auto">
                To enable public PG browsing, run{' '}
                <code className="bg-blue-100 px-1 rounded">006_secure_public_listing_rls.sql</code> in your
                Supabase SQL Editor. This grants controlled read-only access to published properties for
                unauthenticated visitors.
              </p>
            </div>
          )}

          {/* Loading */}
          {loadingFeatured && !unconfigured && !migrationRequired && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 h-72 animate-pulse" />
              ))}
            </div>
          )}

          {/* Properties */}
          {!loadingFeatured && !unconfigured && !migrationRequired && featured.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loadingFeatured && !unconfigured && !migrationRequired && featured.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium">No properties listed yet</p>
              <p className="text-sm text-gray-400 mt-1">
                PG owners can sign up and add their properties using the manager dashboard.
              </p>
              <Link
                to="/manager/login"
                className="inline-flex items-center gap-2 mt-5 text-sm bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                List your PG <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 bg-indigo-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white">Are you a PG owner?</h2>
          <p className="mt-3 text-indigo-200 text-base">
            Manage your properties, track rent payments, and handle tenants — all in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {user ? (
              <Link
                to="/manager/dashboard"
                className="bg-white text-indigo-700 font-semibold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors text-sm flex items-center gap-2"
              >
                <LayoutDashboard size={16} />
                <span>Go to Manager Dashboard</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="bg-white text-indigo-700 font-semibold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors text-sm"
                >
                  Register your PG free
                </Link>
                <Link
                  to="/manager/login"
                  className="border border-indigo-400 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm"
                >
                  Manager Login
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-bold text-white">PG Manager</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <Link to="/pgs" className="hover:text-white transition-colors">Browse PGs</Link>
            {user ? (
              <Link to="/manager/dashboard" className="text-indigo-400 hover:text-white transition-colors font-medium">
                Manager Dashboard
              </Link>
            ) : (
              <>
                <Link to="/manager/login" className="hover:text-white transition-colors">Manager Login</Link>
                <Link to="/register" className="hover:text-white transition-colors">Register PG</Link>
              </>
            )}
          </div>
          <p className="text-xs text-gray-600">© {CURRENT_YEAR} PG Manager</p>
        </div>
      </footer>
    </div>
  )
}
